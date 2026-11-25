CREATE TABLE `item_claims` (
	`item_id` text NOT NULL,
	`member_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`item_id`, `member_id`),
	FOREIGN KEY (`item_id`) REFERENCES `receipt_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `trip_members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `item_claims_member_id_idx` ON `item_claims` (`member_id`);--> statement-breakpoint
CREATE TABLE `receipt_items` (
	`id` text PRIMARY KEY NOT NULL,
	`receipt_id` text NOT NULL,
	`description` text NOT NULL,
	`quantity` real DEFAULT 1 NOT NULL,
	`unit_price_cents` integer NOT NULL,
	`total_cents` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`receipt_id`) REFERENCES `receipts`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "receipt_items_amounts_non_negative" CHECK("receipt_items"."unit_price_cents" >= 0 AND "receipt_items"."total_cents" >= 0),
	CONSTRAINT "receipt_items_quantity_range" CHECK("receipt_items"."quantity" >= 0 AND "receipt_items"."quantity" <= 999)
);
--> statement-breakpoint
CREATE INDEX `receipt_items_receipt_id_idx` ON `receipt_items` (`receipt_id`);--> statement-breakpoint
CREATE TABLE `receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`merchant` text,
	`purchased_at` text,
	`image_key` text,
	`tax_cents` integer DEFAULT 0 NOT NULL,
	`tip_cents` integer DEFAULT 0 NOT NULL,
	`service_charge_cents` integer DEFAULT 0 NOT NULL,
	`discount_cents` integer DEFAULT 0 NOT NULL,
	`total_cents` integer NOT NULL,
	`confirmed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "receipts_amounts_non_negative" CHECK("receipts"."tax_cents" >= 0 AND "receipts"."tip_cents" >= 0 AND "receipts"."service_charge_cents" >= 0 AND "receipts"."discount_cents" >= 0 AND "receipts"."total_cents" >= 0)
);
--> statement-breakpoint
CREATE INDEX `receipts_trip_id_idx` ON `receipts` (`trip_id`);--> statement-breakpoint
CREATE TABLE `settlements` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`from_member_id` text NOT NULL,
	`to_member_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`recorded_at` integer NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_member_id`) REFERENCES `trip_members`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`to_member_id`) REFERENCES `trip_members`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "settlements_amount_positive" CHECK("settlements"."amount_cents" > 0),
	CONSTRAINT "settlements_members_differ" CHECK("settlements"."from_member_id" <> "settlements"."to_member_id")
);
--> statement-breakpoint
CREATE INDEX `settlements_trip_id_idx` ON `settlements` (`trip_id`);--> statement-breakpoint
CREATE TABLE `trip_members` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`display_name` text NOT NULL,
	`is_host` integer DEFAULT false NOT NULL,
	`joined_at` integer NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `trip_members_trip_id_idx` ON `trip_members` (`trip_id`);--> statement-breakpoint
CREATE TABLE `trips` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`currency` text NOT NULL,
	`join_code` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT "trips_currency_eur" CHECK("trips"."currency" = 'EUR')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trips_join_code_unique` ON `trips` (`join_code`);