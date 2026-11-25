# Agent Session Handoff

> Copy this template to `.agent/HANDOFF.md` when a new session needs a checkpoint. Replace all placeholders with verified facts. Keep this file concise and do not include secrets, tokens, personal receipt data, or raw terminal dumps.

## Goal

- [Current task and desired outcome]

## Status

- Completed:
  - [Verified completed work]
- In progress:
  - [Exact state; omit if none]

## Decisions and Constraints

- [Important decisions, rationale, and relevant ADRs]
- [User requirements or constraints that must be preserved]

## Files

- [Path] — [What changed / why]

## Git State

- Branch: [Verified branch]
- Working tree: [Clean / uncommitted files / staged files]
- Commit(s): [Relevant commit hashes, or none]
- Do not discard or overwrite uncommitted changes.

## Verification

- `[exact command]` — [passed / failed / not run, and concise reason]

## Open Issues / Assumptions

- [Known issue, blocker, or assumption requiring verification]

## Next Steps

1. [Smallest concrete next action]
2. [Following action]

## New Session Startup Prompt

Read `.agent/HANDOFF.md` and the applicable `AGENTS.md` files. Inspect the current Git status and verify the described state against the repository before continuing. Preserve all existing changes. Resume from **Next Steps** and report any discrepancy before making consequential changes.
