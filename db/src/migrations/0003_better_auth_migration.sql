-- Migration: Better Auth + table rename to singular convention
-- Better Auth tables (user, session, account, verification) replace hand-rolled auth.
-- App tables renamed to user_* prefix convention.
-- sync_password_hash extracted from users → user_sync_config.
-- storage_connections → user_storage_connection
-- users_api_keys     → user_api_key
-- users_sync_state   → user_sync_state

PRAGMA foreign_keys = OFF;
--> statement-breakpoint

-- ── Better Auth tables ────────────────────────────────────────────────────────

CREATE TABLE `user` (
  `id`             text    PRIMARY KEY NOT NULL,
  `name`           text    NOT NULL,
  `email`          text    NOT NULL,
  `email_verified` integer NOT NULL,
  `image`          text,
  `created_at`     integer NOT NULL,
  `updated_at`     integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);
--> statement-breakpoint

CREATE TABLE `session` (
  `id`          text    PRIMARY KEY NOT NULL,
  `user_id`     text    NOT NULL,
  `token`       text    NOT NULL,
  `expires_at`  integer NOT NULL,
  `ip_address`  text,
  `user_agent`  text,
  `created_at`  integer NOT NULL,
  `updated_at`  integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);
--> statement-breakpoint

CREATE TABLE `account` (
  `id`                        text    PRIMARY KEY NOT NULL,
  `user_id`                   text    NOT NULL,
  `account_id`                text    NOT NULL,
  `provider_id`               text    NOT NULL,
  `access_token`              text,
  `refresh_token`             text,
  `access_token_expires_at`   integer,
  `refresh_token_expires_at`  integer,
  `scope`                     text,
  `id_token`                  text,
  `password`                  text,
  `created_at`                integer NOT NULL,
  `updated_at`                integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
);
--> statement-breakpoint

CREATE TABLE `verification` (
  `id`          text    PRIMARY KEY NOT NULL,
  `identifier`  text    NOT NULL,
  `value`       text    NOT NULL,
  `expires_at`  integer NOT NULL,
  `created_at`  integer,
  `updated_at`  integer
);
--> statement-breakpoint

-- ── Migrate users → user + account ───────────────────────────────────────────

INSERT INTO `user` (`id`, `name`, `email`, `email_verified`, `image`, `created_at`, `updated_at`)
SELECT
  `id`,
  COALESCE(`name`, ''),
  COALESCE(`email`, ''),
  1,
  NULL,
  `created_at`,
  `created_at`
FROM `users`;
--> statement-breakpoint

-- googleSub migrates to the account table as accountId with providerId='google'
INSERT INTO `account` (`id`, `user_id`, `account_id`, `provider_id`, `created_at`, `updated_at`)
SELECT
  lower(hex(randomblob(16))),
  `id`,
  `google_sub`,
  'google',
  `created_at`,
  `created_at`
FROM `users`;
--> statement-breakpoint

-- ── user_sync_config (sync_password_hash extracted from users) ────────────────

CREATE TABLE `user_sync_config` (
  `id`                 text PRIMARY KEY NOT NULL,
  `user_id`            text NOT NULL,
  `sync_password_hash` text,
  FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_sync_config_user_id_unique` ON `user_sync_config` (`user_id`);
--> statement-breakpoint

INSERT INTO `user_sync_config` (`id`, `user_id`, `sync_password_hash`)
SELECT lower(hex(randomblob(16))), `id`, `sync_password_hash`
FROM `users`
WHERE `sync_password_hash` IS NOT NULL;
--> statement-breakpoint

-- ── user_storage_connection (renamed from storage_connections) ────────────────

CREATE TABLE `user_storage_connection` (
  `id`                  text    PRIMARY KEY NOT NULL,
  `user_id`             text    NOT NULL,
  `provider`            text    NOT NULL,
  `oauth_token`         text    NOT NULL,
  `oauth_refresh_token` text    NOT NULL,
  `folder_path`         text    DEFAULT '/AnkiCloudSync' NOT NULL,
  `connected_at`        integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_storage_user_provider` ON `user_storage_connection` (`user_id`, `provider`);
--> statement-breakpoint
CREATE INDEX `idx_storage_user_id` ON `user_storage_connection` (`user_id`);
--> statement-breakpoint

INSERT INTO `user_storage_connection`
  (`id`, `user_id`, `provider`, `oauth_token`, `oauth_refresh_token`, `folder_path`, `connected_at`)
SELECT
  `id`, `user_id`,
  CASE `provider` WHEN 'gdrive' THEN 'google' ELSE `provider` END,
  `oauth_token`, `oauth_refresh_token`, `folder_path`, `connected_at`
FROM `storage_connections`;
--> statement-breakpoint

-- ── user_api_key (renamed from users_api_keys) ───────────────────────────────

CREATE TABLE `user_api_key` (
  `id`           text    PRIMARY KEY NOT NULL,
  `user_id`      text    NOT NULL,
  `key_hash`     text    NOT NULL,
  `label`        text    NOT NULL,
  `last_used_at` integer,
  `created_at`   integer NOT NULL,
  `revoked_at`   integer,
  FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `idx_api_key_user_id` ON `user_api_key` (`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_api_key_hash` ON `user_api_key` (`key_hash`);
--> statement-breakpoint

INSERT INTO `user_api_key`
  (`id`, `user_id`, `key_hash`, `label`, `last_used_at`, `created_at`, `revoked_at`)
SELECT `id`, `user_id`, `key_hash`, `label`, `last_used_at`, `created_at`, `revoked_at`
FROM `users_api_keys`;
--> statement-breakpoint

-- ── user_sync_state (renamed from users_sync_state) ──────────────────────────

CREATE TABLE `user_sync_state` (
  `id`             text PRIMARY KEY NOT NULL,
  `user_id`        text NOT NULL,
  `last_sync_at`   integer,
  `client_version` text,
  `sync_key`       text,
  FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_sync_state_user_id_unique` ON `user_sync_state` (`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_sync_state_user_id` ON `user_sync_state` (`user_id`);
--> statement-breakpoint

INSERT INTO `user_sync_state`
  (`id`, `user_id`, `last_sync_at`, `client_version`, `sync_key`)
SELECT `id`, `user_id`, `last_sync_at`, `client_version`, `sync_key`
FROM `users_sync_state`;
--> statement-breakpoint

-- ── Drop old tables ───────────────────────────────────────────────────────────

DROP TABLE `users_sync_state`;
--> statement-breakpoint
DROP TABLE `users_api_keys`;
--> statement-breakpoint
DROP TABLE `storage_connections`;
--> statement-breakpoint
DROP TABLE `users`;
--> statement-breakpoint

PRAGMA foreign_keys = ON;
