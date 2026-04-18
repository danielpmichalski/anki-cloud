use aes_gcm::aead::Aead;
use aes_gcm::Aes256Gcm;
use aes_gcm::KeyInit;
use anyhow::{anyhow, Context, Result};
use data_encoding::BASE64URL_NOPAD;
use rusqlite::OptionalExtension;
use serde::Deserialize;

const IV_LENGTH: usize = 12;

/// Decrypt a token encrypted by packages/db/src/encrypt.ts.
/// Format: base64url(IV[12] || ciphertext+tag)
fn decrypt_token(encrypted: &str, key_bytes: &[u8]) -> Result<String> {
    let combined = BASE64URL_NOPAD
        .decode(encrypted.as_bytes())
        .context("base64url decode")?;

    if combined.len() < IV_LENGTH {
        return Err(anyhow!("encrypted token too short"));
    }

    let (iv_bytes, ciphertext) = combined.split_at(IV_LENGTH);
    let key = aes_gcm::Key::<Aes256Gcm>::from_slice(key_bytes);
    let cipher = Aes256Gcm::new(key);
    let nonce = aes_gcm::Nonce::from_slice(iv_bytes);

    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| anyhow!("AES-GCM decryption failed"))?;

    String::from_utf8(plaintext).context("UTF-8 decode")
}

fn load_enc_key() -> Result<Vec<u8>> {
    let raw = std::env::var("TOKEN_ENCRYPTION_KEY")
        .context("TOKEN_ENCRYPTION_KEY env var is required")?;
    let key_bytes = if raw.len() == 64 {
        hex::decode(&raw).context("hex decode TOKEN_ENCRYPTION_KEY")?
    } else {
        data_encoding::BASE64
            .decode(raw.as_bytes())
            .context("base64 decode TOKEN_ENCRYPTION_KEY")?
    };
    if key_bytes.len() != 32 {
        return Err(anyhow!("TOKEN_ENCRYPTION_KEY must be 32 bytes"));
    }
    Ok(key_bytes)
}

fn db_path() -> Result<String> {
    let url = std::env::var("DATABASE_URL").context("DATABASE_URL env var is required")?;
    // rusqlite takes a file path; strip the "file:" prefix if present
    let path = if url.starts_with("file:") {
        url[5..].to_string()
    } else {
        url
    };
    Ok(path)
}

