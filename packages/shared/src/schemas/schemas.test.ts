import { describe, expect, test } from "bun:test";
import * as v from "valibot";

import { toCents } from "../money";
import { plain } from "../test-helpers";
import {
	createJoinCode,
	currencyCodeSchema,
	displayNameSchema,
	joinCodeSchema,
	receiptExtractionSchema,
	reconcileExtraction,
	tripCreateInputSchema,
	validateReceiptExtraction,
} from "./index";

const validExtraction = {
	merchant: "Trattoria",
	currency: "EUR",
	items: [
		{
			description: "Pasta",
			quantity: 2,
			unitPriceCents: 1200,
			totalCents: 2400,
		},
		{
			description: "Wine",
			quantity: 1,
			unitPriceCents: 1800,
			totalCents: 1800,
		},
	],
	taxCents: 420,
	tipCents: 300,
	totalCents: 4920,
};

describe("receiptExtractionSchema", () => {
	test("applies defaults for optional totals", () => {
		const parsed = v.parse(receiptExtractionSchema, {
			currency: "EUR",
			items: [
				{
					description: "Pasta",
					quantity: 1,
					unitPriceCents: 1200,
					totalCents: 1200,
				},
			],
			totalCents: 1200,
		});

		expect(parsed.currency).toBe("EUR");
		expect(plain(parsed.taxCents)).toBe(0);
		expect(plain(parsed.tipCents)).toBe(0);
		expect(plain(parsed.serviceChargeCents)).toBe(0);
		expect(plain(parsed.discountCents)).toBe(0);
	});

	test("requires an explicit EUR currency", () => {
		expect(() =>
			v.parse(receiptExtractionSchema, {
				items: validExtraction.items,
				totalCents: validExtraction.totalCents,
			}),
		).toThrow();
		expect(() =>
			v.parse(receiptExtractionSchema, {
				...validExtraction,
				currency: "USD",
			}),
		).toThrow(/EUR/);
	});

	test("rejects fractional, negative or empty values", () => {
		expect(() =>
			v.parse(receiptExtractionSchema, {
				...validExtraction,
				totalCents: 49.2,
			}),
		).toThrow();
		expect(() =>
			v.parse(receiptExtractionSchema, { ...validExtraction, taxCents: -1 }),
		).toThrow();
		expect(() =>
			v.parse(receiptExtractionSchema, { ...validExtraction, items: [] }),
		).toThrow();
		expect(() =>
			v.parse(receiptExtractionSchema, {
				...validExtraction,
				currency: "euro",
			}),
		).toThrow();
	});
});

describe("validateReceiptExtraction", () => {
	test("returns the parsed value and reconciliation for valid input", () => {
		const result = validateReceiptExtraction(validExtraction);

		expect(result.ok).toBe(true);
		if (!result.ok) {
			throw new Error("expected valid extraction");
		}
		expect(result.value.items).toHaveLength(2);
		expect(plain(result.reconciliation.computedTotalCents)).toBe(4920);
		expect(plain(result.reconciliation.discrepancyCents)).toBe(0);
		expect(result.reconciliation.reconciles).toBe(true);
	});

	test("reports issues instead of throwing for invalid input", () => {
		const result = validateReceiptExtraction({ items: [] });

		expect(result.ok).toBe(false);
		if (result.ok) {
			throw new Error("expected invalid extraction");
		}
		expect(result.issues.length).toBeGreaterThan(0);
	});
});

describe("reconcileExtraction", () => {
	test("flags a dropped line on the receipt", () => {
		const parsed = v.parse(receiptExtractionSchema, validExtraction);
		const reconciliation = reconcileExtraction({
			...parsed,
			totalCents: toCents(parsed.totalCents + 500),
		});

		expect(reconciliation.reconciles).toBe(false);
		expect(plain(reconciliation.discrepancyCents)).toBe(500);
	});
});

describe("join codes", () => {
	test("generates codes from the unambiguous alphabet", () => {
		expect(createJoinCode(() => 0)).toBe("AAAAAA");
		expect(createJoinCode(() => 0.999999)).toBe("999999");
		expect(v.safeParse(joinCodeSchema, createJoinCode()).success).toBe(true);
	});

	test("rejects ambiguous or malformed codes", () => {
		expect(v.safeParse(joinCodeSchema, "ABC234").success).toBe(true);
		expect(v.safeParse(joinCodeSchema, "abc234").success).toBe(false);
		expect(v.safeParse(joinCodeSchema, "ABCIO3").success).toBe(false);
		expect(v.safeParse(joinCodeSchema, "ABC23").success).toBe(false);
	});
});

describe("currencyCodeSchema", () => {
	test("accepts EUR only", () => {
		expect(v.safeParse(currencyCodeSchema, "EUR").success).toBe(true);
		expect(v.safeParse(currencyCodeSchema, "USD").success).toBe(false);
		expect(v.safeParse(currencyCodeSchema, "GBP").success).toBe(false);
		expect(v.safeParse(currencyCodeSchema, "eur").success).toBe(false);
	});
});

describe("tripCreateInputSchema", () => {
	test("requires an explicit EUR currency and defaults participants", () => {
		const parsed = v.parse(tripCreateInputSchema, {
			name: "Lisbon trip",
			currency: "EUR",
			hostName: "  Ana  ",
		});

		expect(parsed.currency).toBe("EUR");
		expect(parsed.participantNames).toEqual([]);
		expect(parsed.hostName).toBe("Ana");
	});

	test("rejects a missing or non-EUR currency", () => {
		expect(() =>
			v.parse(tripCreateInputSchema, {
				name: "Lisbon trip",
				hostName: "Ana",
			}),
		).toThrow();
		expect(() =>
			v.parse(tripCreateInputSchema, {
				name: "Lisbon trip",
				currency: "GBP",
				hostName: "Ana",
			}),
		).toThrow(/EUR/);
	});

	test("trims display names", () => {
		expect(v.parse(displayNameSchema, "  Bo ")).toBe("Bo");
		expect(v.safeParse(displayNameSchema, "   ").success).toBe(false);
	});
});
