# FairShare Receipts — Architecture

> **Status:** Baseline updated 2026-11-25 after the Phase 1 domain implementation. Verify implementation details against source code, package manifests, Drizzle configuration, and Worker configuration before relying on anything not explicitly marked **Implemented** here.

**Status labels used in this document**

- **Implemented** — present in the repository and verified by reading the code or running the documented checks.
- **Decided** — recorded in an ADR under `docs/decisions/`; implemented or being implemented.
- **Next phase** — agreed direction for the upcoming phase; not implemented yet.
- **Open** — undecided. Do not treat it as current behaviour, and do not resolve it silently in code.

## Implementation Snapshot (verified 2026-11-25)

Verified by reading the repository and running `bun run typecheck` (4/4 workspaces pass) and `bun test` (65 passing tests).

| Area                                                               | State                        | Evidence                                                                                                                                     |
| ------------------------------------------------------------------ | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Root tooling                                                       | Implemented                  | Bun workspaces; scripts `lint`, `lint:fix`, `format`, `test`, `typecheck` in `package.json`                                                  |
| Money, parsing, allocation                                         | Implemented                  | `packages/shared/src/money.ts`, `allocate.ts` (ADR-0001, ADR-0002)                                                                           |
| Receipt split and debt simplification                              | Implemented                  | `packages/shared/src/split.ts`, `debts.ts` (ADR-0003, ADR-0004)                                                                              |
| Shared Valibot contracts                                           | Implemented                  | `packages/shared/src/schemas/` (ADR-0005)                                                                                                    |
| Shared tests                                                       | Implemented                  | 5 `bun:test` files, 65 passing tests covering money, allocation, split, debts, and schemas                                                   |
| API HTTP surface                                                   | Minimal                      | `apps/api/src/index.ts` exposes one `GET /` handler; no tRPC, routes, auth, or persistence calls                                             |
| Cloudflare configuration                                           | Implemented (binding level)  | `apps/api/wrangler.jsonc`: D1 `DB` (`fairshare-db`), R2 `RECEIPTS` (`fairshare-receipts`), observability enabled; `AI` binding commented out |
| Workers binding types                                              | Missing                      | No `worker-configuration.d.ts` and no `@cloudflare/workers-types`; `env.DB` and `env.RECEIPTS` remain untyped until `wrangler types` runs    |
| Mobile app                                                         | Starter only                 | Expo Router starter screens under `apps/mobile/src/app/`; no product screens, API client, or `@fairshare/shared` imports                     |
| Database package                                                   | Scaffold only                | `packages/db/src/index.ts` is `export {};`; dependencies installed, no schema, queries, migrations, or `drizzle.config.ts`                   |
| tRPC, Drizzle schema/migrations, authentication, OCR, LLM adapters | Next phase / not implemented | No tRPC references in source or `bun.lock`; `packages/db` is empty; no auth modules                                                          |

## 1. Product Overview

FairShare Receipts helps groups divide shared expenses fairly. The intended product workflow is:

1. A user supplies a receipt photo.
2. An OCR step recognizes text and (where available) its position and confidence in the image.
3. A deterministic parser turns OCR observations into candidate receipt fields and line items.
4. Quality and consistency checks decide whether the candidate is sufficiently complete or needs vision-LLM assistance.
5. Participants review the extracted receipt, then collaboratively claim or split receipt items.
6. The application calculates participant shares and balances.
7. Debts can be simplified across multiple trips to reduce the number of transfers.

OCR, deterministic parsing, and vision-LLM extraction are assistive steps, not authorities. Recognized text, item grouping, amounts, and descriptions can be wrong. All extraction paths must converge on the same validated candidate contract and follow the product's review / approval workflow before extracted data is used for financial allocations.

## 2. Technology Baseline

