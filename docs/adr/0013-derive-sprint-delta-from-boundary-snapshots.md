---
status: accepted
date: 2026-09-02
supersedes: ADR-0005
---

# Derive Sprint Delta from boundary snapshots

Focus Flow records a Start Snapshot when a Sprint begins and derives a Sprint Delta from that baseline and the live closing boundary. The delta contains added and removed Stories, added and removed Tasks, and Stories whose ordered Acceptance Criteria text changed. Checkbox-state-only changes are outcomes, not delta. An empty delta is omitted from the generated report.

No mid-Sprint Scope Change journal or reason is stored. Every Task belonging to an Active Sprint Story is in Sprint Scope except a Task already Done at start; adding a Task therefore needs no separate membership event, and completing one does not release scope.

## Considered options

- **Append a reasoned event for each scope edit** duplicates facts already present in Markdown, creates acknowledgement work, and becomes stale after direct edits.
- **Diff only IDs** misses Acceptance Criteria changes and produces reports without useful labels.
- **Record every transition** adds write volume and implies an audit/history capability the product does not need.

## Consequences

Sprint closure remains deterministic and recoverable from Markdown. Reports describe what changed without claiming why or when it changed. Text or order changes to Acceptance Criteria count; checkbox changes do not. Future active-Sprint Story add/remove/reparent workflows must change the live boundary safely, but they do not append events.
