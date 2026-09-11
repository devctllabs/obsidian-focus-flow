---
status: accepted
date: 2026-09-02
---

# Resume multi-note mutations forward

Any workflow whose interruption can leave several Markdown notes inconsistent records a complete mutation plan before the first dependent write, applies it in deterministic order with optimistic preconditions, and treats already-applied replacements as valid resume states. Recovery completes the chosen operation forward; it does not guess a rollback across files that the user, sync, or another plugin may already have changed.

## Considered options

- **Automatic rollback** requires equally complex inverse operations and can overwrite legitimate edits made after a partial failure.
- **Best-effort writes with an error message** leave the user to reconstruct intent from partially changed domain notes.

## Consequences

Multi-note operations are serialized and expose inspect/resume diagnostics when a durable marker remains. Single-file changes still use the smallest optimistic write and do not need a persisted operation record. A sequence that deliberately leaves a valid intermediate state may use ordinary idempotent retry instead: returning an evaluated Story to the Month Backlog clears its provisional outcome first, so interruption leaves an unevaluated Active Story rather than contradictory records.
