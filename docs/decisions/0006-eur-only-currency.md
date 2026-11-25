# ADR-0006 — EUR-only currency policy with explicit currency

- **Date:** 2026-11-25
- **Status:** Accepted

## Context

The Phase 1 domain model represents money as two-decimal integer cents (`Cents`), but the contracts contradicted that assumption:

- `currencyCodeSchema` accepted any three-letter ISO 4217 code, including currencies with 0 or 3 minor units (JPY, KWD), which `Cents` cannot represent correctly.
- `receiptExtractionSchema` and `tripCreateInputSchema` filled in `"EUR"` when currency was omitted, which guesses currency and violates the "never guess currency" rule.
- `simplifyAcrossTrips` has no currency parameter, so nothing structurally prevented netting amounts from different currencies.

The product has no multi-currency requirement yet: trips, receipts, and settlements are expected to be euro-denominated for the initial release. Supporting additional currencies would require an ISO 4217 exponent table, a currency-aware amount type, conversion policy for cross-currency aggregation, and locale/formatting work before any of it could be trusted.

## Decision

- **EUR is the only supported currency for the MVP.**
- `packages/shared/src/money.ts` exports `SUPPORTED_CURRENCY_CODE = "EUR"` and `SupportedCurrencyCode`.
- `currencyCodeSchema` accepts only `"EUR"` and rejects every other value with a clear error. It no longer accepts arbitrary ISO 4217 codes.
- Currency is **required and explicit**:
  - `tripCreateInputSchema.currency` has no default.
  - `receiptExtractionSchema.currency` has no default. A missing or unsupported currency is a validation failure, not a guess.
- Amounts remain two-decimal integer cents, which is exact for EUR. `formatCents` defaults to EUR and only accepts `SupportedCurrencyCode`.
- Every persisted trip carries its currency; the D1 schema constrains it to `'EUR'` so a bad write cannot bypass the shared schema.
- `simplifyAcrossTrips` keeps its currency-free signature because only EUR amounts can reach it. Currency is enforced at the schema and database boundaries. This function must gain an explicit currency argument before any other currency is introduced.
- `parseAmountToCents` remains a magnitude-only parser: it strips currency markers and never infers currency. Callers must establish currency from an explicit field.

## Consequences

Benefits:

- No path silently converts a dollar, pound, or krone amount into euros.
- The amount representation matches the only supported currency exactly, with no exponent table or rounding ambiguity.
- The limitation is explicit in the contract, the UI, and the database instead of being an undocumented assumption.

Trade-offs and follow-ups:

- Non-EUR receipts and trips are rejected. That is a product limitation, not an implementation defect.
- Adding a second currency requires a new ADR covering minor-unit exponents, storage, parsing, formatting, and the cross-currency aggregation prohibition. A future migration can rename `amount_cents` columns to `amount_minor` at that point.
- `parseAmountToCents` still strips non-EUR markers such as `$` or `kr`. Under this policy those sources must be treated as unsupported currency by the extraction layer; detecting and rejecting non-EUR markers during deterministic parsing remains open (recorded in `docs/architecture.md`).
- `SUPPORTED_CURRENCY_CODE` is a single constant, not a list, so adding currencies is a deliberate code change rather than a configuration change.

## Alternatives Considered

- **Two-decimal ISO 4217 allowlist (EUR, USD, GBP, CHF, SEK, ...):** workable, but it implies multi-currency support and invites cross-currency aggregation before a conversion policy exists. Rejected as premature.
- **Minor-unit-aware money (ISO 4217 exponent table, 0/2/3-digit currencies):** the most general model, but it changes the amount type, allocation, persistence, parsing, and formatting for a requirement the product does not have yet. Deferred until multi-currency is actually needed.
- **Keep the implicit `"EUR"` default:** rejected; it hides missing data and violates the rule that currency is never guessed.
- **Accept any ISO code while documenting "EUR only":** rejected; a schema that accepts USD while the domain assumes euros is a silent correctness bug.

## Related

- ADR-0001 — integer cents and the previously open currency question
- ADR-0004 — cross-trip simplification relies on a single currency
- ADR-0005 — extraction contract; currency is now required
