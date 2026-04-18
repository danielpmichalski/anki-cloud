CREATE TABLE `storage_connections`
(
    `id`                  text PRIMARY KEY         NOT NULL,
    `user_id`             text                     NOT NULL,
    `provider`            text                     NOT NULL,
    `oauth_token`         text                     NOT NULL,
    `oauth_refresh_token` text                     NOT NULL,
    `folder_path`         text DEFAULT '/AnkiSync' NOT NULL,
    `connected_at`        integer                  NOT NULL,
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_storage_user_id` ON `storage_connections` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_storage_user_provider` ON `storage_connections` (`user_id`, `provider`);--> statement-breakpoint
CREATE TABLE `users`
(
    `id`         text PRIMARY KEY NOT NULL,
    `google_sub` text             NOT NULL,
    `email`      text,
    `name`       text,
    `created_at` integer          NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_google_sub_unique` ON `users` (`google_sub`);--> statement-breakpoint
CREATE TABLE `users_api_keys`
(
    `id`           text PRIMARY KEY NOT NULL,
    `user_id`      text             NOT NULL,
    `key_hash`     text             NOT NULL,
    `label`        text             NOT NULL,
    `last_used_at` integer,
    `created_at`   integer          NOT NULL,
    `revoked_at`   integer,
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_api_keys_user_id` ON `users_api_keys` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_api_keys_hash` ON `users_api_keys` (`key_hash`);--> statement-breakpoint
CREATE TABLE `users_sync_state`
(
    `id`             text PRIMARY KEY NOT NULL,
    `user_id`        text             NOT NULL,
    `last_sync_at`   integer,
    `client_version` text,
    `sync_key`       text,
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_sync_state_user_id_unique` ON `users_sync_state` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_sync_state_user_id` ON `users_sync_state` (`user_id`);