import { describe, expect, test } from "bun:test";

import { toCents } from "./money";
import { type SplitInput, splitReceipt } from "./split";
import { plain } from "./test-helpers";

const baseInput: SplitInput = {
	participants: ["ana", "bo"],
	items: [{ id: "i1", totalCents: toCents(1000) }],
	claims: { i1: ["ana", "bo"] },
	taxCents: toCents(100),
};

describe("splitReceipt", () => {
	test("splits an item evenly and allocates tax proportionally", () => {
		const result = splitReceipt(baseInput);

		expect(plain(result.itemsCents)).toBe(1000);
		expect(plain(result.extrasCents)).toBe(100);
		expect(plain(result.totalCents)).toBe(1100);
		expect(result.reconciles).toBe(true);
		expect(plain(result.participants)).toEqual([
			{
				participantId: "ana",
				itemsCents: 500,
				extrasCents: 50,
				totalCents: 550,
			},
			{
				participantId: "bo",
				itemsCents: 500,
				extrasCents: 50,
				totalCents: 550,
			},
		]);
	});

	test("keeps unclaimed items out of participant totals", () => {
		const result = splitReceipt({
			participants: ["ana", "bo"],
			items: [
				{ id: "i1", totalCents: toCents(1000) },
				{ id: "i2", totalCents: toCents(1000) },
			],
			claims: { i1: ["ana"] },
			taxCents: toCents(200),
		});

		expect(plain(result.participants[0]?.totalCents)).toBe(1100);
		expect(plain(result.unclaimedItemsCents)).toBe(1000);
		expect(plain(result.unclaimedExtrasCents)).toBe(100);
		expect(plain(result.totalCents)).toBe(2200);
		expect(result.reconciles).toBe(true);
	});

	test("allocates a discount as a negative extra", () => {
		const result = splitReceipt({
			...baseInput,
			taxCents: toCents(0),
			discountCents: toCents(100),
		});

		expect(plain(result.participants.map((share) => share.totalCents))).toEqual(
			[450, 450],
		);
		expect(plain(result.totalCents)).toBe(900);
		expect(result.reconciles).toBe(true);
	});

	test("distributes indivisible cents deterministically", () => {
		const result = splitReceipt({
			participants: ["ana", "bo", "cy"],
			items: [{ id: "i1", totalCents: toCents(100) }],
			claims: { i1: ["ana", "bo", "cy"] },
		});

		expect(plain(result.participants.map((share) => share.itemsCents))).toEqual(
			[34, 33, 33],
		);
	});

	test("treats a participant listed twice as one claimant", () => {
		const result = splitReceipt({
			participants: ["ana", "bo"],
			items: [{ id: "i1", totalCents: toCents(1000) }],
			claims: { i1: ["ana", "ana"] },
		});

		expect(plain(result.participants[0]?.itemsCents)).toBe(1000);
		expect(plain(result.participants[1]?.itemsCents)).toBe(0);
	});

	test("surfaces a discrepancy against the printed total", () => {
		const result = splitReceipt({
			...baseInput,
			expectedTotalCents: toCents(1150),
		});

		expect(plain(result.discrepancyCents)).toBe(50);
		expect(plain(result.expectedTotalCents)).toBe(1150);
		expect(result.reconciles).toBe(true);
	});

	test("splits extras evenly when nothing has been claimed", () => {
		const result = splitReceipt({
			participants: ["ana", "bo"],
			items: [],
			claims: {},
			taxCents: toCents(100),
		});

		expect(plain(result.participants.map((share) => share.totalCents))).toEqual(
			[50, 50],
		);
		expect(plain(result.totalCents)).toBe(100);
		expect(result.reconciles).toBe(true);
	});

	test("rejects inconsistent input", () => {
		expect(() => splitReceipt({ ...baseInput, participants: [] })).toThrow(
			RangeError,
		);
		expect(() =>
			splitReceipt({ ...baseInput, participants: ["ana", "ana"] }),
		).toThrow(RangeError);
		expect(() =>
			splitReceipt({ ...baseInput, claims: { i1: ["zoe"] } }),
		).toThrow(RangeError);
		expect(() =>
			splitReceipt({ ...baseInput, claims: { unknown: ["ana"] } }),
		).toThrow(RangeError);
		expect(() =>
			splitReceipt({
				...baseInput,
				items: [{ id: "i1", totalCents: toCents(-100) }],
			}),
		).toThrow(RangeError);
	});
});
