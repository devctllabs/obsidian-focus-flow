---
status: accepted
date: 2026-09-03
---

# Keep root-move recovery transient

A Focus Flow root move records a temporary recovery plan in plugin data before renaming the root and clears it after the new root setting is durable. This is an explicit exception to the settings-only shape of plugin data, but not to Markdown ownership: the marker contains operation state only and is never needed to reconstruct work, ordering, relationships, or history.

## Considered options

- **A marker in the vault** would leak plugin coordination state into sync and user-owned files.
- **Inferring recovery from folders alone** loses the intended destination when settings persistence fails.
- **Moving files one by one** creates avoidable collision and partial-move states when the whole root can be renamed through the Vault API.

## Consequences

The destination must not exist, all content under the root moves together, and domain mutations pause while a marker remains. Recovery inspects the old path, new path, and saved settings, then resumes forward or reports a conflict without guessing a rollback.
