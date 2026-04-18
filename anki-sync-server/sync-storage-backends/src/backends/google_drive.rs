use std::path::Path;
use std::time::Duration;

use anyhow::{anyhow, Result};
use bytes::Bytes;
use reqwest::header::{HeaderMap, AUTHORIZATION, CONTENT_TYPE};
use serde_json::{json, Value};
use sync_storage_api::StorageBackend;
use tokio::fs;

const ANKI_FOLDER_NAME: &str = "AnkiSync";
const COLLECTION_FILE_NAME: &str = "collection.anki2";
const CHUNK_SIZE: usize = 256 * 1024; // 256 KB per research doc
const DRIVE_FILES_URL: &str = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD_URL: &str = "https://www.googleapis.com/upload/drive/v3/files";

pub struct GoogleDriveBackend {
    oauth_token: String,
    files_base_url: String,
    upload_base_url: String,
}

impl GoogleDriveBackend {
    pub fn new(oauth_token: impl Into<String>) -> Self {
        Self {
            oauth_token: oauth_token.into(),
            files_base_url: DRIVE_FILES_URL.to_string(),
            upload_base_url: DRIVE_UPLOAD_URL.to_string(),
        }
    }

    #[cfg(test)]
    pub fn with_base_urls(
        oauth_token: impl Into<String>,
        files_url: String,
        upload_url: String,
    ) -> Self {
        Self {
            oauth_token: oauth_token.into(),
            files_base_url: files_url,
            upload_base_url: upload_url,
        }
    }

    fn auth_header(&self) -> HeaderMap {
        let mut headers = HeaderMap::new();
        headers.insert(
            AUTHORIZATION,
            format!("Bearer {}", self.oauth_token)
                .parse()
                .expect("valid auth header"),
        );
        headers
    }

    async fn backoff_duration(attempt: u32) -> Duration {
        let base_secs = 2_u32.pow(attempt).min(32);
        let jitter_ms = rand::random::<u64>() % 1000;
        Duration::from_millis(base_secs as u64 * 1000 + jitter_ms)
    }

    async fn get_or_create_anki_folder(&self) -> Result<String> {
        let client = reqwest::Client::new();
        let query = format!(
            "name='{}' and mimeType='application/vnd.google-apps.folder' and trashed=false",
            ANKI_FOLDER_NAME
        );

        let response = client
            .get(&self.files_base_url)
            .headers(self.auth_header())
            .query(&[("q", query.as_str()), ("spaces", "drive")])
            .send()
            .await?;

        let body: Value = response.json().await?;
        let files = body
            .get("files")
            .and_then(|f| f.as_array())
            .ok_or_else(|| anyhow!("failed to parse file list"))?;

        if !files.is_empty() {
            return files[0]
                .get("id")
                .and_then(|id| id.as_str())
                .map(|id| id.to_string())
                .ok_or_else(|| anyhow!("missing folder id"));
        }

        // Create folder if not found
        let create_response = client
            .post(&self.files_base_url)
            .headers(self.auth_header())
            .json(&json!({
                "name": ANKI_FOLDER_NAME,
                "mimeType": "application/vnd.google-apps.folder"
            }))
            .send()
            .await?;

        let create_body: Value = create_response.json().await?;
        create_body
            .get("id")
            .and_then(|id| id.as_str())
            .map(|id| id.to_string())
            .ok_or_else(|| anyhow!("failed to create AnkiSync folder"))
    }

    async fn find_collection_file(&self, folder_id: &str) -> Result<Option<String>> {
        let client = reqwest::Client::new();
        let query = format!(
            "'{}' in parents and name='{}' and trashed=false",
            folder_id, COLLECTION_FILE_NAME
        );

        let response = client
            .get(&self.files_base_url)
            .headers(self.auth_header())
            .query(&[("q", query.as_str()), ("spaces", "drive")])
            .send()
            .await?;

        let body: Value = response.json().await?;
        let files = body
            .get("files")
            .and_then(|f| f.as_array())
            .ok_or_else(|| anyhow!("failed to parse file list"))?;

        Ok(files
            .first()
            .and_then(|f| f.get("id"))
            .and_then(|id| id.as_str())
            .map(|id| id.to_string()))
    }

    async fn download_file(&self, file_id: &str, dest: &Path) -> Result<()> {
        let client = reqwest::Client::new();
        let mut attempt = 0;
        let url = format!("{}/{}?alt=media", self.files_base_url, file_id);

        loop {
            let response = client.get(&url).headers(self.auth_header()).send().await?;

            match response.status().as_u16() {
                200 => {
                    let bytes = response.bytes().await?;
                    fs::write(dest, bytes).await?;
                    return Ok(());
                }
                403 | 429 => {
                    if attempt < 6 {
                        tokio::time::sleep(Self::backoff_duration(attempt).await).await;
                        attempt += 1;
                    } else {
                        return Err(anyhow!("rate limited after {} attempts", attempt));
                    }
                }
                code => return Err(anyhow!("download failed: HTTP {}", code)),
            }
        }
    }

