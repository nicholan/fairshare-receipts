import * as v from "valibot";

import { type Cents, sumCents, toCents, ZERO_CENTS } from "../money";
import { centsSchema, currencyCodeSchema } from "./common";

const ISO_DATE_OR_TIMESTAMP = /^\d{4}-\d{2}-\d{2}(?:[T ].*)?$/;

export const itemDescriptionSchema = v.pipe(
	v.string(),
	v.trim(),
	v.minLength(1, "Item description is required"),
	v.maxLength(200, "Item description is too long"),
);

export const itemQuantitySchema = v.pipe(
	v.number(),
	v.minValue(0, "Quantity cannot be negative"),
	v.maxValue(999, "Quantity is unrealistically large"),
);

export const extractedItemSchema = v.object({
	description: itemDescriptionSchema,
	quantity: itemQuantitySchema,
	unitPriceCents: centsSchema,
	totalCents: centsSchema,
});

/**
 * The contract for LLM receipt extraction. Keep this authoritative: the model
 * output is parsed against it and user corrections are validated with it too.
 */
export const receiptExtractionSchema = v.object({
	merchant: v.optional(v.nullable(v.pipe(v.string(), v.maxLength(120)))),
	purchasedAt: v.optional(
		v.nullable(v.pipe(v.string(), v.regex(ISO_DATE_OR_TIMESTAMP))),
	),
	currency: v.optional(currencyCodeSchema, "EUR"),
	items: v.pipe(
		v.array(extractedItemSchema),
		v.minLength(1, "A receipt needs at least one item"),
	),
	taxCents: v.optional(centsSchema, ZERO_CENTS),
	tipCents: v.optional(centsSchema, ZERO_CENTS),
	serviceChargeCents: v.optional(centsSchema, ZERO_CENTS),
	/** Absolute, non-negative discount. */
	discountCents: v.optional(centsSchema, ZERO_CENTS),
	totalCents: centsSchema,
});

export type ExtractedItem = v.InferOutput<typeof extractedItemSchema>;

export type ReceiptExtraction = v.InferOutput<typeof receiptExtractionSchema>;

export type ReceiptExtractionInput = v.InferInput<
	typeof receiptExtractionSchema
>;

export interface ExtractionReconciliation {
	readonly itemsCents: Cents;
	readonly extrasCents: Cents;
	/** items + tax + tip + service - discount */
	readonly computedTotalCents: Cents;
	readonly declaredTotalCents: Cents;
	/** declared - computed; non-zero means the extraction needs review. */
	readonly discrepancyCents: Cents;
	readonly reconciles: boolean;
}

/**
 * Checks that the extracted line items actually add up to the printed total.
 * LLMs routinely drop a line, so this is surfaced to the user instead of
 * silently trusting the model.
 */
export function reconcileExtraction(
	extraction: ReceiptExtraction,
): ExtractionReconciliation {
	const itemsCents = sumCents(extraction.items.map((item) => item.totalCents));
	const extrasCents = toCents(
		extraction.taxCents +
			extraction.tipCents +
			extraction.serviceChargeCents -
			extraction.discountCents,
	);
	const computedTotalCents = toCents(itemsCents + extrasCents);
	const discrepancyCents = toCents(extraction.totalCents - computedTotalCents);

	return {
		itemsCents,
		extrasCents,
		computedTotalCents,
		declaredTotalCents: extraction.totalCents,
		discrepancyCents,
		reconciles: discrepancyCents === ZERO_CENTS,
	};
}

export type ReceiptValidationResult =
	| {
			readonly ok: true;
			readonly value: ReceiptExtraction;
			readonly reconciliation: ExtractionReconciliation;
	  }
	| { readonly ok: false; readonly issues: readonly string[] };

/** Validates raw (LLM or user supplied) data against the extraction contract. */
export function validateReceiptExtraction(
	input: unknown,
): ReceiptValidationResult {
	const result = v.safeParse(receiptExtractionSchema, input);

	if (!result.success) {
		return {
			ok: false,
			issues: result.issues.map((issue) => issue.message ?? "Invalid value"),
		};
	}

	return {
		ok: true,
		value: result.output,
		reconciliation: reconcileExtraction(result.output),
	};
}
