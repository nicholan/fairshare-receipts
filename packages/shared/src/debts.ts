import { type Cents, toCents } from "./money";

export interface ContributionInput {
	readonly participantId: string;
	/** What this participant actually paid towards the trip. */
	readonly paidCents: Cents;
	/** What this participant consumed in the trip. */
	readonly owedCents: Cents;
}

export interface ParticipantBalance extends ContributionInput {
	/** Positive means the participant is owed money, negative means they owe. */
	readonly netCents: number;
}

export interface Transfer {
	readonly fromParticipantId: string;
	readonly toParticipantId: string;
	readonly amountCents: Cents;
}

export interface DebtSummary {
	readonly transfers: readonly Transfer[];
	/**
	 * Money that cannot be settled yet, e.g. unclaimed items or a receipt that
	 * has not been fully apportioned. Positive means creditors are still owed
	 * this much by nobody.
	 */
	readonly unallocatedCents: number;
}

export function buildBalances(
	contributions: readonly ContributionInput[],
): ParticipantBalance[] {
	const seen = new Set<string>();
	const balances: ParticipantBalance[] = [];

	for (const contribution of contributions) {
		if (seen.has(contribution.participantId)) {
			throw new RangeError(
				`Duplicate participant id: ${contribution.participantId}`,
			);
		}
		seen.add(contribution.participantId);

		const paidCents = toCents(contribution.paidCents);
		const owedCents = toCents(contribution.owedCents);

		balances.push({
			participantId: contribution.participantId,
			paidCents,
			owedCents,
			netCents: paidCents - owedCents,
		});
	}

	return balances;
}

interface OpenBalance {
	participantId: string;
	remaining: number;
}

/**
 * Greedy max-creditor/max-debtor matching. Produces at most n-1 transfers for
 * n participants and is deterministic (amounts then participant id).
 */
export function simplifyDebts(
	balances: readonly ParticipantBalance[],
): DebtSummary {
	const creditors: OpenBalance[] = [];
	const debtors: OpenBalance[] = [];
	let unallocatedCents = 0;

	for (const balance of balances) {
		unallocatedCents += balance.netCents;
		if (balance.netCents > 0) {
			creditors.push({
				participantId: balance.participantId,
				remaining: balance.netCents,
			});
		} else if (balance.netCents < 0) {
			debtors.push({
				participantId: balance.participantId,
				remaining: -balance.netCents,
			});
		}
	}

	const byRemaining = (left: OpenBalance, right: OpenBalance) =>
		right.remaining - left.remaining ||
		left.participantId.localeCompare(right.participantId);

	creditors.sort(byRemaining);
	debtors.sort(byRemaining);

	const transfers: Transfer[] = [];
	let creditorIndex = 0;
	let debtorIndex = 0;

	while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
		const creditor = creditors[creditorIndex];
		const debtor = debtors[debtorIndex];

		if (creditor === undefined || debtor === undefined) {
			break;
		}

		const amount = Math.min(creditor.remaining, debtor.remaining);

		if (amount > 0) {
			transfers.push({
				fromParticipantId: debtor.participantId,
				toParticipantId: creditor.participantId,
				amountCents: toCents(amount),
			});
		}

		creditor.remaining -= amount;
		debtor.remaining -= amount;

		if (creditor.remaining === 0) {
			creditorIndex += 1;
		}
		if (debtor.remaining === 0) {
			debtorIndex += 1;
		}
	}

	return { transfers, unallocatedCents };
}

/**
 * Aggregates contributions across several trips before simplifying, which is
 * what minimises the number of real-world bank transfers overall.
 */
export function simplifyAcrossTrips(
	trips: readonly (readonly ContributionInput[])[],
): DebtSummary {
	const totals = new Map<string, { paid: number; owed: number }>();

	for (const trip of trips) {
		for (const contribution of trip) {
			const current = totals.get(contribution.participantId) ?? {
				paid: 0,
				owed: 0,
			};
			current.paid += contribution.paidCents;
			current.owed += contribution.owedCents;
			totals.set(contribution.participantId, current);
		}
	}

	const contributions: ContributionInput[] = [];
	for (const [participantId, value] of totals) {
		contributions.push({
			participantId,
			paidCents: toCents(value.paid),
			owedCents: toCents(value.owed),
		});
	}

	return simplifyDebts(buildBalances(contributions));
}
