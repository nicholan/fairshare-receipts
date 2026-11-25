import * as v from "valibot";

import {
	type Cents,
	MAX_AMOUNT_CENTS,
	SUPPORTED_CURRENCY_CODE,
} from "../money";

/** Integer cents, bounded to a realistic receipt amount. Output is branded. */
export const centsSchema = v.pipe(
	v.number(),
	v.integer("Amount must be an integer number of cents"),
	v.minValue(0, "Amount cannot be negative"),
	v.maxValue(MAX_AMOUNT_CENTS, "Amount is unrealistically large"),
	v.transform((value) => value as Cents),
);

/**
 * ISO 4217 currency code. EUR is the only supported currency until
 * multi-currency and minor-unit handling are designed (ADR-0006). Currency is
 * always explicit: there is no implicit default to guess from.
 */
export const currencyCodeSchema = v.literal(
	SUPPORTED_CURRENCY_CODE,
	"Only EUR is supported; multi-currency is not implemented yet",
);

export const idSchema = v.pipe(
	v.string(),
	v.minLength(1, "Id is required"),
	v.maxLength(64, "Id is too long"),
);

export const displayNameSchema = v.pipe(
	v.string(),
	v.trim(),
	v.minLength(1, "Name is required"),
	v.maxLength(40, "Name is too long"),
);

/** Unambiguous alphabet for join codes: no 0/O, 1/I/L. */
export const JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const JOIN_CODE_LENGTH = 6;

export const joinCodeSchema = v.pipe(
	v.string(),
	v.regex(
		/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/,
		"Join code must be 6 unambiguous uppercase characters",
	),
);

/**
 * Generates a join code. `random` is injectable so the result is testable.
 */
export function createJoinCode(random: () => number = Math.random): string {
	let code = "";
	for (let index = 0; index < JOIN_CODE_LENGTH; index += 1) {
		const position = Math.floor(random() * JOIN_CODE_ALPHABET.length);
		code += JOIN_CODE_ALPHABET[position] ?? "A";
	}
	return code;
}
