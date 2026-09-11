---
status: accepted
date: 2026-09-05
---

# Trash work without cascading or erasing history

Accidentally created Candidates, Tasks, Stories, and Epics can be removed through Obsidian's trash preference after a fresh preview and confirmation. Deleting an Inbox Candidate is distinct from rejecting it: rejection retains a Distraction, while deletion removes the accidental note. A parent with child notes, work currently assigned to a Sprint, or work referenced by Sprint snapshots cannot be deleted through the plugin: users must resolve relationships explicitly, and historical work stays available to Review History.

Nonempty notes require an additional acknowledgement; content alone is not a permanent deletion ban because custom templates and user-owned sections make “empty” subjective. Confirmation rereads the workspace and compares the entire note with the preview; the host adapter checks the current root and content again before trashing. Invalid notes and duplicate IDs block deletion because their relationships cannot be established reliably.

This deliberately avoids cascade deletion and rewriting immutable snapshots. The trade-off is that an accidental item already recorded in a Sprint must be closed or resolved rather than erased. Obsidian controls trash placement and recovery; the plugin does not maintain a second recovery archive or promise protection against simultaneous external filesystem changes. Terminal Archive placement under ADR-0024 moves the canonical note and is not trash protection or another copy.
