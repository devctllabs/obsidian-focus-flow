---
status: accepted
date: 2026-09-06
---

# Archive terminal work under typed folders

Move canonical Done and Closed Epic, Story, and Task notes to `<Type>/Archive/YYYY/MM/`, using the local year and month recorded by `completed_at` or `closed_at`. Active notes stay directly under their stable typed folder, and other nested layouts remain invalid. The archive is navigation over canonical work, not a copy, Review Cycle, or source for History.

## Considered options

- **Flat typed folders** retain the simplest path contract but let terminal work obscure active notes during ordinary vault browsing.
- **Arbitrary nested folders** improve personal flexibility but weaken predictable placement, repair, and creation contracts.
- **Calendar folders as Review History** would conflict with the four/twelve/forty-eight-Sprint cadence; year/month archive buckets carry no review meaning.

## Consequences

Terminal notes remain indexed and retain their UUIDs and historical references. Parent moves update derived child wikilinks through the resumable multi-note protocol, while Sprint snapshots remain unchanged. New terminal transitions move automatically; an explicit idempotent organizer previews and moves existing terminal notes.

The optional non-entity `WORKSPACE-OPERATIONS.md` stores the durable plan for terminal transitions, renames, and organization. All managed replacements, including child links, precede path moves. Completed operations leave an inactive marker rather than retaining an operation log.

These planned moves use `Vault.rename`, not `FileManager.renameFile`: Obsidian's automatic link rewriting would also change frozen snapshots and recovery preconditions. The planner explicitly owns current derived links; user-owned links are preserved as written.

ADR-0026 extends Terminal Archive placement to Closed Sprint notes while
preserving Review History as a path-independent projection.
