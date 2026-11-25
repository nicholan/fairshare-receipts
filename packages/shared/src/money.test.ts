import { describe, expect, test } from "bun:test";

import {
	absCents,
	addCents,
	formatCents,
	isCents,
	negateCents,
	parseAmountToCents,
	subtractCents,
	sumCents,
	toCents,
} from "./money";
import { plain } from "./test-helpers";

describe("parseAmountToCents", () => {
	const cases: ReadonlyArray<readonly [string, number]> = [
		["12", 1200],
		["12.5", 1250],
		["12.50", 1250],
		["12,50", 1250],
		["0,99", 99],
		["1.234,56", 123456],
		["1,234.56", 123456],
		["€ 1 234,56", 123456],
		["1'234.50", 123450],
		["-12,50", -1250],
		["(12,50)", -1250],
		["12,50-", -1250],
		["+3.00", 300],
		["1,234", 123400],
		["1.234", 123400],
		["19,99 EUR", 1999],
		["19,99EUR", 1999],
		["12,50kr", 1250],
		["12,50 Euro", 1250],
	];

	for (const [input, expected] of cases) {
		test(`parses ${JSON.stringify(input)} as ${expected} cents`, () => {
			expect(plain(parseAmountToCents(input))).toBe(expected);
		});
	}

	test("rejects input without a number", () => {
		expect(() => parseAmountToCents("")).toThrow(RangeError);
		expect(() => parseAmountToCents("   ")).toThrow(RangeError);
		expect(() => parseAmountToCents("abc")).toThrow(RangeError);
		expect(() => parseAmountToCents(",")).toThrow(RangeError);
	});

	test("rejects more than two decimal digits", () => {
		expect(() => parseAmountToCents("1.234,567")).toThrow(RangeError);
	});

	test("normalises negative zero instead of leaking -0", () => {
		expect(Object.is(parseAmountToCents("-0,00"), 0)).toBe(true);
		expect(Object.is(parseAmountToCents("(0,00)"), 0)).toBe(true);
	});
});

describe("toCents", () => {
	test("accepts integers", () => {
		expect(plain(toCents(0))).toBe(0);
		expect(plain(toCents(-1250))).toBe(-1250);
	});

	test("rejects fractional or unsafe values", () => {
		expect(() => toCents(1.5)).toThrow(RangeError);
		expect(() => toCents(Number.NaN)).toThrow(RangeError);
		expect(() => toCents(Number.MAX_VALUE)).toThrow(RangeError);
	});
});

describe("isCents", () => {
	test("narrows only integers", () => {
		expect(isCents(1999)).toBe(true);
		expect(isCents(19.99)).toBe(false);
		expect(isCents(Number.POSITIVE_INFINITY)).toBe(false);
	});
});

describe("sumCents", () => {
	test("sums and preserves the empty case", () => {
		expect(plain(sumCents([]))).toBe(0);
		expect(plain(sumCents([toCents(1), toCents(2), toCents(3)]))).toBe(6);
	});
});

describe("cent arithmetic", () => {
	test("adds, subtracts, negates and takes absolute values", () => {
		expect(plain(addCents(toCents(1000), toCents(250)))).toBe(1250);
		expect(plain(subtractCents(toCents(1000), toCents(250)))).toBe(750);
		expect(plain(negateCents(toCents(250)))).toBe(-250);
		expect(plain(absCents(toCents(-250)))).toBe(250);
	});

	test("refuses results outside the safe integer range", () => {
		expect(() =>
			addCents(toCents(Number.MAX_SAFE_INTEGER), toCents(1)),
		).toThrow(RangeError);
	});
});

describe("formatCents", () => {
	test("renders the currency for a locale", () => {
		const formatted = formatCents(toCents(1234), {
			locale: "en-US",
			currency: "EUR",
		});
		expect(formatted).toContain("12.34");
	});

	test("respects European decimal separators", () => {
		const formatted = formatCents(toCents(1234), {
			locale: "de-DE",
			currency: "EUR",
		});
		expect(formatted).toContain("12,34");
	});

	test("can omit the currency symbol", () => {
		const formatted = formatCents(toCents(1234), { showCurrency: false });
		expect(formatted).toBe("12.34");
	});
});
