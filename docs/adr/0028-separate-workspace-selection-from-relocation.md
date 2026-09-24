---
status: accepted
date: 2026-09-24
---

# Separate Workspace selection from relocation

An Obsidian vault may contain multiple independent Focus Flow Workspaces, while
the plugin operates on exactly one Active Workspace at a time. Creating a new
Workspace, opening an existing Workspace, and moving the Active Workspace are
separate operations selected before path editing.

Create requires a missing target and initializes the standard structure. Open
requires an existing folder, validates it, preserves its files, and fills only
missing standard folders and templates. Both leave the previously active
Workspace in place. Move remains a whole-root Vault API rename whose old path
disappears and whose recovery follows ADR-0015.

This refines ADR-0011: one configurable root means one active root, not one
Workspace per vault. It also refines ADR-0021 by making creation and adoption
explicit user intents. The standard root for new installations and Create is
`FocusFlow`; persisted legacy paths are not renamed.

## Considered options

- **Treat every root change as a move** prevents independent Workspaces from
  coexisting and makes a safe selection change destructive.
- **Infer Create or Open from path existence** hides the user's intent and can
  turn a typo into an unexpected creation or adoption.
- **Recursively copy the folder** duplicates durable identities and may leave
  path-qualified links pointing at the source, so it is not a safe clone.

## Consequences

Workspace Markdown and the Tag Catalog are isolated by root. WIP policies,
weekday, appearance, and other plugin settings remain global. Changing the
Active Workspace rebuilds the index and reloads the Tag Catalog. Recent roots,
quick switching, and identity-aware cloning remain deferred.
