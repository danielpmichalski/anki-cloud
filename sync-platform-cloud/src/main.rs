use std::sync::Arc;

use anki::sync::http_server::{SimpleServer, SyncServerConfig};
use snafu::{ResultExt, Whatever};
use sync_platform_cloud::{CloudAuthProvider, CloudBackendResolver};
use sync_storage_server::InternalServer;

#[snafu::report]
#[tokio::main]
async fn main() -> anki::error::Result<(), Whatever> {
    let config = envy::prefixed("SYNC_")
        .from_env::<SyncServerConfig>()
        .whatever_context("reading SYNC_* env vars")?;

    let auth = Arc::new(CloudAuthProvider);
    let resolver = Arc::new(CloudBackendResolver);

    let server = Arc::new(
        SimpleServer::new(&config.base_folder, auth, resolver)
            .whatever_context("create SimpleServer")?,
    );

    if let Some(token) = config.internal_token.clone() {
        let sidecar = InternalServer::new(Arc::clone(&server), token);
        let port = config.internal_port;
        let host = config.internal_host.clone();
        tokio::spawn(async move { sidecar.run(host, port).await });
    }

    let (_addr, server_fut) = SimpleServer::make_server(config, server)
        .await
        .whatever_context("start server")?;
    server_fut.await.whatever_context("server error")?;
    Ok(())
}
