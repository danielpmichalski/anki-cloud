use std::path::Path;

use anyhow::Result;

pub trait StorageBackend: Send + Sync {
    /// Download the user's collection to `dest` before sync begins.
    fn fetch(&self, user: &str, dest: &Path) -> Result<()>;

    /// Upload the user's collection from `src` after sync completes.
    fn commit(&self, user: &str, src: &Path) -> Result<()>;
}
