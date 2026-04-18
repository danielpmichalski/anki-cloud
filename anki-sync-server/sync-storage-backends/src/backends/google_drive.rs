use std::path::Path;

use anyhow::Result;
use sync_storage_api::StorageBackend;

pub struct GoogleDriveBackend {
    oauth_token: String,
}

impl GoogleDriveBackend {
    pub fn new(oauth_token: impl Into<String>) -> Self {
        Self {
            oauth_token: oauth_token.into(),
        }
    }
}

impl StorageBackend for GoogleDriveBackend {
    fn fetch(&self, _user: &str, _dest: &Path) -> Result<()> {
        todo!("download collection.anki2 from Google Drive using oauth_token")
    }

    fn commit(&self, _user: &str, _src: &Path) -> Result<()> {
        todo!("upload collection.anki2 to Google Drive using oauth_token")
    }
}
