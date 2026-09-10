---
status: superseded by ADR-0013
date: 2026-08-30
---

# Preserve weekly snapshots without transition event sourcing

Each Sprint is one Markdown note containing a Start Snapshot, append-only exceptional Scope Changes, a Close Snapshot, a generated report, and user-owned retrospective sections. Task notes record first `started_at` and `completed_at`, but V1 does not append every status transition.

## Considered options

- **Full transition events in Markdown** would enable time-in-status and cumulative-flow analytics but turn every card move into another durable write and grow Sprint notes around data not required by the framework.
- **Transition events in a database** reintroduce split authority and sync/recovery complexity.
- **Live-note-only history** would let later rename, tag, relationship, and criteria changes rewrite the meaning of past Sprints.

## Consequences

History can report committed/added/completed/open counts, outcomes, frozen Effective Tags, scope changes, exceptions, and approximate elapsed calendar time. It cannot claim active effort, time in each status, reversal counts, velocity, or cumulative flow. Introducing those metrics requires a new event-model decision.
