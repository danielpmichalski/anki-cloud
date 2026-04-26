use anyhow::{Context, Result};
use serde::Deserialize;

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
}

pub async fn exchange_refresh_token(refresh_token: &str) -> Result<String> {
    let client_id =
        std::env::var("GOOGLE_CLIENT_ID").context("GOOGLE_CLIENT_ID not set")?;
    let client_secret =
        std::env::var("GOOGLE_CLIENT_SECRET").context("GOOGLE_CLIENT_SECRET not set")?;

    let resp: TokenResponse = reqwest::Client::new()
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

    Ok(resp.access_token)
}
