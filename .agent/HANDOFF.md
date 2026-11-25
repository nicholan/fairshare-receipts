# Agent Session Handoff

## Goal

FairShare Receipts — Phase 1 is complete: shared money/allocation/split/debt domain logic, Valibot contracts, tests, and the documentation baseline. The next phase (user-confirmed direction) is tRPC + Drizzle/D1 + the Cloudflare API built on `packages/shared`.

## Status

- Completed:
  - `packages/shared`: integer-cent money module with locale-aware parsing/formatting, largest-remainder allocation, `splitReceipt`, `buildBalances`/`simplifyDebts`/`simplifyAcrossTrips`, and Valibot schemas for receipt extraction, trips, claims, corrections, and settlements. 65 `bun:test` cases.
  - Repo tooling: root `lint`, `lint:fix`, `format`, `test`, `typecheck` scripts; Bun test types; expanded `.gitignore`; env examples; D1 `DB` and R2 `RECEIPTS` bindings; stray `apps/api/pnpm-workspace.yaml` removed.
  - Documentation: `AGENTS.md`, `docs/architecture.md` (verified implementation snapshot plus status labels), `docs/decisions/0001`–`0005`, `.agent/HANDOFF.template.md`.
- In progress:
  - None.

## Decisions and Constraints

- Money is integer cents with a branded `Cents` type; no floating point in domain arithmetic (ADR-0001).
- Allocation uses largest remainder with deterministic index tie-breaking (ADR-0002).
- Split semantics: even item claims, extras proportional to claimed subtotal, explicit unclaimed bucket (ADR-0003).
- Debt simplification is greedy and deterministic, at most n−1 transfers, explicitly not minimal (ADR-0004).
- Extraction uses one provider-neutral contract plus an arithmetic reconciliation gate; no automatic acceptance (ADR-0005).
- tRPC, Drizzle schema/migrations, and the Cloudflare API are the agreed next-phase focus. None of them exist in the codebase yet.
- `.cline/skills/` was intentionally removed from `AGENTS.md`; do not re-add it without a real skill to host.
- `.agent/HANDOFF.md` is committed at the end of every session (repository policy). Keep it free of secrets, tokens, and receipt data.
- OCR/LLM output is candidate data only. User review is required before anything feeds collaborative allocation.

## Files

- `packages/shared/src/money.ts` — `Cents`, `toCents`, `parseAmountToCents`, `formatCents`, cent arithmetic.
- `packages/shared/src/allocate.ts` — `allocateEvenly`, `allocateProportionally` (BigInt largest remainder).
- `packages/shared/src/split.ts` — `splitReceipt` with `SplitInput` / `SplitResult`.
- `packages/shared/src/debts.ts` — `buildBalances`, `simplifyDebts`, `simplifyAcrossTrips`.
- `packages/shared/src/schemas/common.ts` — cents, currency, ids, display names, join codes.
- `packages/shared/src/schemas/receipt.ts` — `receiptExtractionSchema`, `validateReceiptExtraction`, `reconcileExtraction`.
- `packages/shared/src/schemas/trip.ts` — trip create/join, claim set, item corrections, settlement inputs.
- `packages/shared/src/*.test.ts`, `src/schemas/schemas.test.ts`, `src/test-helpers.ts` — tests and the `plain()` brand-stripping helper.
- `AGENTS.md`, `docs/architecture.md`, `docs/decisions/` — policy, verified baseline, decision records.
- `apps/api/wrangler.jsonc` — D1 `DB` (`fairshare-db`), R2 `RECEIPTS` (`fairshare-receipts`); `AI` still commented out.
- `apps/api/src/index.ts` — unchanged hello-world Hono app.

## Git State

- Branch: `main`
- Working tree: clean. `.agent/HANDOFF.md` is committed per session.
- Commit(s):
  - `cc023b0` feat(shared): implement Phase 1 money, split, and debt domain logic
  - `b783547` docs: add architecture baseline, ADRs, and agent handoff template
- Do not discard or overwrite uncommitted changes.

## Verification

- `bun run lint` — passed (Biome; Markdown included).
- `bun run typecheck` — passed (4/4 workspaces: db, shared, api, mobile).
- `bun test` — passed (65 tests, 0 failures, 5 files).
- `wrangler deploy --dry-run` in `apps/api` — passed; binds `env.DB` (D1 `fairshare-db`) and `env.RECEIPTS` (R2 `fairshare-receipts`).
- Not verified: Metro bundling of `@fairshare/shared` (no mobile import yet), Wrangler bundling of shared source (no API import yet), and any remote D1/R2 usage.

## Open Issues / Assumptions

- `wrangler.jsonc` `database_id` is the placeholder `00000000-0000-0000-0000-000000000000`. Run `wrangler d1 create fairshare-db` and replace it before any remote deploy.
- Workers binding types are not generated (`worker-configuration.d.ts` absent, no `@cloudflare/workers-types`). `env.DB` / `env.RECEIPTS` stay untyped until `wrangler types` (`cf-typegen`) runs.
- No authentication, authorization, session, or identity model exists. No endpoint that reads or writes trip data should ship without both.
- Currency policy is unresolved: `Cents` assumes two decimals while `currencyCodeSchema` accepts any ISO 4217 code; `simplifyAcrossTrips` has no currency parameter; extraction and trip schemas default to `"EUR"`. Recorded as open in `docs/architecture.md` section 10, ADR-0001, and ADR-0005.
- `packages/db` is an empty scaffold: no schema, no `drizzle.config.ts`, no migrations.
- No API/mobile/db test runner. Root `bun test` scans the whole repo and will collide with a Vitest suite in `apps/api`; revisit the root `test` script when one is added.
- `apps/api/tsconfig.json` does not extend `tsconfig.base.json`, and mobile pins TypeScript `~6.0.3` while the root uses `^7.0.2`. Typecheck passes today; align or document deliberately.

## Next Steps

1. Ask the user to settle the currency policy before the database schema fixes amount semantics (two-decimal allowlist vs minor-unit awareness; explicit currency vs the current `"EUR"` default).
2. Run `wrangler d1 create fairshare-db`, set the real `database_id`, run `wrangler types`, and commit `worker-configuration.d.ts`.
3. Create the `packages/db` Drizzle schema and `drizzle.config.ts` (SQLite/D1), generate the first migration, and apply it locally.
4. Decide and record the identity model (join code + anonymous device id vs accounts) in an ADR before writing auth middleware.
5. Add the tRPC API skeleton plus the first authorized trip/receipt endpoints.
6. Wire `apps/mobile` to the API (join-by-code flow) and smoke-test Metro bundling of `@fairshare/shared`.

## New Session Startup Prompt

Read `.agent/HANDOFF.md`, `AGENTS.md`, `docs/architecture.md`, and the ADRs in `docs/decisions/`. Inspect `git status` and `git log --oneline -5` and verify the described state against the repository before continuing. Preserve all existing changes. Resume from **Next Steps**, and settle the open currency policy with the user before changing amount semantics or writing the database schema.
