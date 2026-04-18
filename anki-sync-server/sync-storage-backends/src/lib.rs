mod backends;

use anyhow::{anyhow, Result};
pub use backends::google_drive::GoogleDriveBackend;
pub use backends::local::LocalBackend;
use sync_storage_api::StorageBackend;

pub struct StorageBackendFactory;

impl StorageBackendFactory {
    /// Create a backend for `provider` using the given OAuth token.
    /// `provider` matches `storage_connections.provider` in SQLite.
    pub fn create(provider: &str, oauth_token: &str) -> Result<Box<dyn StorageBackend>> {
        match provider {
            "gdrive" => Ok(Box::new(GoogleDriveBackend::new(oauth_token))),
            "local" => Ok(Box::new(LocalBackend)),
            _ => Err(anyhow!("unknown storage provider: {provider}")),
        }
    }
}
