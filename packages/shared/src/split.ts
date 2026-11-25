import { allocateEvenly, allocateProportionally } from "./allocate";
import { type Cents, sumCents, toCents, ZERO_CENTS } from "./money";

export interface SplitLineItem {
	readonly id: string;
	readonly totalCents: Cents;
}

export interface SplitInput {
	readonly participants: readonly string[];
	readonly items: readonly SplitLineItem[];
	/** Item id -> participant ids that share it. Missing/empty means unclaimed. */
	readonly claims: Readonly<Record<string, readonly string[]>>;
	readonly taxCents?: Cents;
	readonly tipCents?: Cents;
	readonly serviceChargeCents?: Cents;
	/** Non-negative absolute value of a discount applied to the receipt. */
	readonly discountCents?: Cents;
	/** Receipt total as printed, used to detect extraction drift. */
	readonly expectedTotalCents?: Cents;
}

export interface ParticipantShare {
	readonly participantId: string;
	/** Sum of the claimed items, before tax/tip/discount. */
	readonly itemsCents: Cents;
	/** This participant's proportional slice of tax + tip + service - discount. */
	readonly extrasCents: Cents;
	readonly totalCents: Cents;
}

export interface SplitResult {
	readonly participants: readonly ParticipantShare[];
	readonly itemsCents: Cents;
	readonly extrasCents: Cents;
	/** Items + extras, i.e. what the receipt should add up to. */
	readonly totalCents: Cents;
	/** Items nobody claimed yet. */
	readonly unclaimedItemsCents: Cents;
	/** Extras attributed to the unclaimed portion. */
	readonly unclaimedExtrasCents: Cents;
	readonly expectedTotalCents: Cents | null;
	/** Positive when the parsed receipt overstates the sum of its own lines. */
	readonly discrepancyCents: Cents | null;
	/** True when every participant share plus unclaimed money equals the total. */
	readonly reconciles: boolean;
}

function dedupe(ids: readonly string[]): string[] {
	const unique: string[] = [];
	const seen = new Set<string>();
	for (const id of ids) {
		if (!seen.has(id)) {
			seen.add(id);
			unique.push(id);
		}
	}
	return unique;
}

/**
 * Computes who owes what for a single receipt.
 *
 * Items are split evenly between their claimants (largest remainder), then
 * tax, tip, service charge and discount are allocated proportionally to each
 * participant's claimed subtotal. Everything stays in integer cents and the
 * result reconciles exactly to the receipt total, with unclaimed money tracked
 * separately instead of being silently redistributed.
 */
export function splitReceipt(input: SplitInput): SplitResult {
	const { participants, items, claims } = input;

	if (participants.length === 0) {
		throw new RangeError("At least one participant is required");
	}

	const knownParticipants = new Set<string>();
	for (const participantId of participants) {
		if (knownParticipants.has(participantId)) {
			throw new RangeError(`Duplicate participant id: ${participantId}`);
		}
		knownParticipants.add(participantId);
	}

	const itemTotals = new Map<string, Cents>();
	for (const item of items) {
		if (itemTotals.has(item.id)) {
			throw new RangeError(`Duplicate item id: ${item.id}`);
		}
		const total = toCents(item.totalCents);
		if (total < 0) {
			throw new RangeError(
				`Item ${item.id} has a negative total; use discountCents instead`,
			);
		}
		itemTotals.set(item.id, total);
	}

	for (const claimedItemId of Object.keys(claims)) {
		if (!itemTotals.has(claimedItemId)) {
			throw new RangeError(
				`Claim references unknown item id: ${claimedItemId}`,
			);
		}
	}

	const itemsByParticipant = new Map<string, Cents>();
	for (const participantId of participants) {
		itemsByParticipant.set(participantId, ZERO_CENTS);
	}

	let unclaimedItemsCents = ZERO_CENTS;

	for (const item of items) {
		const itemTotal = itemTotals.get(item.id) ?? ZERO_CENTS;
		const claimants = dedupe(claims[item.id] ?? []);

		for (const claimant of claimants) {
			if (!knownParticipants.has(claimant)) {
				throw new RangeError(
					`Claim for item ${item.id} references unknown participant: ${claimant}`,
				);
			}
		}

		if (claimants.length === 0) {
			unclaimedItemsCents = toCents(unclaimedItemsCents + itemTotal);
			continue;
		}

		const itemShares = allocateEvenly(itemTotal, claimants.length);
		for (const [index, claimant] of claimants.entries()) {
			const current = itemsByParticipant.get(claimant) ?? ZERO_CENTS;
			const share = itemShares[index] ?? ZERO_CENTS;
			itemsByParticipant.set(claimant, toCents(current + share));
		}
	}

	const extrasCents = toCents(
		(input.taxCents ?? ZERO_CENTS) +
			(input.tipCents ?? ZERO_CENTS) +
			(input.serviceChargeCents ?? ZERO_CENTS) -
			(input.discountCents ?? ZERO_CENTS),
	);

	const weights: number[] = [];
	for (const participantId of participants) {
		weights.push(itemsByParticipant.get(participantId) ?? ZERO_CENTS);
	}
	const unclaimedIndex = participants.length;
	weights.push(unclaimedItemsCents);

	const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
	const extrasShares =
		totalWeight === 0
			? [...allocateEvenly(extrasCents, participants.length), ZERO_CENTS]
			: allocateProportionally(extrasCents, weights);

	const unclaimedExtrasCents = extrasShares[unclaimedIndex] ?? ZERO_CENTS;

	const shares: ParticipantShare[] = participants.map(
		(participantId, index) => {
			const itemsCents = itemsByParticipant.get(participantId) ?? ZERO_CENTS;
			const participantExtras = extrasShares[index] ?? ZERO_CENTS;
			return {
				participantId,
				itemsCents,
				extrasCents: participantExtras,
				totalCents: toCents(itemsCents + participantExtras),
			};
		},
	);

	const itemsCents = sumCents([...itemTotals.values()]);
	const totalCents = toCents(itemsCents + extrasCents);
	const accountedFor = toCents(
		sumCents(shares.map((share) => share.totalCents)) +
			unclaimedItemsCents +
			unclaimedExtrasCents,
	);

	const expectedTotalCents = input.expectedTotalCents ?? null;

	return {
		participants: shares,
		itemsCents,
		extrasCents,
		totalCents,
		unclaimedItemsCents,
		unclaimedExtrasCents,
		expectedTotalCents,
		discrepancyCents:
			expectedTotalCents === null
				? null
				: toCents(expectedTotalCents - totalCents),
		reconciles: accountedFor === totalCents,
	};
}
