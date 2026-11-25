# ADR-0001 — Represent monetary amounts as integer cents

- **Date:** 2026-11-25
- **Status:** Accepted

## Context

The application splits receipts, allocates tax and tip, computes balances, and simplifies debts. Binary floating point cannot represent most decimal amounts exactly (`0.1 + 0.2 !== 0.3`), so float arithmetic leaves residual cents that never settle. TypeScript also cannot distinguish "euros" from "cents" when both are plain numbers.

The implementation lives in `packages/shared/src/money.ts` and is consumed by `allocate.ts`, `split.ts`, `debts.ts`, and `schemas/common.ts`.

## Decision

- Domain amounts are integer minor units: `type Cents = number & { readonly __brand: "Cents" }`.
- `toCents(value)` is the only conversion gate. It rejects non-safe-integers and is applied after every arithmetic operation (`addCents`, `subtractCents`, `sumCents`, ...).
- Human or model-provided text is converted by `parseAmountToCents`, which splits the digit string and uses integer arithmetic. No floating-point intermediate is used.
- `formatCents` is the only function that divides by 100, and it is display-only.
- Amounts are bounded by `MAX_AMOUNT_CENTS` (999_999_999), enforced in the Valibot `centsSchema`.

## Consequences

Benefits:

- Amount conservation is exact and testable; splits cannot drift.
- Unit confusion (euros vs cents) becomes a compile error rather than a runtime bug.
- Persistence and JSON serialization stay plain integers.

Trade-offs and follow-ups:

- Branded numbers are awkward in test expectations; `src/test-helpers.ts` (`plain`) strips the brand for assertions only.
- The brand exists only at compile time. Values crossing a trust boundary must be re-validated (`centsSchema`/`toCents`) and never assumed from JSON.
- The type encodes magnitude but not currency. Currency identity is carried separately (trip and extraction `currency`); preventing cross-currency netting is the caller's responsibility. Resolved for the MVP by ADR-0006: EUR is the only supported currency and is required explicitly.
- The model assumes two decimal places. `currencyCodeSchema` accepts any ISO 4217 code, so currencies with 0 or 3 minor units (e.g. JPY, KWD) are not handled correctly yet.
- Parsing heuristic: a single separator followed by three digits is treated as a thousands separator (`1.234` becomes 123400). This is a recorded policy, not a universal truth.

## Alternatives Considered

- **Floating-point euros/dollars:** rejected; cannot represent decimal money exactly and makes leftover-cent behaviour unpredictable.
- **Decimal library (`decimal.js` / `big.js`):** rejected for the domain core; adds a dependency, still requires a rounding policy, and does not prevent unit confusion. `Intl` remains at the formatting edge.
- **Plain `number` cents with naming conventions:** rejected; nothing stops a euro value from reaching split logic.

## Related

- ADR-0002 — allocation and rounding policy
- ADR-0003 — receipt split semantics
- ADR-0004 — debt simplification