| Area                              | Technology / responsibility                                                  | Status                                                              |
| --------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Monorepo tooling                  | Bun workspaces and root scripts                                              | Implemented                                                         |
| Mobile client                     | Expo + React Native; Expo Router navigation in `apps/mobile`                 | Implemented (starter app only)                                      |
| API runtime                       | Hono on Cloudflare Workers in `apps/api`                                     | Implemented (single `GET /` handler)                                |
| API transport                     | tRPC                                                                         | Next phase — not a dependency yet                                   |
| Relational persistence            | Cloudflare D1 binding `DB`; Drizzle ORM in `packages/db`                     | Binding implemented; schema, queries, and migrations are next phase |
| Object storage                    | Cloudflare R2 binding `RECEIPTS`                                             | Binding implemented; no read/write code yet                         |
| Shared contracts and domain logic | TypeScript + Valibot in `packages/shared`                                    | Implemented (money, allocation, split, debts, extraction contract)  |
| Lint / formatting                 | Biome (`biome.json`), including Markdown and a custom React Native text rule | Implemented                                                         |
| Tests                             | `bun:test` in `packages/shared`                                              | Implemented; no API / mobile / db runner yet                        |

Do not infer exact package versions, deployment commands, binding names, authentication providers, LLM providers, or test frameworks from this summary. Read the relevant configuration before making changes.

## 3. Monorepo Responsibilities and Boundaries

### `apps/mobile`

Owns the user interface, navigation, device-specific functionality, and client-side interaction flow. It may use shared schemas and domain helpers, but it is not a security boundary and must not contain privileged secrets.

### `apps/api`

Owns HTTP / tRPC entry points, request orchestration, server-side validation and authorization, Cloudflare-specific integration, and coordination with persistence, object storage, and external extraction services such as OCR / document-AI and the vision LLM.

The API is the authority for protected mutations and persisted financial state. Do not trust client-supplied totals, claims, ownership, or settlement calculations without server-side verification.

### `packages/shared`

Owns reusable TypeScript types, Valibot schemas, and pure domain / mathematical helpers. It must remain platform-agnostic and deterministic. It must not depend on app packages, Cloudflare runtime globals, or database-specific code.

### `packages/db`

Owns Drizzle schema definitions, database queries, and migrations. The package is currently an empty scaffold (see section 7). Keep persistence-specific concerns here rather than leaking them into the mobile client or pure shared domain package.

### Dependency direction

The intended direction is:

- `apps/mobile` may depend on `packages/shared`.
- `apps/api` may depend on `packages/shared` and `packages/db`.
- `packages/shared` must not depend on application or database packages.
- `packages/db` must not depend on application packages.
- Avoid circular dependencies and direct imports from one application (`apps/*`) into another.

Verify actual workspace dependencies before changing package boundaries. A package may have additional dependencies only when there is a clear, documented reason.

## 4. Domain Invariants

### Money

- Represent monetary values used in domain calculations as integer cents.
- Never use binary floating-point values for authoritative financial arithmetic.
- Keep currency identity explicit. Do not combine or net amounts in different currencies without an explicit conversion policy.
- Define deterministic behavior for uneven splits, tax / tip allocation, discounts, and leftover cents. If the current code does not establish a policy, record the open question before implementing a new behavior.
- Check integer range, database representation, and API serialization when changing money-related code.

**Status:** Implemented in `packages/shared` — `src/money.ts` and `src/allocate.ts`; see ADR-0001 and ADR-0002. Uneven splits use largest-remainder allocation with deterministic index tie-breaking; unclaimed amounts are tracked separately rather than redistributed (ADR-0003). Two known gaps are recorded in section 10: `Cents` does not encode currency, and the two-decimal assumption does not fit every ISO 4217 currency.

### Receipt extraction

The intended direction is an OCR-first, LLM-assisted pipeline. The exact OCR engine, execution location, parser strategy, and confidence thresholds remain open until evaluated against representative receipts.

**Status:** Next phase. The only implemented piece is the provider-neutral contract and arithmetic reconciliation in `packages/shared/src/schemas/receipt.ts` (ADR-0005). There is no OCR engine, deterministic parser, quality gate, LLM adapter, or receipt corpus in the repository yet. The bullets below describe the intended design, not current behaviour.

