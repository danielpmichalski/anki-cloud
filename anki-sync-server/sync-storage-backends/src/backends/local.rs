use std::path::Path;

use anyhow::Result;
use sync_storage_api::StorageBackend;

/// No-op backend — collection already lives on local filesystem.
/// Used for local dev/testing without cloud storage.
pub struct LocalBackend;

impl StorageBackend for LocalBackend {
    fn fetch(&self, _user: &str, _dest: &Path) -> Result<()> {
        Ok(())
    }

    fn commit(&self, _user: &str, _src: &Path) -> Result<()> {
        Ok(())
    }
}
