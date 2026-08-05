CREATE TABLE `photos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`r2_key` text NOT NULL,
	`filename` text NOT NULL,
	`title` text DEFAULT 'Untitled' NOT NULL,
	`category` text DEFAULT 'Unsorted' NOT NULL,
	`labels` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`width` integer,
	`height` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `photos_r2_key_unique` ON `photos` (`r2_key`);