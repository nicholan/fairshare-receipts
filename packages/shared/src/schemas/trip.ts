import * as v from "valibot";

import { ZERO_CENTS } from "../money";
import {
	centsSchema,
	currencyCodeSchema,
	displayNameSchema,
	idSchema,
	joinCodeSchema,
} from "./common";
import { itemDescriptionSchema, itemQuantitySchema } from "./receipt";

const tripNameSchema = v.pipe(
	v.string(),
	v.trim(),
	v.minLength(1, "Trip name is required"),
	v.maxLength(80, "Trip name is too long"),
);

export const tripCreateInputSchema = v.object({
	name: tripNameSchema,
	currency: v.optional(currencyCodeSchema, "EUR"),
	hostName: displayNameSchema,
	/** Extra participants invited up front; the host is added automatically. */
	participantNames: v.optional(
		v.pipe(
			v.array(displayNameSchema),
			v.maxLength(19, "Too many participants for one trip"),
		),
		[],
	),
});

export const tripJoinInputSchema = v.object({
	code: joinCodeSchema,
	displayName: displayNameSchema,
});

/** Replaces the full claim set of one item; an empty array unclaims it. */
export const claimSetInputSchema = v.object({
	itemId: idSchema,
	memberIds: v.array(idSchema),
});

/** User corrections to extracted items, validated with the same item schema. */
export const receiptItemsUpdateSchema = v.object({
	receiptId: idSchema,
	items: v.pipe(
		v.array(
			v.object({
				id: idSchema,
				description: itemDescriptionSchema,
				quantity: itemQuantitySchema,
				totalCents: centsSchema,
			}),
		),
		v.minLength(1, "A receipt needs at least one item"),
	),
	taxCents: v.optional(centsSchema, ZERO_CENTS),
	tipCents: v.optional(centsSchema, ZERO_CENTS),
	serviceChargeCents: v.optional(centsSchema, ZERO_CENTS),
	discountCents: v.optional(centsSchema, ZERO_CENTS),
});

export const settlementRecordInputSchema = v.object({
	tripId: idSchema,
	fromMemberId: idSchema,
	toMemberId: idSchema,
	amountCents: centsSchema,
});

export type TripCreateInput = v.InferOutput<typeof tripCreateInputSchema>;

export type TripJoinInput = v.InferOutput<typeof tripJoinInputSchema>;

export type ClaimSetInput = v.InferOutput<typeof claimSetInputSchema>;

export type ReceiptItemsUpdateInput = v.InferOutput<
	typeof receiptItemsUpdateSchema
>;

export type SettlementRecordInput = v.InferOutput<
	typeof settlementRecordInputSchema
>;