- OCR recognizes text and, where supported, returns line / word geometry and confidence. Preserve this information when it helps associate item descriptions, quantities, and prices.
- A deterministic parser should handle straightforward receipt structures and locale-aware values where practical. It should produce candidate receipt fields and line items, not trusted facts.
- Parse monetary text exactly and convert it to integer cents without a binary floating-point intermediate. Do not guess a missing currency or silently choose between ambiguous decimal / thousands separators.
- A quality gate should consider more than raw OCR confidence: image quality, critical-field confidence, parser completeness, ambiguous item / price associations, and arithmetic or domain consistency.
- A failed arithmetic check is a signal for review or LLM assistance, not automatic proof of OCR failure. Discounts, deposits, taxes, coupons, fees, rounding, and receipt-specific conventions can legitimately affect totals.
- Use the vision LLM as a fallback or targeted assistant for poor OCR, unfamiliar layouts, ambiguous associations, missing fields, or unresolved consistency issues. When useful, send the original image together with OCR observations. The model may resolve ambiguity but must not invent unsupported values.
- OCR-only, parser, and LLM results must converge on one provider-neutral receipt-candidate contract and pass the same shared Valibot schema and domain checks. Keep vendor SDKs and raw provider response types in the relevant adapter / integration layer.
- Preserve provenance and uncertainty where practical, such as source text region, extraction method, provider / model version, and field-level confidence. Do not interpret confidence as a calibrated probability unless validated as such.
- Require user review / correction before extracted amounts and items become the basis for collaborative allocations. Do not enable automatic acceptance until a representative benchmark demonstrates adequate field-level and exact-amount accuracy.
- Evaluate against a consented or appropriately redacted, manually labeled corpus covering different vendors, image quality, layouts, supported languages, decimal / currency formats, discounts, taxes, and long receipts. Measure line-item precision / recall, exact price and total accuracy, review / escalation rate, latency, and cost per receipt.
- Provider-specific request / response details must not leak into `packages/shared`. Shared code owns only provider-neutral contracts and pure parsing / validation helpers.

### Collaborative item allocation

- The product supports participants claiming or splitting receipt items.
- The API must verify that a participant is allowed to view or modify the relevant trip / receipt / item.
- Recalculate or verify authoritative totals server-side. Do not accept client totals as authoritative.
- Preserve an auditable and consistent state when concurrent participants modify claims or allocations. Inspect existing transaction / concurrency handling before changing it.

### Debt simplification

- Debt-simplification logic belongs in pure shared domain helpers when it is reusable and does not require I/O.
- Preserve the total amount owed and the net position of each participant.
- Tests should verify conservation of value, balanced net positions, valid non-negative transfer amounts (where required by the algorithm), and behavior for zero / already-settled / disconnected cases as applicable.
- Do not claim a globally minimal transfer count unless the implementation and tests establish the exact optimization objective and constraints.

## 5. Important Data Flows

The following are target flows, not current behaviour. `splitReceipt`, `buildBalances`, and `simplifyDebts` exist in `packages/shared`, but the API exposes no endpoints, uploads, OCR calls, or LLM calls yet. Confirm exact endpoint names, storage lifecycle, review steps, and provider integration in source code before changing them.

### Receipt capture and extraction

The conceptual extraction flow is:

1. The mobile app captures or selects a receipt image and enforces basic client-side file / image constraints for user experience.
2. The configured upload / storage flow handles the original image. Preserve the original or a sufficiently faithful source for later review and vision-LLM assistance; do not make destructive preprocessing the only retained copy unless the product explicitly chooses that policy.
3. A selected OCR implementation recognizes text. It should retain geometry and per-line / word confidence when available.
4. A receipt parser groups OCR observations into candidate header fields, line items, quantities, prices, taxes, discounts, and totals. Parsing must account for the supported locale and currency conventions.
5. A quality gate evaluates image / OCR quality, parse completeness, critical-field confidence, ambiguous associations, and domain / arithmetic consistency.
6. If the result is incomplete or ambiguous, the API may invoke the vision LLM with the original image and OCR output as context. It may also use the LLM to help interpret specific unresolved fields rather than re-extracting the entire receipt.
7. All extraction paths produce the same provider-neutral receipt candidate. The server validates it with shared Valibot schemas and domain rules, then presents it through the receipt review / correction workflow.
8. Only user-reviewed / confirmed data proceeds into collaborative item allocation, according to the product's rules.

