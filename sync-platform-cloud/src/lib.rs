pub mod db;
pub mod oauth;
pub mod token;

use anyhow::Result;
use sync_platform_api::{AuthProvider, BackendResolver, StorageBackend};
use sync_storage_backends::StorageBackendFactory;

pub struct CloudAuthProvider;

impl AuthProvider for CloudAuthProvider {
    fn authenticate(&self, username: &str, password: &str) -> Result<(String, String)> {
        db::verify_sync_credentials(username, password)?;
        let hkey = anki::sync::http_server::derive_hkey(&format!("{username}:{password}"));
        db::store_sync_key(username, &hkey)?;
        Ok((hkey, username.to_string()))
    }

    fn lookup_by_hkey(&self, hkey: &str) -> Result<String> {
        db::lookup_user_by_sync_key(hkey)
    }
}

pub struct CloudBackendResolver;

impl BackendResolver for CloudBackendResolver {
    fn resolve_for_user(&self, username: &str) -> Result<Box<dyn StorageBackend>> {
        let (provider, encrypted_opt, folder_path) = db::fetch_storage_connection(username)?;

        if provider == "local" {
            return StorageBackendFactory::create("local", "", &folder_path);
        }

        let encrypted = encrypted_opt
            .ok_or_else(|| anyhow::anyhow!("missing oauth_refresh_token for '{username}'"))?;
        let key = token::load_enc_key()?;
        let refresh_token = token::decrypt_token(&encrypted, &key)?;

        // resolve_for_user is a sync trait method; block_in_place is safe on rt-multi-thread.
        let access_token = tokio::task::block_in_place(|| {
            tokio::runtime::Handle::current()
                .block_on(oauth::exchange_refresh_token(&refresh_token))
        })?;

        StorageBackendFactory::create(&provider, &access_token, &folder_path)
    }
}
