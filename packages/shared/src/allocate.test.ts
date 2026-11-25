import { describe, expect, test } from "bun:test";

import { allocateEvenly, allocateProportionally } from "./allocate";
import { type Cents, toCents } from "./money";
import { plain } from "./test-helpers";

function total(values: readonly Cents[]): number {
	return values.reduce((sum, value) => sum + value, 0);
}

describe("allocateEvenly", () => {
	test("hands leftover cents to the earliest buckets", () => {
		expect(plain(allocateEvenly(toCents(100), 3))).toEqual([34, 33, 33]);
	});

	test("handles amounts smaller than the bucket count", () => {
		expect(plain(allocateEvenly(toCents(1), 3))).toEqual([1, 0, 0]);
		expect(plain(allocateEvenly(toCents(2), 4))).toEqual([1, 1, 0, 0]);
		expect(plain(allocateEvenly(toCents(0), 3))).toEqual([0, 0, 0]);
	});

	test("always sums back to the input", () => {
		for (let amount = 0; amount <= 200; amount += 1) {
			for (let buckets = 1; buckets <= 9; buckets += 1) {
				const shares = allocateEvenly(toCents(amount), buckets);
				expect(shares).toHaveLength(buckets);
				expect(total(shares)).toBe(amount);
			}
		}
	});

	test("rejects non-positive bucket counts", () => {
		expect(() => allocateEvenly(toCents(100), 0)).toThrow(RangeError);
		expect(() => allocateEvenly(toCents(100), 1.5)).toThrow(RangeError);
	});
});

describe("allocateProportionally", () => {
	test("allocates by weight with a deterministic remainder", () => {
		expect(plain(allocateProportionally(toCents(1000), [1, 1, 1]))).toEqual([
			334, 333, 333,
		]);
		expect(plain(allocateProportionally(toCents(100), [1, 2]))).toEqual([
			33, 67,
		]);
	});

	test("allocates zero totals as zeros", () => {
		expect(plain(allocateProportionally(toCents(0), [3, 7]))).toEqual([0, 0]);
	});

	test("falls back to an even split when all weights are zero", () => {
		expect(plain(allocateProportionally(toCents(101), [0, 0]))).toEqual([
			51, 50,
		]);
	});

	test("supports negative totals such as discounts", () => {
		expect(plain(allocateProportionally(toCents(-100), [1, 1, 1]))).toEqual([
			-34, -33, -33,
		]);
	});

	test("sums to the input for a grid of weights", () => {
		const weightSets: readonly (readonly number[])[] = [
			[1],
			[1, 1],
			[0, 5],
			[3, 4, 5],
			[0, 0, 7],
			[123, 456, 789, 1000],
		];
		for (let amount = 0; amount <= 500; amount += 7) {
			for (const weights of weightSets) {
				const shares = allocateProportionally(toCents(amount), weights);
				expect(total(shares)).toBe(amount);
				for (const share of shares) {
					expect(share).toBeGreaterThanOrEqual(0);
				}
			}
		}
	});

	test("rejects invalid weights", () => {
		expect(() => allocateProportionally(toCents(100), [-1, 2])).toThrow(
			RangeError,
		);
		expect(() => allocateProportionally(toCents(100), [1.5, 2])).toThrow(
			RangeError,
		);
		expect(plain(allocateProportionally(toCents(100), []))).toEqual([]);
	});
});
