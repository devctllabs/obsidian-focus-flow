---
status: accepted
date: 2026-09-05
---

# Select templates when adopting a workspace

Setup previews a vault-relative root and the Candidate, Task, and Retrospective template paths together, then saves them as one workspace configuration. Existing standard template files are reused without rewriting their contents; missing standard files are created, and explicitly selected custom templates must already exist as Markdown files before workspace creation begins.

Changing the root in Setup remaps suggested in-root template paths and resets that form's explicit overrides, so templates from a previously inspected folder are not silently applied to the next folder. Paths outside the previous root remain external suggestions. Existing arbitrarily named templates are available through the same vault file picker as Settings; filename guesses never override an explicit user choice. Epic and Story acceptance continues to preserve Candidate content and has no separate runtime template setting.

This extends ADR-0011. Setup and adoption are non-destructive and retryable, not root moves; existing files are preserved even if saving settings fails. Root relocation and its transient recovery marker remain governed by ADR-0015.
