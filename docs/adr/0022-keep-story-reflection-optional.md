---
status: accepted
date: 2026-09-05
---

# Keep Story Reflection optional

Story Outcomes require an explicit evaluation, not a written justification for every attempt. The Outcomes form labels its free-text note “Reflection (optional)”; empty reflections do not block saving, Sprint closure, or close recovery. An Achieved outcome with unchecked Acceptance Criteria still requires an Acceptance Exception.

The persisted `evidence` field retains its name so existing notes, pending closes, and frozen snapshots need no rewrite. Readers normalize an omitted value to an empty string; writers retain the existing shape. This deliberately separates a presentation/domain-label change from a storage migration. Earlier plugin versions may reject new snapshots containing empty evidence; existing historical text is not changed.
