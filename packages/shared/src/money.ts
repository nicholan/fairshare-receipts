/**
 * Money is always represented as integer cents (see the engineering invariants
 * in AGENTS.md). `Cents` is a branded number so that raw integers cannot be
 * passed around as money by accident.
 */

/** Hard ceiling for a single amount: 9_999_999.99 in minor units. */
export const MAX_AMOUNT_CENTS: Cents = 999_999_999 as Cents;

export const ZERO_CENTS: Cents = 0 as Cents;

/**
 * The only currency the application supports while amounts are two-decimal
 * minor units. Multi-currency is an explicit non-goal for the MVP (ADR-0006).
 */
export const SUPPORTED_CURRENCY_CODE = "EUR" as const;

export type SupportedCurrencyCode = typeof SUPPORTED_CURRENCY_CODE;

export type Cents = number & { readonly __brand: "Cents" };

/**
 * Strips currency noise that receipt scanners and LLMs routinely emit:
 * symbols, ISO codes and spoken currency names.
 */
const CURRENCY_NOISE =
	/(?:[€$£¥₽₹]|\b(?:euros?|dollars?|pounds?|eur|usd|gbp|chf|sek|nok|dkk|jpy|pln|czk|kr)\b)/gi;

/**
 * Receipts frequently glue the code to the amount ("19,99EUR", "12,50kr").
 * `\b` cannot match between a digit and a letter, so insert a separator first.
 */
const DIGIT_LETTER_BOUNDARY = /(\d)([a-z])/gi;

const WHITESPACE = /[\s\u00a0\u202f]+/g;

/** Swiss/German grouping separators such as `1'234.50`. */
const GROUPING_APOSTROPHES = /['\u2019]/g;

const AMOUNT_SHAPE = /^\d[\d.,]*$/;

const SEPARATORS = /[.,]/g;

export function isCents(value: number): value is Cents {
	return Number.isSafeInteger(value);
}

/**
 * Validates that a number is a safe integer amount of cents.
 * @throws RangeError when the value is fractional or not a safe integer.
 */
export function toCents(value: number): Cents {
	if (!isCents(value)) {
		throw new RangeError(
			`Expected an integer amount of cents, received ${value}`,
		);
	}
	return value as Cents;
}

/**
 * Parses a human/LLM formatted amount into integer cents.
 *
 * Handles `12.50`, `12,50`, `1.234,56`, `1,234.56`, `€ 1 234,56`, `1'234.50`,
 * `19,99EUR`, `12,50 kr`, leading `+`/`-`, trailing `-` and accounting
 * parentheses (`(12,50)`).
 *
 * A single separator followed by three digits is treated as a thousands
 * separator (`1.234` -> 123400), which matches European receipt output.
 *
 * This is a magnitude parser: currency markers are stripped and no currency is
 * inferred. Callers must establish the currency from an explicit field and
 * reject sources whose currency is unknown or unsupported (ADR-0006).
 *
 * @throws RangeError when the text is not a recognisable amount.
 */
export function parseAmountToCents(input: string): Cents {
	if (typeof input !== "string") {
		throw new TypeError("parseAmountToCents expects a string");
	}

	let text = input.trim();
	if (text.length === 0) {
		throw new RangeError("Cannot parse an empty amount");
	}

	let negative = false;

	if (text.startsWith("(") && text.endsWith(")")) {
		negative = true;
		text = text.slice(1, -1).trim();
	}

	text = text
		.replace(DIGIT_LETTER_BOUNDARY, "$1 $2")
		.replace(CURRENCY_NOISE, "")
		.replace(WHITESPACE, "")
		.replace(GROUPING_APOSTROPHES, "");

	if (text.startsWith("-")) {
		negative = !negative;
		text = text.slice(1);
	} else if (text.startsWith("+")) {
		text = text.slice(1);
	}

	if (text.endsWith("-")) {
		negative = !negative;
		text = text.slice(0, -1);
	}

	if (!AMOUNT_SHAPE.test(text)) {
		throw new RangeError(`Cannot parse amount: ${JSON.stringify(input)}`);
	}

	const lastComma = text.lastIndexOf(",");
	const lastDot = text.lastIndexOf(".");
	let decimalIndex = -1;

	if (lastComma >= 0 && lastDot >= 0) {
		// Both separators present: the right-most one is the decimal separator.
		decimalIndex = Math.max(lastComma, lastDot);
	} else {
		const separatorIndex = lastComma >= 0 ? lastComma : lastDot;
		if (separatorIndex >= 0) {
			const digitsAfter = text.length - separatorIndex - 1;
			// 1-2 trailing digits are fractional; 3+ digits are grouping.
			if (digitsAfter > 0 && digitsAfter <= 2) {
				decimalIndex = separatorIndex;
			}
		}
	}

	let integerDigits: string;
	let fractionDigits: string;

	if (decimalIndex >= 0) {
		const integerPart = text.slice(0, decimalIndex).replace(SEPARATORS, "");
		const fractionPart = text.slice(decimalIndex + 1).replace(SEPARATORS, "");
		integerDigits = integerPart.length > 0 ? integerPart : "0";
		fractionDigits = fractionPart;
	} else {
		integerDigits = text.replace(SEPARATORS, "");
		fractionDigits = "";
	}

	if (!/^\d+$/.test(integerDigits) || !/^\d*$/.test(fractionDigits)) {
		throw new RangeError(`Cannot parse amount: ${JSON.stringify(input)}`);
	}

	if (fractionDigits.length > 2) {
		throw new RangeError(
			`Amount has more than two decimal digits: ${JSON.stringify(input)}`,
		);
	}

	const cents =
		Number(integerDigits) * 100 + Number(fractionDigits.padEnd(2, "0"));

	// Avoid leaking `-0` into JSON payloads and formatted output.
	const signed = negative ? -cents : cents;
	return toCents(signed === 0 ? 0 : signed);
}

export interface FormatCentsOptions {
	/** BCP 47 locale, defaults to `en-US`. */
	readonly locale?: string;
	/** ISO 4217 currency code. EUR is the only supported currency (ADR-0006). */
	readonly currency?: SupportedCurrencyCode;
	/** Set to false to render `12.34` without a currency symbol. */
	readonly showCurrency?: boolean;
}

/**
 * Formats cents for display. This is the only place where a floating point
 * decimal currency value exists, and it never leaves the render layer.
 */
export function formatCents(
	cents: Cents,
	options: FormatCentsOptions = {},
): string {
	const {
		locale = "en-US",
		currency = SUPPORTED_CURRENCY_CODE,
		showCurrency = true,
	} = options;
	const amount = cents / 100;

	if (showCurrency) {
		return new Intl.NumberFormat(locale, {
			style: "currency",
			currency,
		}).format(amount);
	}

	return new Intl.NumberFormat(locale, {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(amount);
}

export function addCents(left: Cents, right: Cents): Cents {
	return toCents(left + right);
}

export function subtractCents(left: Cents, right: Cents): Cents {
	return toCents(left - right);
}

export function negateCents(value: Cents): Cents {
	return toCents(-value);
}

export function absCents(value: Cents): Cents {
	return toCents(Math.abs(value));
}

export function sumCents(values: readonly Cents[]): Cents {
	let total = 0;
	for (const value of values) {
		total += value;
	}
	return toCents(total);
}
