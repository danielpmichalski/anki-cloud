-- Single-use, 5-minute tokens for the media upload page (/upload/<token>). Only the token's SHA-256 is stored.
CREATE TABLE `media_upload_token` (
  `id`         text    PRIMARY KEY NOT NULL,
  `user_id`    text    NOT NULL,
  `token_hash` text    NOT NULL,
  `expires_at` integer NOT NULL,
  `used_at`    integer,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_upload_token_token_hash_unique` ON `media_upload_token` (`token_hash`);
--> statement-breakpoint
CREATE INDEX `idx_media_upload_token_user_id` ON `media_upload_token` (`user_id`);
