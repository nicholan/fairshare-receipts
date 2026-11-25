# ADR-0002 — Allocate indivisible amounts by largest remainder with deterministic tie-breaking

- **Date:** 2026-11-25
- **Status:** Accepted

## Context

Splitting a receipt regularly produces amounts that do not divide evenly: 100 cents shared by three people, or a single tax line distributed across participants with different subtotals. Somebody must receive the extra cent. The result must be identical on every device and on the server, otherwise totals disagree and debts never settle.

Implemented in `packages/shared/src/allocate.ts` and used by `splitReceipt` (`packages/shared/src/split.ts`).

## Decision

- `allocateProportionally(total, weights)` uses the largest-remainder method: integer division first, then leftover cents go to the largest fractional remainders.
- Ties are broken by ascending index, which makes the output deterministic and reproducible.
- Arithmetic uses `BigInt` internally so `total * weight` cannot lose precision before the division.
- `allocateEvenly(total, n)` is the same function with equal weights.
- Negative totals (discounts) are supported by allocating the magnitude and re-applying the sign.
- All-zero weights fall back to an even split. An empty weight array returns an empty array. Non-integer or negative weights throw `RangeError`.

## Consequences

- Shares always sum exactly to the input. This is enforced by a grid test (totals 0-200, buckets 1-9) plus weighted property-style assertions.
- Client and server can compute the same cents independently, which supports the polling-based collaboration model.
- The earliest buckets systematically receive the extra cent. That is arbitrary but stable, and it is documented rather than accidental.
- Requires `BigInt`, available in modern Hermes, Cloudflare Workers, and Bun.

## Alternatives Considered

- **Floor each share and give the entire remainder to the first participant:** rejected; concentrates up to n-1 cents on one person.
- **Round half up per share:** rejected; rounded shares may not sum to the total.
- **Random remainder assignment:** rejected; non-deterministic and produces client/server disagreement.
- **Exact rational arithmetic:** rejected as unnecessary for receipt-sized integers; BigInt already provides exactness with less machinery.

## Related

- ADR-0001 — integer cents
- ADR-0003 — receipt split semantics
