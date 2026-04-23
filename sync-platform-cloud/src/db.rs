use anyhow::{anyhow, Context, Result};
use rusqlite::{Connection, OpenFlags, OptionalExtension};

pub fn db_path() -> Result<String> {
    let url = std::env::var("DATABASE_URL").context("DATABASE_URL not set")?;
    Ok(url.strip_prefix("file:").unwrap_or(&url).to_string())
}

fn open_ro(path: &str) -> Result<Connection> {
    Connection::open_with_flags(
        path,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .with_context(|| format!("open (ro) {path}"))
}

fn open_rw(path: &str) -> Result<Connection> {
    Connection::open_with_flags(
        path,
        OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .with_context(|| format!("open (rw) {path}"))
}

// Timing-safe: always runs bcrypt even for unknown users.
pub fn verify_sync_credentials(email: &str, password: &str) -> Result<()> {
    const DUMMY: &str = "$2b$10$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    let conn = open_ro(&db_path()?)?;
    let hash: Option<String> = conn
        .query_row(
            r#"SELECT usc.sync_password_hash
               FROM user_sync_config usc
               JOIN "user" u ON u.id = usc.user_id
               WHERE u.email = ?1 LIMIT 1"#,
            rusqlite::params![email],
            |r| r.get(0),
        )
        .optional()
        .context("query user_sync_config")?
        .flatten();
    let ok = bcrypt::verify(password, hash.as_deref().unwrap_or(DUMMY)).unwrap_or(false);
    if hash.is_none() || !ok {
        return Err(anyhow!("invalid credentials"));
    }
    Ok(())
}

pub fn store_sync_key(email: &str, hkey: &str) -> Result<()> {
    let conn = open_rw(&db_path()?)?;
    conn.execute(
        r#"INSERT INTO user_sync_state (id, user_id, sync_key)
           SELECT lower(hex(randomblob(16))), u.id, ?2
           FROM "user" u WHERE u.email = ?1
           ON CONFLICT (user_id) DO UPDATE SET sync_key = excluded.sync_key"#,
        rusqlite::params![email, hkey],
    )
    .context("upsert sync key")?;
    Ok(())
}

pub fn lookup_user_by_sync_key(hkey: &str) -> Result<String> {
    let conn = open_ro(&db_path()?)?;
    conn.query_row(
        r#"SELECT u.email
           FROM "user" u
           JOIN user_sync_state s ON s.user_id = u.id
           WHERE s.sync_key = ?1 LIMIT 1"#,
        rusqlite::params![hkey],
        |r| r.get(0),
    )
    .context("no user found for sync key")
}

/// Returns (provider, Option<encrypted_refresh_token>, folder_path).
pub fn fetch_storage_connection(email: &str) -> Result<(String, Option<String>, String)> {
    let conn = open_ro(&db_path()?)?;
    conn.query_row(
        r#"SELECT sc.provider, sc.oauth_refresh_token, sc.folder_path
           FROM user_storage_connection sc
           JOIN "user" u ON u.id = sc.user_id
           WHERE u.email = ?1 LIMIT 1"#,
        rusqlite::params![email],
        |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
    )
    .with_context(|| format!("no storage connection for '{email}'"))
}
