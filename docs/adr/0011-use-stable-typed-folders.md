---
status: accepted
date: 2026-09-02
---

# Use one configurable root with stable typed folders

Focus Flow configures one vault-relative root while Inbox, Distractions, Epics, Stories, Tasks, and Sprints remain stable typed locations beneath it. The managed type is authoritative, and placement is a visible, repairable invariant. A predictable topology keeps ordinary vault browsing, links, backup, agent instructions, and recovery understandable without a path configuration matrix.

## Considered options

- **Configure each typed folder independently** would multiply path validation, moves, settings migrations, and ambiguous overlaps.
- **Allow managed notes anywhere** would make the vault less legible and turn every scan into a metadata query over unrelated Markdown.

## Consequences

Changing a populated root is a preflighted move or adoption workflow, not an immediate setting update. Adding or renaming a typed folder is a schema-level change requiring a migration decision.
