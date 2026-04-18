use std::path::Path;

use anyhow::Result;
use sync_storage_api::StorageBackend;

pub struct GDriveBackend {
    oauth_token: String,
}

impl GDriveBackend {
    pub fn new(oauth_token: impl Into<String>) -> Self {
        Self {
            oauth_token: oauth_token.into(),
        }
    }
}

impl StorageBackend for GDriveBackend {
    fn fetch(&self, _user: &str, _dest: &Path) -> Result<()> {
        todo!("download collection.anki2 from GDrive using oauth_token")
    }

    fn commit(&self, _user: &str, _src: &Path) -> Result<()> {
        todo!("upload collection.anki2 to GDrive using oauth_token")
    }
}
