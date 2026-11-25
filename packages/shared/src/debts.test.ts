import { describe, expect, test } from "bun:test";

import {
	buildBalances,
	type ContributionInput,
	simplifyAcrossTrips,
	simplifyDebts,
} from "./debts";
import { toCents } from "./money";
import { plain } from "./test-helpers";

describe("buildBalances", () => {
	test("computes nets from paid and owed amounts", () => {
		const balances = buildBalances([
			{
				participantId: "ana",
				paidCents: toCents(1000),
				owedCents: toCents(500),
			},
			{ participantId: "bo", paidCents: toCents(0), owedCents: toCents(500) },
		]);

		expect(balances.map((balance) => balance.netCents)).toEqual([500, -500]);
	});

	test("rejects duplicate participants", () => {
		expect(() =>
			buildBalances([
				{ participantId: "ana", paidCents: toCents(1), owedCents: toCents(1) },
				{ participantId: "ana", paidCents: toCents(1), owedCents: toCents(1) },
			]),
		).toThrow(RangeError);
	});
});

describe("simplifyDebts", () => {
	test("settles a simple two-person debt", () => {
		const summary = simplifyDebts(
			buildBalances([
				{
					participantId: "ana",
					paidCents: toCents(1000),
					owedCents: toCents(500),
				},
				{ participantId: "bo", paidCents: toCents(0), owedCents: toCents(500) },
			]),
		);

		expect(plain(summary.transfers)).toEqual([
			{
				fromParticipantId: "bo",
				toParticipantId: "ana",
				amountCents: 500,
			},
		]);
		expect(summary.unallocatedCents).toBe(0);
	});

	test("produces at most n-1 transfers and is deterministic", () => {
		const summary = simplifyDebts(
			buildBalances([
				{
					participantId: "ana",
					paidCents: toCents(500),
					owedCents: toCents(0),
				},
				{ participantId: "bo", paidCents: toCents(500), owedCents: toCents(0) },
				{ participantId: "cy", paidCents: toCents(0), owedCents: toCents(400) },
				{ participantId: "di", paidCents: toCents(0), owedCents: toCents(600) },
			]),
		);

		expect(plain(summary.transfers)).toEqual([
			{ fromParticipantId: "di", toParticipantId: "ana", amountCents: 500 },
			{ fromParticipantId: "di", toParticipantId: "bo", amountCents: 100 },
			{ fromParticipantId: "cy", toParticipantId: "bo", amountCents: 400 },
		]);
		expect(summary.unallocatedCents).toBe(0);
	});

	test("returns nothing when everyone is square", () => {
		const summary = simplifyDebts(
			buildBalances([
				{
					participantId: "ana",
					paidCents: toCents(300),
					owedCents: toCents(300),
				},
			]),
		);

		expect(summary.transfers).toEqual([]);
		expect(summary.unallocatedCents).toBe(0);
	});

	test("reports money that nobody can settle yet", () => {
		const summary = simplifyDebts(
			buildBalances([
				{
					participantId: "ana",
					paidCents: toCents(1000),
					owedCents: toCents(500),
				},
			]),
		);

		expect(summary.transfers).toEqual([]);
		expect(summary.unallocatedCents).toBe(500);
	});
});

describe("simplifyAcrossTrips", () => {
	test("nets balances across trips before settling", () => {
		const tripA: ContributionInput[] = [
			{
				participantId: "ana",
				paidCents: toCents(2000),
				owedCents: toCents(1000),
			},
			{ participantId: "bo", paidCents: toCents(0), owedCents: toCents(1000) },
		];
		const tripB: ContributionInput[] = [
			{ participantId: "ana", paidCents: toCents(0), owedCents: toCents(700) },
			{ participantId: "bo", paidCents: toCents(700), owedCents: toCents(0) },
		];

		const summary = simplifyAcrossTrips([tripA, tripB]);

		expect(plain(summary.transfers)).toEqual([
			{ fromParticipantId: "bo", toParticipantId: "ana", amountCents: 300 },
		]);
		expect(summary.unallocatedCents).toBe(0);
	});
});
