# Architecture Decision Records

An Architecture Decision Record (ADR) captures a decision that should remain understandable after the original discussion or coding session is gone.

## Index

| ADR                                              | Decision                                                                              | Status                             |
| ------------------------------------------------ | ------------------------------------------------------------------------------------- | ---------------------------------- |
| [ADR-0001](0001-integer-cents.md)                | Money is represented as branded integer cents                                         | Accepted                           |
| [ADR-0002](0002-largest-remainder-allocation.md) | Indivisible amounts use largest-remainder allocation with deterministic tie-breaking  | Accepted                           |
| [ADR-0003](0003-receipt-split-semantics.md)      | Even item claims, proportional extras, explicit unclaimed bucket                      | Accepted                           |
| [ADR-0004](0004-debt-simplification.md)          | Greedy max-creditor/max-debtor debt simplification, not minimal-transfer optimisation | Accepted                           |
| [ADR-0005](0005-receipt-extraction-contract.md)  | One provider-neutral extraction contract with an arithmetic review gate               | Accepted (contract); pipeline open |

## Conventions

- Records are named `NNNN-short-slug.md` with a sequential number that is never reused.
- `0000-template.md` is the template and is not itself an ADR.
- Reference related records by number in the ADR body and update the index above when adding one.

## When to Create or Update an ADR

Create an ADR when a change materially affects architecture, package boundaries, persistence, security, domain invariants, public contracts, or an important trade-off.

Do not create an ADR for every implementation detail or routine refactor. If a decision is reversed, preserve the old ADR and mark it superseded by the newer record rather than silently rewriting history.

Use [0000-template.md](0000-template.md) for new records. Keep the decision concise and include the date, status, context, decision, consequences, and alternatives when relevant.