The execution location is an open design choice. On-device OCR can improve privacy and offline behavior, but requires compatible native functionality and appropriate Expo build support; client-produced results remain untrusted and must be validated by the API. A managed server-side OCR / receipt-extraction API can provide consistent behavior and structured fields, but introduces external data processing, network latency, provider cost, and vendor dependency. A self-hosted OCR service offers control but adds operational burden. Do not choose a provider or execution location without measuring accuracy, cost, latency, privacy, supported languages, and runtime compatibility on representative receipts.

Do not assume that a specific upload protocol, signed-URL design, image transformation service, queue, or asynchronous job system exists unless it is visible in the implementation.

### Claims, splits, and balances

1. The client submits a requested claim or allocation change.
2. The API authenticates the caller and authorizes access to the target resource.
3. The API validates the request and verifies relevant domain rules.
4. Persistence is performed through the established `packages/db` layer.
5. Authoritative totals and balances are calculated or verified using shared domain logic and server-side data.

Inspect current concurrency and transaction behavior before modifying simultaneous claim / split operations.

### Trip debt simplification

1. The application obtains the relevant participant balances / debts from persisted state.
2. Shared pure logic calculates a simplified set of transfers.
3. The result must preserve all participant net positions and the total amount owed.
4. Any settlement action must be separately authorized and persisted through the API.

The algorithm, objective, and tie-breaking rules are recorded in ADR-0004. The settlement lifecycle (recording that a transfer actually happened) remains open.

## 6. API and Validation Conventions

- Hono is implemented with a single public route (`apps/api/src/index.ts`). tRPC is the agreed transport for the next phase but is **not** a dependency yet.
- Shared Valibot schemas should be reused for contracts that are shared between client and server.
- Validate all client-controlled data on the server.
- Keep authorization checks close to protected operations and resource access.
- Keep provider-specific or Cloudflare-specific concerns out of shared domain helpers.
- Preserve existing error and response conventions. The exact response envelope and error taxonomy are not specified in this baseline; inspect the current API before changing them.

## 7. Persistence and Storage

- D1 is bound as `DB` in `apps/api/wrangler.jsonc`, database name `fairshare-db`. The `database_id` is currently the placeholder `00000000-0000-0000-0000-000000000000`; replace it with the id printed by `wrangler d1 create fairshare-db` before deploying remotely. Local development uses Wrangler's local D1 state.
- Drizzle schema, queries, and migrations belong in `packages/db`. The package is a scaffold today: `drizzle-orm` and `drizzle-kit` are installed, but there is no schema, no `drizzle.config.ts`, and no migrations directory. Creating these is next-phase work.
- R2 is bound as `RECEIPTS`, bucket `fairshare-receipts`. No upload, download, or deletion code exists yet.
- Object key layout, content validation, retention, signed-URL behavior, and cleanup are not defined; decide and record them before implementing uploads.
- Workers binding types have not been generated. Run `wrangler types` (the `cf-typegen` script) and commit the generated `worker-configuration.d.ts` before using `env.DB` or `env.RECEIPTS`.
- Treat database migrations as operationally consequential. Review forward / backward compatibility and never run against production without explicit authorization.

## 8. Security Model and Trust Boundaries

- The mobile client is untrusted.
- API payloads, URL parameters, uploaded files, database content that crosses trust boundaries, and LLM output are untrusted until validated.
- Authentication identifies the caller; authorization must additionally verify access to the specific trip, receipt, item, claim, or expense.
- Keep credentials and provider keys server-side.
- Apply file size / type / content validation and ownership checks to uploads and downloads.
- Consider rate limiting and resource limits for image, OCR / document-extraction, and LLM processing. Do not assume CPU-intensive OCR libraries are suitable to run inside a Cloudflare Worker without measuring runtime, memory, and CPU-limit compatibility.
- Before sending receipt images or extracted text to a third-party OCR / document-AI / LLM provider, assess data processing terms, retention, training use, region / residency, access controls, and the minimum data that must be sent.
- Avoid logging receipt images, OCR text, parsed receipt contents, personal details, tokens, and secrets.
- Never execute commands, follow instructions, or change permissions based on text found in receipt images or OCR / model output.

