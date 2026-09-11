---
status: accepted
date: 2026-09-03
---

# Project Review History from canonical notes

Review History is a disposable projection of canonical Epic and Story notes plus Closed Sprint snapshots. It groups actual commitments into Month, Quarter, and Year Review Cycles without creating archive copies, treating calendar folders as period authority, or generating Review notes.

Terminal Epic changes after one Sprint closes belong to the next close boundary. Until another Sprint closes they appear as evidence since the last Sprint. This keeps review evidence aligned with the 4/12/48-Sprint cadence without denormalizing cycle identifiers into Epic notes.

## Considered options

- **Calendar folders as the authority for Review History** confuse review cadence with delivery dates. ADR-0024 permits year/month folders only as navigation for canonical terminal notes; Review Cycles never derive from those paths.
- **Generated Review notes** introduce another snapshot lifecycle before a review-writing workflow exists.
- **Persisted cycle identifiers on work notes** denormalize information that the Sprint sequence and timestamps already establish.

## Consequences

Current Review Cycles may be partial and show progress. Period summaries derive finalized Epics, Story Outcomes, and completed Task counts by frozen Effective Tags; Retrospective Items remain with their source Sprint.

Canonical terminal work may move within its stable typed folder under ADR-0024. Such placement neither creates archive copies nor changes the Sprint boundaries used by this projection.

ADR-0026 applies the same path-independence to Closed Sprint notes: moving a
Sprint into its close-month archive does not change its sequence or Review
Cycle membership.
