# ADR-0005 — One provider-neutral receipt extraction contract with an arithmetic review gate

- **Date:** 2026-11-25
- **Status:** Accepted for the contract; pipeline stages remain open

## Context

Receipt data may come from OCR, a deterministic parser, and a vision LLM. All three are untrusted: they omit lines, misread separators, and occasionally invent values. A single contract is required so every source validates identically and so provider SDK types never leak into domain code.

Implemented in `packages/shared/src/schemas/receipt.ts`.

## Decision

- `receiptExtractionSchema` is the single candidate contract: `merchant`, `purchasedAt`, `currency`, `items` (`description`, `quantity`, `unitPriceCents`, `totalCents`), `taxCents`, `tipCents`, `serviceChargeCents`, non-negative `discountCents`, and `totalCents`. All money is integer cents.
- Every source maps into this contract. Raw vendor request/response types and SDKs stay in the API integration layer.
- `validateReceiptExtraction(raw)` returns a discriminated result: `{ ok: true, value, reconciliation }` or `{ ok: false, issues }`. It never throws on malformed input.
- `reconcileExtraction` computes `items + tax + tip + service - discount` and reports `discrepancyCents` against the declared total. A non-zero discrepancy is a review signal, not an automatic rejection, because receipts contain deposits, coupons, fees, and rounding conventions.
- Extracted data is candidate data. It may only feed collaborative allocations after explicit user review or correction.

## Consequences

- OCR, parser, and LLM outputs converge on the same validation and therefore the same failure modes.
- The contract is **complete-only**: at least one item and a total are required, so a partial OCR candidate cannot be represented. It also has no provenance or confidence fields (source region, extraction method, provider/model version). Both are required by the architecture and are future work.
- `currency` is now **required** and accepts only `"EUR"` (ADR-0006). A missing or non-EUR currency is a validation failure; extraction never guesses currency.
- Validation is pure and deterministic, so it can run on client and server; the server remains the authority.

## Alternatives Considered

- **Provider-specific schemas:** rejected; duplicated validation and vendor coupling.
- **Accept raw provider JSON in domain code:** rejected; leaks vendor shapes and skips domain checks.
- **Free-text LLM output parsed with ad-hoc regex:** rejected; unvalidated, unreproducible, and hard to test.

## Related

- ADR-0001 — integer cents
- ADR-0003 — how validated candidates become allocations
