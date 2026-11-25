import { sql } from "drizzle-orm";
import {
	check,
	index,
	integer,
	primaryKey,
	real,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * D1 / SQLite schema for FairShare Receipts.
 *
 * Amounts are integer cents of the single supported currency, EUR (ADR-0006).
 * The `currency` check is a database-level backstop: shared Valibot schemas
 * reject non-EUR values first, but a bad write must not bypass them.
 *
 * Identity is intentionally not modelled here. A trip member is an opaque
 * participant record; how a device or account authenticates as that member is
 * still an open decision (see docs/architecture.md section 10).
 */

export const trips = sqliteTable(
	"trips",
	{
		id: text("id").primaryKey(),
		name: text("name").notNull(),
		/** Must match SUPPORTED_CURRENCY_CODE in @fairshare/shared (ADR-0006). */
		currency: text("currency", { enum: ["EUR"] }).notNull(),
		joinCode: text("join_code").notNull(),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [
		uniqueIndex("trips_join_code_unique").on(table.joinCode),
		check("trips_currency_eur", sql`${table.currency} = 'EUR'`),
	],
);

export const tripMembers = sqliteTable(
	"trip_members",
	{
		id: text("id").primaryKey(),
		tripId: text("trip_id")
			.notNull()
			.references(() => trips.id, { onDelete: "cascade" }),
		displayName: text("display_name").notNull(),
		isHost: integer("is_host", { mode: "boolean" }).notNull().default(false),
		joinedAt: integer("joined_at", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [index("trip_members_trip_id_idx").on(table.tripId)],
);

export const receipts = sqliteTable(
	"receipts",
	{
		id: text("id").primaryKey(),
		tripId: text("trip_id")
			.notNull()
			.references(() => trips.id, { onDelete: "cascade" }),
		merchant: text("merchant"),
		/** Date or timestamp as printed on the receipt, not a database time. */
		purchasedAt: text("purchased_at"),
		/** R2 object key; null until the upload flow lands. */
		imageKey: text("image_key"),
		taxCents: integer("tax_cents").notNull().default(0),
		tipCents: integer("tip_cents").notNull().default(0),
		serviceChargeCents: integer("service_charge_cents").notNull().default(0),
		discountCents: integer("discount_cents").notNull().default(0),
		totalCents: integer("total_cents").notNull(),
		/**
		 * Null until a user has reviewed and confirmed the extracted data.
		 * Only confirmed receipts may feed collaborative allocation (ADR-0005).
		 */
		confirmedAt: integer("confirmed_at", { mode: "timestamp_ms" }),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [
		index("receipts_trip_id_idx").on(table.tripId),
		check(
			"receipts_amounts_non_negative",
			sql`${table.taxCents} >= 0 AND ${table.tipCents} >= 0 AND ${table.serviceChargeCents} >= 0 AND ${table.discountCents} >= 0 AND ${table.totalCents} >= 0`,
		),
	],
);

export const receiptItems = sqliteTable(
	"receipt_items",
	{
		id: text("id").primaryKey(),
		receiptId: text("receipt_id")
			.notNull()
			.references(() => receipts.id, { onDelete: "cascade" }),
		description: text("description").notNull(),
		/** Not money: quantities may be fractional (for example 0.5 kg). */
		quantity: real("quantity").notNull().default(1),
		unitPriceCents: integer("unit_price_cents").notNull(),
		totalCents: integer("total_cents").notNull(),
		sortOrder: integer("sort_order").notNull().default(0),
	},
	(table) => [
		index("receipt_items_receipt_id_idx").on(table.receiptId),
		check(
			"receipt_items_amounts_non_negative",
			sql`${table.unitPriceCents} >= 0 AND ${table.totalCents} >= 0`,
		),
		check(
			"receipt_items_quantity_range",
			sql`${table.quantity} >= 0 AND ${table.quantity} <= 999`,
		),
	],
);

export const itemClaims = sqliteTable(
	"item_claims",
	{
		itemId: text("item_id")
			.notNull()
			.references(() => receiptItems.id, { onDelete: "cascade" }),
		memberId: text("member_id")
			.notNull()
			.references(() => tripMembers.id, { onDelete: "cascade" }),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.itemId, table.memberId] }),
		index("item_claims_member_id_idx").on(table.memberId),
	],
);

export const settlements = sqliteTable(
	"settlements",
	{
		id: text("id").primaryKey(),
		tripId: text("trip_id")
			.notNull()
			.references(() => trips.id, { onDelete: "cascade" }),
		fromMemberId: text("from_member_id")
			.notNull()
			.references(() => tripMembers.id, { onDelete: "cascade" }),
		toMemberId: text("to_member_id")
			.notNull()
			.references(() => tripMembers.id, { onDelete: "cascade" }),
		amountCents: integer("amount_cents").notNull(),
		recordedAt: integer("recorded_at", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [
		index("settlements_trip_id_idx").on(table.tripId),
		check("settlements_amount_positive", sql`${table.amountCents} > 0`),
		check(
			"settlements_members_differ",
			sql`${table.fromMemberId} <> ${table.toMemberId}`,
		),
	],
);

export type Trip = typeof trips.$inferSelect;
export type NewTrip = typeof trips.$inferInsert;

export type TripMember = typeof tripMembers.$inferSelect;
export type NewTripMember = typeof tripMembers.$inferInsert;

export type Receipt = typeof receipts.$inferSelect;
export type NewReceipt = typeof receipts.$inferInsert;

export type ReceiptItem = typeof receiptItems.$inferSelect;
export type NewReceiptItem = typeof receiptItems.$inferInsert;

export type ItemClaim = typeof itemClaims.$inferSelect;
export type NewItemClaim = typeof itemClaims.$inferInsert;

export type Settlement = typeof settlements.$inferSelect;
export type NewSettlement = typeof settlements.$inferInsert;
