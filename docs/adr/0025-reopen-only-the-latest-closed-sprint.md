---
status: accepted
date: 2026-09-06
---

# Reopen only the latest Closed Sprint

Keep calendar-aligned Sprint Windows and permit an explicit Sprint Reopen only for the highest-sequence Closed Sprint while no later Sprint has started. Reopen retracts that Close boundary and restores the same Sprint to Active from exact recovery data captured by its Close; it never creates a second Sprint in the same window. A Draft must be cancelled explicitly before Reopen.

## Considered options

- **A second Sprint in the same window** would make one calendar commitment boundary ambiguous and distort History.
- **Irreversible Close** is simpler but leaves ordinary early-close mistakes recoverable only through vault backups.
- **Best-effort reconstruction** could cover old Closed Sprints but cannot guarantee ranks, reclassifications, or paths from existing snapshots.

## Consequences

Close operations persist `reopen_recovery` with `before_close` restoration data and `expected_after_close` preconditions sufficient for an optimistic, resumable Reopen. Closed Sprints without that recovery data remain valid History but cannot be reopened. A changed affected note blocks Reopen rather than triggering an approximate rollback.

Reopen is itself a new forward-resumable mutation under ADR-0010. It retracts the complete latest boundary without editing a Close Snapshot in place or guessing a rollback from partial data.

Under ADR-0026, Reopen also returns the same Sprint note from its dated archive
to the `Sprints/` root. A later Close may place it in a different month because
the new `closed_at` remains the Terminal Archive timestamp.

Obsidian cannot atomically replace frontmatter and rename a note. The durable plan therefore precedes both writes. Only when resuming that plan, its exact intermediate state—replacement managed block at the original path—is also accepted. An unrelated third state or occupied destination still blocks recovery. Older pending Close plans resume through their original protocol without inventing Reopen data.
