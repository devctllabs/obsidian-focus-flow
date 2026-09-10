---
status: superseded by ADR-0027
date: 2026-09-06
---

# Store Tag Palette in Workspace Markdown

Store the Workspace Tag Palette in `<root>/TAG-COLORS.md` as an exact tag-to-`#RRGGBB` mapping inside managed `focus_flow` frontmatter. The Markdown body remains user-owned, and presentation reads the palette live rather than copying colors into work notes or Sprint snapshots. This keeps the palette portable with the Workspace while preserving Effective Tags and historical facts as color-independent domain data.

## Considered options

- **Plugin settings** fit presentation configuration but separate the palette from a Workspace when it is adopted in another vault.
- **Per-note colors** would let one tag acquire conflicting meanings and multiply writes across inherited tags.
- **Frozen snapshot colors** would preserve old appearance but turn a mutable visual preference into historical domain data.

## Consequences

Missing and invalid entries fall back to the neutral theme style and produce only a palette diagnostic. Settings → Tag colors edits the canonical Markdown mapping through a searchable list, preset swatches, a custom hex value, and a neutral reset, without owning or replacing the note body; direct Markdown edits remain valid.
