PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_storage_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`oauth_token` text NOT NULL,
	`oauth_refresh_token` text NOT NULL,
	`folder_path` text DEFAULT '/AnkiCloudSync' NOT NULL,
	`connected_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_storage_connections`("id", "user_id", "provider", "oauth_token", "oauth_refresh_token", "folder_path", "connected_at") SELECT "id", "user_id", "provider", "oauth_token", "oauth_refresh_token", "folder_path", "connected_at" FROM `storage_connections`;--> statement-breakpoint
DROP TABLE `storage_connections`;--> statement-breakpoint
ALTER TABLE `__new_storage_connections` RENAME TO `storage_connections`;--> statement-breakpoint
UPDATE `storage_connections` SET `folder_path` = '/AnkiCloudSync' WHERE `folder_path` = '/AnkiSync';--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_storage_user_id` ON `storage_connections` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_storage_user_provider` ON `storage_connections` (`user_id`,`provider`);