---
status: accepted
date: 2026-09-02
supersedes: ADR-0006
---

# Limit the CLI to authoring and consistency checks

The deterministic CLI exposes only `create candidate`, `create task`, and `check`. Creation reuses the plugin's schemas, key allocation, templates, serialization, parent validation, and Sprint Scope WIP rules. `check` is read-only. The CLI never changes lifecycle, status, rank, Sprint membership, outcomes, or repair state.

A future conversational skill may create Candidates and Tasks through the CLI, then edit only user-owned Markdown body content and native tags. Entry Review and Distraction Analysis belong in the body, not managed or advisory frontmatter. Candidate acceptance/rejection and all workflow transitions remain deliberate plugin UI actions.

## Considered options

- **A universal workflow CLI** would give an agent authority to move work and update statuses that the user intends to own explicitly.
- **Free-form managed-frontmatter edits** bypass deterministic invariants and optimistic concurrency.
- **No CLI** would force skills to duplicate key allocation, templates, and consistency validation.

## Consequences

The CLI is a small Node 22 artifact that requires an explicit vault path and supports human or single-document JSON output. Story lookup for Task creation uses a unique `FF-*` key. Exit codes distinguish success, consistency/runtime failure, and usage errors. Expanding mutation authority requires a new decision rather than adding an incidental command.
