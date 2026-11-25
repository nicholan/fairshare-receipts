# ADR-0004 — Simplify debts with greedy max-creditor/max-debtor matching

- **Date:** 2026-11-25
- **Status:** Accepted

## Context

After receipts are split, each participant has a net position (paid minus owed). Settling every pair separately produces many transfers. The product promise is to reduce the number of transfers, including across multiple trips.

Implemented in `packages/shared/src/debts.ts` (`buildBalances`, `simplifyDebts`, `simplifyAcrossTrips`).

## Decision

- `buildBalances` derives `netCents = paidCents - owedCents` per participant.
- `simplifyDebts` greedily matches the largest outstanding creditor with the largest outstanding debtor, emits one transfer per match, and repeats. Ordering is by remaining amount descending, then participant id ascending, so the output is deterministic.
- Each match reduces at least one side to zero, so the result contains at most `n - 1` transfers for `n` participants and preserves every net position.
- `unallocatedCents` reports the sum of net positions. A positive value means creditors are owed money that no debtor can settle (for example, unclaimed items); it is surfaced rather than hidden.
- `simplifyAcrossTrips` aggregates `paidCents`/`owedCents` per participant across trips before simplifying, which is what actually reduces transfers overall.

## Consequences

- Deterministic, cheap (`O(n log n)`), and easy to test against conservation invariants.
- **Not** a minimal-transfer solution. Minimising the number of transfers is a combinatorial problem; the greedy result is a good, explainable approximation and must not be described as optimal.
- Cross-trip aggregation can produce a transfer between two people who never shared a single trip. That is intended (it reduces total transfers) but the product must allow it.
- **Currency is not part of the function signature.** Callers must not pass contributions from trips in different currencies. Resolved for the MVP by ADR-0006: only EUR trips can be persisted, so all contributions are EUR; this signature must gain an explicit currency before any other currency is introduced.

## Alternatives Considered

- **Minimum-transfer optimisation (integer programming / flow formulation):** deferred; materially more complex, and the practical gain over greedy matching on small groups is marginal.
- **Pairwise proportional settlement (everyone pays everyone):** rejected; produces up to `n(n-1)/2` transfers.
- **No simplification:** rejected; defeats the multi-trip value proposition.

## Related

- ADR-0001 — integer cents and the open currency question
- ADR-0003 — receipt split semantics that produce the net positions