    async fn upload_file_resumable(
        &self,
        file_id: Option<&str>,
        folder_id: &str,
        src: &Path,
    ) -> Result<()> {
        let file_data = fs::read(src).await?;
        let client = reqwest::Client::new();

        let metadata = if let Some(_id) = file_id {
            json!({"name": COLLECTION_FILE_NAME})
        } else {
            json!({
                "name": COLLECTION_FILE_NAME,
                "parents": [folder_id]
            })
        };

        let url = if let Some(id) = file_id {
            format!("{}/{}", self.upload_base_url, id)
        } else {
            self.upload_base_url.clone()
        };

        // Initiate resumable upload session
        let mut headers = self.auth_header();
        headers.insert(
            "X-Goog-Upload-Protocol",
            "resumable".parse().expect("valid header"),
        );

        let session_response = client
            .post(&url)
            .headers(headers)
            .query(&[("uploadType", "resumable")])
            .json(&metadata)
            .send()
            .await?;

        let session_uri = session_response
            .headers()
            .get("location")
            .and_then(|h| h.to_str().ok())
            .map(|s| s.to_string())
            .ok_or_else(|| anyhow!("no session URI returned"))?;

        // Upload file in chunks
        for (i, chunk) in file_data.chunks(CHUNK_SIZE).enumerate() {
            let total_size = file_data.len() as i64;
            let start = (i * CHUNK_SIZE) as i64;
            let end = (start + chunk.len() as i64 - 1).min(total_size - 1);

            let mut upload_headers = HeaderMap::new();
            upload_headers.insert(
                "Content-Range",
                format!("bytes {}-{}/{}", start, end, total_size)
                    .parse()
                    .expect("valid header"),
            );
            upload_headers.insert(
                CONTENT_TYPE,
                "application/octet-stream".parse().expect("valid header"),
            );

            let mut attempt = 0;
            loop {
                let response = client
                    .put(session_uri.as_str())
                    .headers(upload_headers.clone())
                    .body(Bytes::copy_from_slice(chunk))
                    .send()
                    .await?;

                match response.status().as_u16() {
                    200 | 201 => return Ok(()), // Upload complete
                    308 => break,               // Continue uploading
                    403 | 429 => {
                        if attempt < 6 {
                            tokio::time::sleep(Self::backoff_duration(attempt).await).await;
                            attempt += 1;
                        } else {
                            return Err(anyhow!("rate limited after {} attempts", attempt));
                        }
                    }
                    code => return Err(anyhow!("upload failed: HTTP {}", code)),
                }
            }
        }

        Ok(())
    }

    async fn fetch_async(&self, dest: &Path) -> Result<()> {
        let folder_id = self.get_or_create_anki_folder().await?;

        if let Some(file_id) = self.find_collection_file(&folder_id).await? {
            self.download_file(&file_id, dest).await?;
        }

        Ok(())
    }

    async fn commit_async(&self, src: &Path) -> Result<()> {
        let folder_id = self.get_or_create_anki_folder().await?;
        let file_id = self.find_collection_file(&folder_id).await?;

        self.upload_file_resumable(file_id.as_deref(), &folder_id, src)
            .await?;

        Ok(())
    }
}

impl StorageBackend for GoogleDriveBackend {
    fn fetch(&self, _user: &str, dest: &Path) -> Result<()> {
        tokio::task::block_in_place(|| {
            tokio::runtime::Handle::current().block_on(self.fetch_async(dest))
        })
    }

    fn commit(&self, _user: &str, src: &Path) -> Result<()> {
        tokio::task::block_in_place(|| {
            tokio::runtime::Handle::current().block_on(self.commit_async(src))
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use wiremock::matchers::{method, path};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    #[tokio::test]
    async fn test_get_or_create_anki_folder_exists() {
        let mock_server = MockServer::start().await;
        let folder_response = json!({
            "files": [{
                "id": "folder-123",
                "name": ANKI_FOLDER_NAME
            }]
        });

        Mock::given(method("GET"))
            .and(path("/drive/v3/files"))
            .respond_with(ResponseTemplate::new(200).set_body_json(folder_response))
            .mount(&mock_server)
            .await;

        let backend = GoogleDriveBackend::with_base_urls(
            "test-token",
            format!("{}/drive/v3/files", mock_server.uri()),
            format!("{}/upload/drive/v3/files", mock_server.uri()),
        );

        let folder_id = backend.get_or_create_anki_folder().await.unwrap();
        assert_eq!(folder_id, "folder-123");
    }

    #[tokio::test]
    async fn test_find_collection_file_exists() {
        let mock_server = MockServer::start().await;
        let file_response = json!({
            "files": [{
                "id": "file-456",
                "name": COLLECTION_FILE_NAME
            }]
        });

        Mock::given(method("GET"))
            .and(path("/drive/v3/files"))
            .respond_with(ResponseTemplate::new(200).set_body_json(file_response))
            .mount(&mock_server)
            .await;

        let backend = GoogleDriveBackend::with_base_urls(
            "test-token",
            format!("{}/drive/v3/files", mock_server.uri()),
            format!("{}/upload/drive/v3/files", mock_server.uri()),
        );

        let file_id = backend.find_collection_file("folder-123").await.unwrap();
        assert_eq!(file_id, Some("file-456".to_string()));
    }

    #[tokio::test]
    async fn test_find_collection_file_not_found() {
        let mock_server = MockServer::start().await;
        let empty_response = json!({ "files": [] });

        Mock::given(method("GET"))
            .and(path("/drive/v3/files"))
            .respond_with(ResponseTemplate::new(200).set_body_json(empty_response))
            .mount(&mock_server)
            .await;

        let backend = GoogleDriveBackend::with_base_urls(
            "test-token",
            format!("{}/drive/v3/files", mock_server.uri()),
            format!("{}/upload/drive/v3/files", mock_server.uri()),
        );

        let file_id = backend.find_collection_file("folder-123").await.unwrap();
        assert_eq!(file_id, None);
    }
}
