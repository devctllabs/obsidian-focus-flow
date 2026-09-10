---
status: accepted
date: 2026-08-30
---

# Keep Markdown canonical

Focus Flow stores entities, ordering, relationships, Sprint journals, and historical snapshots in ordinary Markdown notes beneath a configured vault root. Runtime indexes are fully rebuildable and plugin settings contain configuration only. This preserves native editing, links, backups, and vault sync while avoiding a second source of truth.

## Considered options

- **SQLite as canonical storage** would make event queries convenient but split work content from history, introduce binary-sync reconciliation, and make the plugin necessary to understand the system.
- **Markdown plus a derived SQL cache** remains possible only after profiling proves the incremental index insufficient; V1 has too little event volume to justify it.
- **CRDT documents** require every writer and sync path to participate in the CRDT protocol. Direct Markdown edits and ordinary Obsidian Sync would bypass it or make Markdown merely a projection, contrary to the chosen source of truth.

## Consequences

Writes must preserve unmanaged Markdown and recover explicitly from partial multi-file operations. Managed-note moves use Obsidian's file manager after identity and destination preconditions pass; they never emulate a move by rewriting note content. Analytics are limited to facts recorded in snapshots. A future database may be a disposable read model, never an undeclared authority.
