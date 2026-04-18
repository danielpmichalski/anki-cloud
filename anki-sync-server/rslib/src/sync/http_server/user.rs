// Copyright: Ankitects Pty Ltd and contributors
// License: GNU AGPL, version 3 or later; http://www.gnu.org/licenses/agpl.html

use std::path::PathBuf;

use tracing::info;

use crate::collection::Collection;
use crate::collection::CollectionBuilder;
use crate::error;
use crate::sync::collection::start::ServerSyncState;
use crate::sync::error::HttpResult;
use crate::sync::error::OrHttpErr;
use crate::sync::http_server::media_manager::ServerMediaManager;

pub(in crate::sync) struct User {
    pub name: String,
    pub password_hash: String,
    pub col: Option<Collection>,
    pub sync_state: Option<ServerSyncState>,
    pub media: ServerMediaManager,
    pub folder: PathBuf,
}

impl User {
    /// Run op with access to the collection. If a sync is active, it's aborted.
    pub(crate) fn with_col<F, T>(&mut self, op: F) -> HttpResult<T>
    where
        F: FnOnce(&mut Collection) -> HttpResult<T>,
    {
        self.abort_stateful_sync_if_active();
        self.ensure_col_open()?;
        op(self.col.as_mut().unwrap())
    }

    /// Run op with the existing sync state created by start_new_sync(). If
    /// there is no existing state, or the current state's key does not
    /// match, abort the request with a conflict.
    pub(crate) fn with_sync_state<F, T>(&mut self, skey: &str, op: F) -> HttpResult<T>
    where
        F: FnOnce(&mut Collection, &mut ServerSyncState) -> error::Result<T>,
    {
        match &self.sync_state {
            None => None.or_conflict("no active sync")?,
            Some(state) => {
                if state.skey != skey {
                    None.or_conflict("active sync with different key")?;
                }
            }
        };

        self.ensure_col_open()?;
        let state = self.sync_state.as_mut().unwrap();
        let col = self.col.as_mut().or_internal_err("open col")?;
        // Failures in a sync op are usually caused by referential integrity issues (eg
        // they've sent a note without sending its associated notetype).
        // Returning HTTP 400 will inform the client that a DB check+full sync
        // is required to fix the issue.
        op(col, state)
            .inspect_err(|_e| {
                self.col = None;
                self.sync_state = None;
            })
            .or_bad_request("op failed in sync_state")
    }

    pub(crate) fn abort_stateful_sync_if_active(&mut self) {
        if self.sync_state.is_some() {
            info!("aborting active sync");
            self.sync_state = None;
            self.col = None;
        }
    }

    pub(crate) fn start_new_sync(&mut self, skey: &str) -> HttpResult<()> {
        self.abort_stateful_sync_if_active();
        self.sync_state = Some(ServerSyncState::new(skey));
        Ok(())
    }

    pub(crate) fn ensure_col_open(&mut self) -> HttpResult<()> {
        if self.col.is_none() {
            self.col = Some(self.open_collection()?);
        }
        Ok(())
    }

    fn open_collection(&mut self) -> HttpResult<Collection> {
        use sync_storage_backends::StorageBackendFactory;

        use sync_storage_config as db;

        let (provider, refresh_token) = db::fetch_storage_connection(&self.name)
            .or_internal_err("lookup storage connection")?;
        let access_token = if provider == "local" {
            String::new()
        } else {
            tokio::task::block_in_place(|| {
                tokio::runtime::Handle::current()
                    .block_on(db::exchange_refresh_token(&refresh_token))
            })
            .or_internal_err("exchange refresh token")?
        };

        let col_path = self.folder.join("collection.anki2");
        let backend = StorageBackendFactory::create(&provider, &access_token)
            .or_internal_err("create storage backend")?;
        backend
            .fetch(&self.name, &col_path)
            .or_internal_err("fetch collection from storage")?;
        CollectionBuilder::new(col_path)
            .set_server(true)
            .build()
            .or_internal_err("open collection")
    }
}
