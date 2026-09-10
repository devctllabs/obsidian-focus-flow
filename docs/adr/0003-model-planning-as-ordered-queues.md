---
status: accepted
date: 2026-08-30
---

# Model planning as ordered queues

Month selection is refined by [ADR-0019](0019-curate-month-backlog-explicitly.md): accepted Stories can remain in their Epic before being explicitly added to Month.

Focus Flow has one globally ordered Epic Backlog, one globally ordered rolling Month Backlog, and at most one Draft or Active Sprint. Selecting a Story transfers it from Month to Sprint rather than representing it twice. Epic, Month, Sprint, and per-Story Task orders use separate owning ranks; the Task rank is reused across Plan and Focus projections.

Ranks use the small, dependency-free [Rocicorp fractional-indexing package](https://www.npmjs.com/package/fractional-indexing) so local DnD normally changes one entity without rewriting a list. The package owns key generation; Focus Flow owns collection boundaries, ordinal comparison, deterministic UUID tie-breaking, and mutation safety. Duplicate or overgrown keys are repaired with one full-collection plan and `generateNKeysBetween`.

## Considered options

- **Calendar Month/Year containers** turn priority horizons into delivery promises and conflict with the framework's rolling backlogs.
- **One global Story rank across filtered cycles** makes reordering a subset ambiguous because hidden elements can move relative to the visible list.
- **Independent Board and backlog Task ranks** let the same Task express contradictory priorities in different views.
- **Duplicating a selected Story in Month and Sprint** preserves the source list but creates two simultaneous rank contexts and visually duplicates commitment.
- **Implementing fractional keys locally** removes one runtime package but makes Focus Flow responsible for a subtle ordering algorithm that is not part of its domain advantage.

## Consequences

Sprint planning and closure are explicit queue transfers. A closed unfinished Story must be reinserted into a chosen Month position before it can be selected again; there is no automatic carry-over. Review-cycle codes group snapshots but do not own work.

Rank repair rewrites a complete owning collection in deterministic order. Each
entry carries an optimistic expected value, and an already-applied replacement
is accepted so an interrupted repair can resume. Ordinal string comparison is
mandatory; locale-aware comparison would violate the package's ordering
contract.
