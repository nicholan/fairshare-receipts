# ADR-0003 — Receipt split semantics: even item claims, proportional extras, explicit unclaimed bucket

- **Date:** 2026-11-25
- **Status:** Accepted

## Context

Participants claim items collaboratively (zero, one, or several claimants per item). Receipts carry receipt-level tax, tip, service charge, and discounts. Extraction may be incomplete, so some items can be unclaimed when balances are computed. The system must not silently redistribute money a user did not claim, and it must surface when the parsed receipt does not add up.

Implemented in `packages/shared/src/split.ts` (`splitReceipt`).

## Decision

- Item totals are split evenly among the participants claiming that item, via `allocateEvenly`. Duplicate claim ids are de-duplicated.
- `tax + tip + serviceCharge - discount` ("extras") is allocated proportionally to each participant's claimed subtotal, with the unclaimed subtotal included as its own weight.
- Unclaimed items and their proportional extras are reported separately (`unclaimedItemsCents`, `unclaimedExtrasCents`) and are never redistributed to claimants.
- `discountCents` is a non-negative absolute amount and is subtracted. Negative item totals are rejected.
- When a printed total is supplied, `discrepancyCents` reports `expected - computed` so a dropped line is visible. `reconciles` only asserts internal conservation of the computed total; it does not mean the receipt adds up.
- Unknown participant ids, duplicate participant ids, unknown item ids, and duplicate item ids throw `RangeError`.

## Consequences

- Participants pay only for what they claim; unclaimed money stays visible to the UI and to settlement (`DebtSummary.unallocatedCents`).
- Extras are allocated by subtotal, not per item. That matches the common single tax line but is not correct for per-category tax; that would need a separate function.
- The API must sanitize stale claims (for example, a member removed from a trip) before calling this function, or translate `RangeError` into a 4xx response.
- Deterministic remainder assignment means identical claims always yield identical cents.

## Alternatives Considered

- **Split everything evenly regardless of claims:** rejected; defeats the product's purpose.
- **Redistribute unclaimed amounts among claimants:** rejected; hides missing claims and charges people for items they did not take.
- **Allocate extras equally per participant:** rejected; unfair when subtotals differ substantially.
- **Per-item tax allocation:** deferred; more precise, but receipts usually expose a single tax line and the added complexity is not justified yet.

## Related

- ADR-0001 — integer cents
- ADR-0002 — allocation policy
- ADR-0004 — debt simplification
