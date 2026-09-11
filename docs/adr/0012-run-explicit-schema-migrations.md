---
status: accepted
date: 2026-09-02
---

# Run explicit schema migrations

An incompatible managed Markdown schema change is applied as an explicit, version-by-version batch after the user reviews the affected note count and confirms the upgrade. Until it completes, incompatible notes are read-only. The batch follows the forward-resume protocol: deterministic plan, optimistic preconditions, visible progress, and a resume action after interruption.

## Considered options

- **Migrate on plugin load** would make opening Obsidian trigger an unexpected mass rewrite that may race vault sync or an older device.
- **Migrate lazily on each write** would leave mixed schemas indefinitely and force every reader and writer to support their interactions.

## Consequences

The plugin needs a small migration registry and one batch UX only when a real next schema exists; no speculative framework is added for schema version 1. A backup/sync warning and one root-wide action replace per-file choices and automatic rollback.
