# FairShare Receipts

Collaborative receipt splitting for groups: photograph a receipt, extract the line items, let everyone claim what they had, and simplify the trip's debts into fewer transfers.

**Status:** ongoing hobby project · Phase 1 (money and splitting domain) complete · Phase 2 (database, API, identity) in progress · last verified 2026-11-26

## Product goal

Splitting a shared bill is tedious and error-prone: someone has to read the receipt, work out who had what, distribute tax and tip, and then untangle who owes whom across several trips. FairShare Receipts is meant to handle that end to end:

1. A user photographs a receipt.
2. OCR recognizes the text, keeping line geometry and per-word confidence where the provider exposes it.
3. A deterministic parser turns OCR observations into candidate header fields and line items.
4. Quality and arithmetic checks decide whether the candidate is complete enough or needs vision-LLM assistance.
5. Participants review the receipt and collaboratively claim or split items.
6. The app calculates each participant's share and the trip balances.
7. Debts are simplified across trips to reduce the number of transfers.

Steps 1–4 and the collaborative UI describe the target design; the [status](#status) section states what actually exists today.

## Why this project exists

FairShare Receipts is a hobby project. I am building it to learn AI engineering and how to use AI tools in software development, not to launch a commercial product.

- **AI engineering in practice.** The interesting work is not calling a model. It is the staged OCR → parser → LLM pipeline, keeping every source on one validated contract, deciding when escalation is worth the cost, preserving provenance and uncertainty, and measuring field accuracy, exact-total accuracy, latency, and cost on a labeled receipt corpus.
- **AI-assisted development.** I want first-hand experience running a codebase with AI agents under real constraints: written invariants (`AGENTS.md`), architecture decision records, session handoffs, and a verification loop that has to pass before work counts as done.
- **Financial correctness.** Money is the part where "looks about right" is not good enough, so the domain logic is built around integer cents, deterministic rounding, conserved totals, and balanced net positions.

## Status

Verified on 2026-11-26 by running `bun run lint`, `bun run typecheck`, and `bun run test`.

| Area                                     | State               | Notes                                                                        |
| ---------------------------------------- | ------------------- | ---------------------------------------------------------------------------- |
| Money, allocation, splitting, debt logic | Implemented         | `packages/shared/src/{money,allocate,split,debts}.ts`, covered by tests      |
| Shared Valibot contracts                 | Implemented         | Trip, claim, settlement, and provider-neutral receipt-extraction schemas     |
| Test suite                               | Implemented         | 68 `bun:test` cases in `packages/shared`                                     |
| Database schema and migration            | Implemented (local) | Six Drizzle tables; `0000_init.sql` applied to local D1 only                 |
| Cloudflare bindings                      | Configured          | D1 `DB` and R2 `RECEIPTS`; no read/write code yet                            |
| API                                      | Minimal             | Hono app with a single `GET /`; no tRPC, auth, or persistence calls          |
| Mobile app                               | Starter             | Expo Router starter screens; not connected to the API                        |
| OCR, parser, quality gate, LLM adapters  | Not started         | Contract and reconciliation gate only                                        |
| Authentication, endpoints, deployment    | Not started         | Identity model undecided; D1 id is a placeholder; Wrangler not authenticated |

## Tech stack

| Layer          | Technology                                                               |
| -------------- | ------------------------------------------------------------------------ |
| Language       | TypeScript with strict settings across all workspaces                    |
| Monorepo       | Bun workspaces (four workspaces) with root lint, format, test, typecheck |
| Mobile         | Expo SDK 58, React Native 0.88, Expo Router                              |
| API            | Hono 4 on Cloudflare Workers, Wrangler 4                                 |
| Database       | Cloudflare D1 with Drizzle ORM and drizzle-kit migrations                |
| Object storage | Cloudflare R2 (binding only)                                             |
| Validation     | Valibot contracts in `packages/shared`                                   |
| Quality        | Biome 2 (lint and format), `bun:test`, `tsc --noEmit`                    |
| Planned        | tRPC transport, OCR provider, vision-LLM adapter, evaluation harness     |

## Engineering decisions worth a look

- **Money never touches floating point.** `Cents` is a branded integer type with a single conversion gate (`toCents`), and `formatCents` is the only function that divides by 100 ([ADR-0001](docs/decisions/0001-integer-cents.md)).
- **Rounding is deterministic.** Indivisible amounts use largest-remainder allocation with BigInt arithmetic and index tie-breaking, so client and server produce identical splits ([ADR-0002](docs/decisions/0002-largest-remainder-allocation.md)).
- **Unclaimed money stays visible.** Items nobody claimed are tracked in their own bucket instead of being silently redistributed ([ADR-0003](docs/decisions/0003-receipt-split-semantics.md)).
- **Debt simplification is stated honestly.** Greedy max-creditor/max-debtor matching, bounded at n−1 transfers and explicitly not marketed as minimal, with tests for conservation of value and balanced net positions ([ADR-0004](docs/decisions/0004-debt-simplification.md)).
- **Extraction has one contract and no automatic trust.** OCR and LLM output are candidate data that must pass the same Valibot contract and an arithmetic reconciliation gate before a human reviews it ([ADR-0005](docs/decisions/0005-receipt-extraction-contract.md)).

## How AI is used — and kept honest

The extraction pipeline is designed, not built yet. The design constraints:

- OCR first, deterministic parsing second, and the vision LLM only as an escalation for receipts that stay ambiguous or incomplete.
- Every path converges on one provider-neutral candidate contract; vendor SDKs and raw response types stay in the API integration layer.
- The model may resolve ambiguity but must not invent missing items, prices, totals, or currency. Uncertainty is preserved and shown for correction.
- Nothing extracted becomes financially authoritative until a user reviews and confirms it.
- Accuracy, escalation rate, latency, and cost are measured on a manually labeled receipt corpus before any automatic acceptance is considered.

How this project is developed with AI coding tools:

- `AGENTS.md` encodes the domain invariants, package boundaries, trust boundaries, and verification expectations that apply to agents and humans alike.
- Decisions are recorded as ADRs before implementation, and [`docs/architecture.md`](docs/architecture.md) separates what is implemented from what is decided or still open.
- [`.agent/HANDOFF.md`](.agent/HANDOFF.md) gives every session a verified starting point instead of reconstructed context.
- Work is not done until lint, typecheck, and tests pass; the status table above only lists behavior those checks actually cover.

AI tools write code in this repository. The architecture, trade-offs, review, and verification are mine.

## Repository layout

| Path                   | Purpose                                                     |
| ---------------------- | ----------------------------------------------------------- |
| `apps/mobile`          | Expo / React Native client                                  |
| `apps/api`             | Hono API on Cloudflare Workers                              |
| `packages/shared`      | Pure TypeScript domain logic and Valibot contracts          |
| `packages/db`          | Drizzle schema and migrations                               |
| `docs/architecture.md` | Architectural baseline and verified implementation snapshot |
| `docs/decisions`       | Architecture Decision Records                               |

## Getting started

Requires [Bun](https://bun.sh).

```bash
bun install

bun run lint       # Biome
bun run typecheck  # tsc --noEmit in all four workspaces
bun run test       # 68 bun:test cases in packages/shared

cd apps/api && bun run dev        # local Worker on Wrangler
cd apps/mobile && bun run start   # Expo dev server
```

Apply migrations to local D1 from `apps/api`:

```bash
bunx wrangler d1 migrations apply fairshare-db --local
```

Deployment is not set up: `apps/api/wrangler.jsonc` still contains a placeholder D1 `database_id`, and Wrangler is not authenticated.

## Next up

1. Record the identity and authorization model as ADR-0007.
2. Build the Drizzle query layer, then tRPC endpoints for trips and receipts.
3. Wire the mobile join-by-code flow to the API.
4. Implement OCR → parser → quality gate → vision-LLM escalation with a labeled receipt corpus and an evaluation harness.
5. Create remote D1 and R2 resources and set up deployment.

## Documentation

- [Architecture baseline](docs/architecture.md)
- [Architecture Decision Records](docs/decisions/README.md)
