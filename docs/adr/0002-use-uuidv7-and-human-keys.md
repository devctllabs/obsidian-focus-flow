---
status: accepted
date: 2026-08-30
---

# Use UUIDv7 identity and repairable human keys

Every Candidate, Epic, Story, and Task has a UUIDv7 canonical identity and one global `FF-n` human key. The UUID survives reclassification and anchors relationships; the key survives ordinary type/title changes and provides Jira-like references and filenames. Parent UUIDs are canonical while adjacent wikilinks are derived for native readability.

## Considered options

- **Wikilinks as identity** are pleasant to read but become ambiguous after external rename, broken links, or duplicate names.
- **Human keys as identity** make rare offline allocation collisions expensive because every relationship must be rewritten before identity is known.
- **A central counter note** serializes one device but creates a sync hotspot and still cannot allocate safely while devices are offline.

## Consequences

Allocation scans the indexed maximum and serializes local creates. Key collision repair deterministically preserves the key on the lowest UUIDv7 and assigns later entities consecutive values above the current global maximum. One serialized, resumable plan preflights destination collisions, updates derived child links, then changes managed keys and filenames through Obsidian APIs. Link-first ordering avoids racing the host's rename link updater.

When UUIDs collide, no UUID can provide a tie-breaker: the ordinal-lowest current Vault path keeps the UUID and each later path receives a fresh UUIDv7 at repair execution time. A parent reference participates only when its typed target is unambiguous: an Epic or Story wikilink must identify exactly one colliding path, while a `sprint_id` must identify the group's only Sprint. The plan updates those references before owner IDs, accepts already-applied values when resuming, and remains read-only if any reference is ambiguous. Key repair for the affected notes becomes available after the refreshed index has unique identities. UUIDs remain opaque in user-facing views unless diagnostics require them.
