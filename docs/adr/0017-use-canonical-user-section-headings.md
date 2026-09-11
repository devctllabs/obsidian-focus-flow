---
status: accepted
date: 2026-09-05
---

# Use canonical headings for user-owned sections

Focus Flow identifies user-owned Acceptance Criteria and Retrospective
categories by exact, readable Markdown headings. Standard templates use
`Acceptance Criteria`, `Wins`, `Friction`, and `Improvements` without HTML
markers. Managed Sprint report boundaries remain marker-based because they
delimit generated content rather than user-owned sections.

## Context

HTML comments kept section identity stable after a heading rename, but made
ordinary Markdown bodies noisy in source. A frontmatter mapping would move the
noise into managed metadata and introduce another body/metadata consistency
contract for a single pre-release plugin.

## Decision

Use the exact canonical heading text at any Markdown heading level. A missing
Acceptance Criteria section remains an empty authoring section. Duplicate
canonical sections make the note invalid instead of silently selecting one.
Missing Retrospective categories remain allowed in closed Sprint notes, while a
configured Retrospective template must contain each category exactly once.

This is an intentional breaking change during pre-release development. Legacy
Focus Flow section markers are not parsed and no migration command is provided;
repo-owned fixtures use the new headings.

## Consequences

Users can read and edit the body without implementation comments. Renaming a
canonical section or creating a duplicate prevents the plugin from reliably
locating it and requires manual correction. The managed frontmatter schema does
not change, and generated report markers continue to support safe report
replacement.