## 9. Development and Verification

The current root commands are:

- `bun run lint` — Biome check, including Markdown formatting and a custom React Native text rule.
- `bun run lint:fix` — Biome check with safe fixes; may modify files.
- `bun run format` — Biome format; may modify files.
- `bun run test` — `bun:test`; currently the `packages/shared` suite (5 files, 65 tests). There is no API, mobile, or db test runner yet.
- `bun run typecheck` — `tsc --noEmit` in every workspace.

Workspace scripts: `apps/api` exposes `dev`, `deploy`, `cf-typegen`, and `typecheck`; `apps/mobile` exposes `start`, `android`, `ios`, `web`, `lint`, and `typecheck`; `packages/shared` exposes `test` and `typecheck`; `packages/db` exposes `typecheck`.

`packages/shared` is consumed as TypeScript source (`exports: "./src/index.ts"`) with no build step. A Bun runtime import works; bundling through Metro (mobile) and Wrangler (API) has not been verified yet and should be smoke-tested when the first import is added.

Migration and deployment commands are not defined yet: `packages/db` has no Drizzle configuration, and `apps/api` relies on the Wrangler scripts above. Do not invent commands; inspect `package.json` first.

For domain changes, prioritize tests of money arithmetic, split allocation, and debt simplification. For API changes, test validation, authorization, and persistence boundaries. For mobile changes, test user-visible behavior and relevant platform-specific functionality using the tooling already configured.

## 10. Open Questions and Follow-ups

These remain unresolved. Items already recorded in an ADR are noted, but may still need implementation work.

### Money and domain

- **Currency support and minor units.** `Cents` assumes two decimal places, while `currencyCodeSchema` accepts any ISO 4217 code. Decide between a two-decimal allowlist and minor-unit-aware amounts (ADR-0001 records the gap).
- **Currency explicitness.** `simplifyAcrossTrips` has no currency parameter, and the extraction and trip schemas default to `"EUR"` when currency is omitted. Decide whether the field must be explicit and how mixed-currency trips are refused.
- **Settlement lifecycle.** Recording that a transfer actually happened, and how it interacts with recalculated balances.
- **Debt-simplification objective.** ADR-0004 accepts a deterministic greedy result that is not guaranteed minimal. Revisit only if transfer count proves to matter in practice.

### Extraction

- OCR / receipt-extraction provider and execution location (on-device, managed service, or self-hosted), supported languages, and Expo / Cloudflare runtime compatibility.
- Parser strategy, provenance representation, quality-gate signals, and any calibrated escalation thresholds.
- Partial-candidate representation. `receiptExtractionSchema` is complete-only and has no provenance or confidence fields (ADR-0005).
- LLM provider, model, prompt/versioning approach, OCR-context strategy, retries, and error handling.
- Representative receipt benchmark corpus, privacy / redaction rules, evaluation metrics, and criteria for any future automatic acceptance.

### Platform

- Authentication provider, token/session model, and the authorization strategy for trips, receipts, items, and claims — including how join codes are rate-limited and whether they are secrets or capability tokens.
- Database schema, transaction / concurrency strategy, and migration workflow.
- Receipt image upload protocol, R2 key structure, access controls, retention, and deletion lifecycle.
- API error conventions and the public tRPC contract.
- Test runner for `apps/api` (for example `@cloudflare/vitest-pool-workers`) and how the root `test` script should dispatch once more than one runner exists.
- Local development, preview, and production deployment workflows, including replacing the placeholder D1 `database_id`.

When one of these becomes established, update this document and add an ADR if it represents a lasting architectural or domain decision.
