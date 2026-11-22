use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use anyhow::{Context, Result};
use serde::Deserialize;

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
    /// Seconds until the access token expires; Google sends 3599.
    expires_in: Option<u64>,
}

/// Refresh the token this long before it really expires.
const EXPIRY_MARGIN: Duration = Duration::from_secs(120);

/// Access tokens by refresh token, kept in memory only. A token lives about an hour, and the sync
/// server resolves a storage backend on every request, so without this every request (and every
/// media batch) would pay a round trip to Google first.
fn cache() -> &'static Mutex<HashMap<String, (String, Instant)>> {
    static CACHE: OnceLock<Mutex<HashMap<String, (String, Instant)>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn client() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .connect_timeout(Duration::from_secs(10))
            .timeout(Duration::from_secs(30))
            .build()
            .expect("build http client")
    })
}

pub async fn exchange_refresh_token(refresh_token: &str) -> Result<String> {
    if let Some((token, expires_at)) = cache().lock().unwrap().get(refresh_token) {
        if Instant::now() < *expires_at {
            return Ok(token.clone());
        }
    }

    let client_id =
        std::env::var("GOOGLE_CLIENT_ID").context("GOOGLE_CLIENT_ID not set")?;
    let client_secret =
        std::env::var("GOOGLE_CLIENT_SECRET").context("GOOGLE_CLIENT_SECRET not set")?;

    let resp: TokenResponse = client()
        .post("https://oauth2.googleapis.com/token")
        .form(&[
            ("grant_type", "refresh_token"),
            ("refresh_token", refresh_token),
            ("client_id", &client_id),
            ("client_secret", &client_secret),
        ])
        .send()
        .await
        .context("send token refresh request")?
        .error_for_status()
        .context("token refresh HTTP error")?
        .json()
        .await
        .context("parse token response")?;

    let lifetime = Duration::from_secs(resp.expires_in.unwrap_or(3600));
    let expires_at = Instant::now() + lifetime.saturating_sub(EXPIRY_MARGIN);
    cache()
        .lock()
        .unwrap()
        .insert(refresh_token.to_string(), (resp.access_token.clone(), expires_at));

    Ok(resp.access_token)
}
