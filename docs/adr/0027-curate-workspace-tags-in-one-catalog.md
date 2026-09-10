---
status: accepted
date: 2026-09-07
---

# Curate Workspace Tags in One Catalog

Replace the pre-release `<root>/TAG-COLORS.md` Tag Palette with a Workspace Tag Catalog in `<root>/TAGS.md`. The catalog is a YAML mapping of exact tags to optional descriptions and colors, while its user-owned Markdown body may give project-wide authoring guidance. Catalog membership recommends a tag to the person and explicitly permits a future agent to reuse it; it does not make native tags outside the catalog invalid.

## Considered options

- **Keep a separate Tag Palette** preserves the implemented color-only boundary but duplicates exact tag keys once agent-safe semantics are documented elsewhere.
- **Enforce a complete whitelist** keeps the catalog exhaustive but makes direct Obsidian authoring and quick capture unnecessarily brittle.
- **Derive the catalog from every observed tag** removes drift but cannot determine whether a spelling or meaning was deliberately approved.

## Consequences

Focus Flow UI additions and color assignments attempt to catalog the exact tag automatically. Tags introduced through direct Markdown remain valid, but their use on current nonterminal work produces an advisory consistency warning and an explicit catalog repair; terminal work and frozen Sprint history never require current catalog membership. A missing, malformed, or unwritable catalog does not block human authoring. Automated authoring may use only valid Cataloged Tags, must follow the catalog body, and may add a tag only after user confirmation.

Settings keeps catalog membership distinct from metadata editing: an expanded
tag row exposes Add or Remove in its overflow menu, while description and color
remain optional fields of the same entry. Removal is refused while the exact
native tag appears on current nonterminal work. Once allowed, removal deletes
the entry—including its description, color, recommendation, and permission for
automated reuse—but never rewrites terminal work or frozen history. Colors
remain live presentation metadata. Because this is an intentional pre-release
replacement, the target has no `TAG-COLORS.md` fallback or migration path.
