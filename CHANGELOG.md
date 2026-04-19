# Changelog

## [0.1.1](https://github.com/danielpmichalski/anki-cloud/compare/anki-cloud-v0.1.0...anki-cloud-v0.1.1) (2026-04-19)


### Features

* add API key management routes ([55b2677](https://github.com/danielpmichalski/anki-cloud/commit/55b26770f8a396f4ba1b8d23b39f9390b73154f1))
* add bearer token authentication to OpenAPI spec ([b911add](https://github.com/danielpmichalski/anki-cloud/commit/b911addffeddeffa2a22f802ba1ca839415859c7))
* add cards API with sidecar integration, enhance pagination and error handling ([ee1b8b7](https://github.com/danielpmichalski/anki-cloud/commit/ee1b8b7f64eda8dc4293f84ee796b770c0a6fd39))
* add decks and notes APIs with sidecar integration, update Docker and env configs ([a56cd58](https://github.com/danielpmichalski/anki-cloud/commit/a56cd580043875a5a731f329651da071a423e38c))
* add Docker support with example environment file for Anki sync server deployment ([71b0792](https://github.com/danielpmichalski/anki-cloud/commit/71b0792160d064f208fdff3c7aaab59915815eb5))
* add endpoint to update storage folder path and adjust default folder path to "/AnkiCloudSync" ([834476b](https://github.com/danielpmichalski/anki-cloud/commit/834476b828b6c11e910f2c5df62a37bab2a58d0a))
* add Google Drive OAuth integration and storage management routes ([6e10004](https://github.com/danielpmichalski/anki-cloud/commit/6e10004bfb9b018625849f8abcb398b950e31894))
* add Google OAuth integration with authentication routes and JWT session handling ([2b24f0e](https://github.com/danielpmichalski/anki-cloud/commit/2b24f0e78b663cc4642d7720eb37131c1fbfb5f6))
* add language translations for Anki desktop ftl files ([90c7745](https://github.com/danielpmichalski/anki-cloud/commit/90c7745656b2a60362a7255360d5f566e4b6311c))
* add note-types API with routes for listing and retrieving note types ([a560212](https://github.com/danielpmichalski/anki-cloud/commit/a560212908db1eb5ab54ee5c5abcdc4d0ebfcba3))
* add OpenAPI documentation and API reference page ([3581f00](https://github.com/danielpmichalski/anki-cloud/commit/3581f000b7bfb5c531fb5a83b47d4f10dcf6c6cd))
* add script to fork/upgrade anki-sync-server to a specified Ankitects tag ([b470a3f](https://github.com/danielpmichalski/anki-cloud/commit/b470a3f7689a84d558744df44c2bb4faeef725e1))
* add setup script for macOS dev environment with Homebrew, Rust, Bun, and protoc ([bcdda4f](https://github.com/danielpmichalski/anki-cloud/commit/bcdda4fd030073f2f59564b1a5d143ad54987542))
* add storage connect and disconnect routes for third-party providers ([f872622](https://github.com/danielpmichalski/anki-cloud/commit/f87262217456d60985e53833df173653785e0a89))
* add support for copying ftl directory from Ankitects repository ([4eb0afa](https://github.com/danielpmichalski/anki-cloud/commit/4eb0afa7b2cf907d19fee77048b063a9b7ca1100))
* add sync password management and per-request Google token integration ([a2c1c38](https://github.com/danielpmichalski/anki-cloud/commit/a2c1c38cfe56261114882e531ffdcd4af4c1d56a))
* fork the whole rslib (i.e., anki-sync-server in Rust) directory from the official Ankitects repository (v25.09) ([01f8b9a](https://github.com/danielpmichalski/anki-cloud/commit/01f8b9a04d318454de3db626bc8dafd4d9e907bb))
* implement Google Drive storage backend with OAuth support, file handling, and resumable uploads ([4293e84](https://github.com/danielpmichalski/anki-cloud/commit/4293e842560e583ad4d0bcf6cf49f7323a47365f))
* initialize API package with Hono, TypeScript, and essential dependencies ([c35e8a0](https://github.com/danielpmichalski/anki-cloud/commit/c35e8a0d610fbf2dc40e1594abe9794d2969a2b6))
* initialize web client for account and API key management ([9a3957f](https://github.com/danielpmichalski/anki-cloud/commit/9a3957fffb245dc180224047ee38473fc357a8f8))
* integrate modular storage backend with support for syncing collections and updating environment variables ([88bbb64](https://github.com/danielpmichalski/anki-cloud/commit/88bbb64197caa2b81ba1ea563653b765f865cf92))
* introduce ftl structure for Anki translations and related tooling ([ed8c65f](https://github.com/danielpmichalski/anki-cloud/commit/ed8c65fdaaf6b512ef8c9584428c7a7109e9d6b6))
* introduce modular storage backends with `sync-storage-api` and `sync-storage-backends` crates ([08b87c4](https://github.com/danielpmichalski/anki-cloud/commit/08b87c4fdc2704146bac75333a121b5fa01fa547))
* introduce SQLite schema, encryption utilities, and migration system for sync server ([e685952](https://github.com/danielpmichalski/anki-cloud/commit/e685952bb408a2554338c892dc3b07d7cebb3514))
* rename `authMiddleware` to `authWebMiddleware` and add new `authApiMiddleware` for the REST API endpoints ([988b5b4](https://github.com/danielpmichalski/anki-cloud/commit/988b5b42d77cbf490f204afcd880fa2246d13732))
* segregate public REST API from main app, add OpenAPI spec route and docs endpoint ([27a3d9e](https://github.com/danielpmichalski/anki-cloud/commit/27a3d9e3b79c1a53ceb0cbd653d886a245a64123))


### Bug Fixes

* add `.version` file handling in sync script ([ce0b931](https://github.com/danielpmichalski/anki-cloud/commit/ce0b931ea479163a6567a953afd77e62136faf82))
* add schema export in db package and handle stale users in sync server ([9129463](https://github.com/danielpmichalski/anki-cloud/commit/9129463e221767f073090d4db97cea169c0a1d4c))
* add TOKEN_ENCRYPTION_KEY to docker-compose environment variables ([b65599c](https://github.com/danielpmichalski/anki-cloud/commit/b65599c4ae6cc0262bda89dc5461b31d3360c26b))
* **ci:** add step to install web dependencies in CI workflow ([5f00bda](https://github.com/danielpmichalski/anki-cloud/commit/5f00bda2d09882c55a6ae16099e215c83a12bc43))
* ensure data directory is created before running db:migrate script ([4ff72ac](https://github.com/danielpmichalski/anki-cloud/commit/4ff72acdd49eaaeeeab3a779e4b9b731d525bb26))
* fix Rust installation in setup script with safer PATH handling and explicit zshrc updates ([c52730c](https://github.com/danielpmichalski/anki-cloud/commit/c52730c4bb49a59d444a767f2c05a77c2d657bfb))
* fork missing anki-sync-server parts ([2a9b369](https://github.com/danielpmichalski/anki-cloud/commit/2a9b3697338752f4c9253728d540d06935936dd9))
* handle Google Drive API errors by checking response status before processing body ([cd4da59](https://github.com/danielpmichalski/anki-cloud/commit/cd4da59c929011e6d346b8418a448a2b50747f59))
* handle resumable upload initiation for existing files in Google Drive and improve error handling ([7b45af9](https://github.com/danielpmichalski/anki-cloud/commit/7b45af9a644eefd2ebe26fcee69818d2789734e4))
* initialize ftl submodules and add proto directory handling in sync script ([333401c](https://github.com/danielpmichalski/anki-cloud/commit/333401c1c45d4ed2c6fa13e4e74ce21608940841))
* invalidate sync key on password reset and validate against DB in sync server ([02fff6d](https://github.com/danielpmichalski/anki-cloud/commit/02fff6dd462fa441413f8e44dadad3281840035e))
* pass .env file to scripts in db and api packages ([cb11496](https://github.com/danielpmichalski/anki-cloud/commit/cb114961ecb0f20185ce5dea22b1b9040702a155))
* update default database path to reflect new data directory location ([a665d01](https://github.com/danielpmichalski/anki-cloud/commit/a665d012e863a463f47f1760d3d7d6ca8466b035))
* update smoke test to use correct ports and updated search tag ([9abc5c3](https://github.com/danielpmichalski/anki-cloud/commit/9abc5c343fc6f782d6a2fb72423985beb4febdfa))
* update tsconfig paths to include `@anki-cloud/db` aliases ([2391463](https://github.com/danielpmichalski/anki-cloud/commit/23914632a0f7f133c61d3a5e113af4042f3ceef3))
* use OpenAPIRegistry to register security schemes, so Scalar docs UI can be used to test REST API with proper Auth method ([cc89657](https://github.com/danielpmichalski/anki-cloud/commit/cc896573438898ed0a031882395a295d308d1197))
