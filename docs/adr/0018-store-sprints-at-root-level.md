---
status: accepted
date: 2026-09-05
---

# Store Sprint notes in a root-level Sprints folder

## Context

Sprint notes are the canonical source for planning and review history. The
previous `Cycles/Sprints` nesting added a structural level without representing
a separate domain entity: cadence labels are fields on Sprint notes, while
History is projected from closed Sprints.

## Decision

Store Sprint notes directly under `<root>/Sprints/`. Setup creates this folder,
the indexer manages Markdown files directly beneath it, and Sprint writers use
it for Draft, Active, and Closed notes. The former `<root>/Cycles/Sprints/`
location is not supported or migrated; existing user folders and files are not
deleted automatically.

## Consequences

The storage contract is simpler to browse and matches the domain model. This is
a breaking pre-release path change: notes left in the former location are not
indexed until manually moved to `Sprints/`, and no compatibility or migration
logic is maintained.

ADR-0026 refines this placement: Draft and Active Sprint notes remain directly
under `Sprints/`, while Closed Sprint notes move into its dated Terminal Archive
subtree.
