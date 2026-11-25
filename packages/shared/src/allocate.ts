import { type Cents, toCents } from "./money";

/**
 * Splits `total` into `bucketCount` shares that sum exactly to `total`.
 * Leftover cents are handed out to the earliest buckets.
 */
export function allocateEvenly(total: Cents, bucketCount: number): Cents[] {
	if (!Number.isInteger(bucketCount) || bucketCount <= 0) {
		throw new RangeError(
			`bucketCount must be a positive integer, received ${bucketCount}`,
		);
	}

	return allocateProportionally(total, new Array<number>(bucketCount).fill(1));
}

/**
 * Splits `total` proportionally to `weights` using the largest-remainder
 * method, so the result always sums back to `total` with no rounding drift.
 *
 * Negative totals are supported (e.g. allocating a discount): the magnitude is
 * allocated and the sign reapplied, keeping the output order stable.
 * Ties are broken by ascending index, which makes the function deterministic
 * across the client and the server.
 */
export function allocateProportionally(
	total: Cents,
	weights: readonly number[],
): Cents[] {
	const totalValue = toCents(total);

	for (const weight of weights) {
		if (!Number.isSafeInteger(weight) || weight < 0) {
			throw new RangeError(
				`Weights must be non-negative integers, received ${weight}`,
			);
		}
	}

	if (weights.length === 0) {
		return [];
	}

	const weightUnits = weights.map((weight) => BigInt(weight));
	const totalWeight = weightUnits.reduce((sum, weight) => sum + weight, 0n);

	if (totalWeight === 0n) {
		// Nothing to weigh by, so an even split is the only fair answer.
		return allocateProportionally(
			totalValue,
			weights.map(() => 1),
		);
	}

	const negative = totalValue < 0;
	const magnitude = BigInt(negative ? -totalValue : totalValue);

	const shares: bigint[] = [];
	const remainders: bigint[] = [];

	for (const weight of weightUnits) {
		const weighted = magnitude * weight;
		shares.push(weighted / totalWeight);
		remainders.push(weighted % totalWeight);
	}

	const allocated = shares.reduce((sum, share) => sum + share, 0n);
	let leftOver = magnitude - allocated;

	const order = weights
		.map((_, index) => index)
		.sort((left, right) => {
			const leftRemainder = remainders[left] ?? 0n;
			const rightRemainder = remainders[right] ?? 0n;
			if (leftRemainder === rightRemainder) {
				return left - right;
			}
			return leftRemainder > rightRemainder ? -1 : 1;
		});

	for (const index of order) {
		if (leftOver <= 0n) {
			break;
		}
		shares[index] = (shares[index] ?? 0n) + 1n;
		leftOver -= 1n;
	}

	const sign = negative ? -1n : 1n;
	return shares.map((share) => toCents(Number(share * sign)));
}