/// Look up storage_connections for the given user (matched by email).
/// Returns (provider, plaintext_refresh_token).
pub fn fetch_storage_connection(username: &str) -> Result<(String, String)> {
    let path = db_path()?;
    let enc_key = load_enc_key()?;

    let conn = rusqlite::Connection::open_with_flags(
        &path,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY | rusqlite::OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .with_context(|| format!("open SQLite at {path}"))?;

    let (provider, encrypted_refresh): (String, String) = conn
        .query_row(
            "SELECT sc.provider, sc.oauth_refresh_token \
             FROM storage_connections sc \
             JOIN users u ON u.id = sc.user_id \
             WHERE u.email = ?1 \
             LIMIT 1",
            rusqlite::params![username],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .with_context(|| format!("no storage connection found for user '{username}'"))?;

    let refresh_token = decrypt_token(&encrypted_refresh, &enc_key)?;
    Ok((provider, refresh_token))
}

// ── Sync credential auth ──────────────────────────────────────────────────────

const DUMMY_HASH: &str = "$2b$10$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

/// Verify email + plaintext sync password against users.sync_password_hash (bcrypt).
/// Timing-safe: always runs a bcrypt compare, even for unknown users or null hashes.
pub fn verify_sync_credentials(email: &str, password: &str) -> Result<()> {
    let path = db_path()?;
    let conn = rusqlite::Connection::open_with_flags(
        &path,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY | rusqlite::OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .with_context(|| format!("open SQLite at {path}"))?;

    let hash: Option<String> = conn
        .query_row(
            "SELECT sync_password_hash FROM users WHERE email = ?1 LIMIT 1",
            rusqlite::params![email],
            |row| row.get(0),
        )
        .optional()
        .context("query users")?
        .flatten();

    let hash_to_verify = hash.as_deref().unwrap_or(DUMMY_HASH);
    let ok = bcrypt::verify(password, hash_to_verify).unwrap_or(false);

    if hash.is_none() || !ok {
        return Err(anyhow!("invalid credentials"));
    }
    Ok(())
}

/// Upsert hkey into users_sync_state.sync_key for the user with this email.
pub fn store_sync_key(email: &str, hkey: &str) -> Result<()> {
    let path = db_path()?;
    let conn = rusqlite::Connection::open_with_flags(
        &path,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_WRITE | rusqlite::OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .with_context(|| format!("open SQLite at {path}"))?;

    conn.execute(
        "INSERT INTO users_sync_state (id, user_id, sync_key)
         SELECT lower(hex(randomblob(16))), u.id, ?2
         FROM users u WHERE u.email = ?1
         ON CONFLICT (user_id) DO UPDATE SET sync_key = excluded.sync_key",
        rusqlite::params![email, hkey],
    )
    .context("upsert sync key")?;

    Ok(())
}

/// Reverse-lookup: find the user's email from hkey stored in users_sync_state.sync_key.
pub fn lookup_user_by_sync_key(hkey: &str) -> Result<String> {
    let path = db_path()?;
    let conn = rusqlite::Connection::open_with_flags(
        &path,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY | rusqlite::OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .with_context(|| format!("open SQLite at {path}"))?;

    let email: String = conn
        .query_row(
            "SELECT u.email FROM users u
             JOIN users_sync_state s ON s.user_id = u.id
             WHERE s.sync_key = ?1 LIMIT 1",
            rusqlite::params![hkey],
            |row| row.get(0),
        )
        .context("no user found for sync key")?;

    Ok(email)
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
}

/// Exchange a Google OAuth2 refresh token for a fresh access token.
/// Uses GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET env vars.
pub async fn exchange_refresh_token(refresh_token: &str) -> Result<String> {
    let client_id =
        std::env::var("GOOGLE_CLIENT_ID").context("GOOGLE_CLIENT_ID env var is required")?;
    let client_secret = std::env::var("GOOGLE_CLIENT_SECRET")
        .context("GOOGLE_CLIENT_SECRET env var is required")?;

    let client = reqwest::Client::new();
    let resp = client
        .post("https://oauth2.googleapis.com/token")
        .form(&[
            ("grant_type", "refresh_token"),
            ("refresh_token", refresh_token),
            ("client_id", &client_id),
            ("client_secret", &client_secret),
        ])
        .send()
        .await
        .context("send token refresh request")?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(anyhow!("token refresh failed ({status}): {body}"));
    }

    let token_resp: TokenResponse = resp.json().await.context("parse token response")?;
    Ok(token_resp.access_token)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decrypt_round_trip() {
        use aes_gcm::aead::Aead;
        use aes_gcm::{Aes256Gcm, KeyInit, Nonce};

        let key_bytes = [0u8; 32];
        let iv = [0u8; IV_LENGTH];
        let plaintext = b"hello";

        let key = aes_gcm::Key::<Aes256Gcm>::from_slice(&key_bytes);
        let cipher = Aes256Gcm::new(key);
        let nonce = Nonce::from_slice(&iv);
        let ciphertext = cipher.encrypt(nonce, plaintext.as_ref()).unwrap();

        let mut combined = Vec::with_capacity(IV_LENGTH + ciphertext.len());
        combined.extend_from_slice(&iv);
        combined.extend_from_slice(&ciphertext);
        let encoded = BASE64URL_NOPAD.encode(&combined);

        let decrypted = decrypt_token(&encoded, &key_bytes).unwrap();
        assert_eq!(decrypted, "hello");
    }
}
