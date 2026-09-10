---
status: accepted
date: 2026-09-06
---

# Archive Closed Sprints by close month

Move each canonical Closed Sprint immediately to
`<root>/Sprints/Archive/YYYY/MM/SPR-nnn.md`, using the local date and offset
already recorded in `closed_at`. Draft and Active Sprint notes remain directly
under `<root>/Sprints/`. The archive path is navigation only; Review History
continues to derive Month, Quarter, and Year boundaries from Sprint sequence.

## Considered options

- **Keep all Sprints at the `Sprints/` root** preserves the smallest path
  contract but lets completed commitments obscure the current one during
  ordinary Workspace browsing.
- **Bucket by `starts_on` or `due_on`** groups a Sprint by its commitment window
  rather than when it became terminal, which diverges from the existing
  Terminal Archive rule and becomes misleading after an overdue Close or
  Reopen.
- **Bucket by Review Cycle** makes a derived four/twelve/forty-eight-Sprint
  projection look like folder authority and conflicts with ADR-0016.
- **Delay the move until another Sprint starts** avoids a Reopen move but adds an
  unrelated archive mutation to Start and leaves a Closed Sprint in the active
  root.

## Consequences

This decision refines ADR-0018 and extends the Terminal Archive placement from
ADR-0024 to Closed Sprint notes. The Sprint move belongs to the same
forward-resumable Close operation; a changed source, invalid timestamp, or
occupied destination blocks completion without overwrite.

`pending_close` remains on the Sprint until its Closed state, report, snapshot,
and archive move are durable. An exact planned source or destination is a valid
resume state, but a Sprint with a pending Close is not yet a Review History
boundary. Reopen follows the same rule with `pending_reopen` until the Active
state and root path are durable.

Sprint Reopen returns the same UUID-identified note to
`<root>/Sprints/SPR-nnn.md`. A later Close computes a new bucket from its new
`closed_at`, so the same Sprint can be archived under a different month after
correction. `Organize terminal notes` includes Closed Sprints that are still at
the root or in the wrong month, while Draft and Active Sprints remain invalid
inside `Archive/`.

Focus Flow navigation resolves the current indexed Sprint path. New Candidate
backlinks created from Improvements use the stable `[[SPR-nnn]]` code link.
Arbitrary existing user-authored path-qualified links are preserved as written
and are not migrated.
