use aes_gcm::{aead::Aead, Aes256Gcm, KeyInit};
use anyhow::{anyhow, Context, Result};
use data_encoding::BASE64URL_NOPAD;

const IV_LEN: usize = 12;

pub fn load_enc_key() -> Result<Vec<u8>> {
    let raw = std::env::var("TOKEN_ENCRYPTION_KEY").context("TOKEN_ENCRYPTION_KEY not set")?;
    let key = if raw.len() == 64 {
        hex::decode(&raw).context("hex decode TOKEN_ENCRYPTION_KEY")?
    } else {
        data_encoding::BASE64
            .decode(raw.as_bytes())
            .context("base64 decode TOKEN_ENCRYPTION_KEY")?
    };
    if key.len() != 32 {
        return Err(anyhow!("TOKEN_ENCRYPTION_KEY must be 32 bytes"));
    }
    Ok(key)
}

pub fn decrypt_token(stored: &str, key: &[u8]) -> Result<String> {
    let data = BASE64URL_NOPAD
        .decode(stored.as_bytes())
        .context("base64url decode token")?;
    if data.len() < IV_LEN {
        return Err(anyhow!("encrypted token too short"));
    }
    let (iv, ciphertext) = data.split_at(IV_LEN);
    let cipher = Aes256Gcm::new(aes_gcm::Key::<Aes256Gcm>::from_slice(key));
    let plaintext = cipher
        .decrypt(aes_gcm::Nonce::from_slice(iv), ciphertext)
        .map_err(|_| anyhow!("AES-GCM decryption failed"))?;
    String::from_utf8(plaintext).context("UTF-8 decode plaintext")
}
