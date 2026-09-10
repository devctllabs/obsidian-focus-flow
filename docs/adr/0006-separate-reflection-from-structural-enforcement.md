---
status: superseded by ADR-0014
date: 2026-08-30
---

# Keep reflection in the skill and structure in the plugin

The plugin enforces mechanically decidable invariants such as identity, hierarchy, lifecycle, ordering, Sprint membership, workflow transitions, WIP policy, and snapshot integrity. Mission alignment, WANT/SHOULD reflection, and rejected-Candidate analysis are advisory metadata owned by a future `$focus-flow` skill; their absence is not a plugin diagnostic or permission. The skill may compose user-owned Markdown bodies and native tags directly, but delegates managed metadata, relationships, moves, lifecycle, and snapshots to a deterministic CLI built on shared application contracts.

## Considered options

- **Hard reflective gates in the plugin** make subjective judgment look machine-verifiable and can block legitimate work when Mission is absent or evolving.
- **A duplicate reflective wizard in plugin V1** increases UI and validation scope before the conversational skill exists.
- **Free-form AI frontmatter edits** bypass lifecycle, repair, and mutation recovery even if the advice is sound.
- **Leaving all validation to the skill** would make ordinary plugin and Markdown use capable of corrupting structural data.

## Consequences

V1 remains fully usable without Codex. Candidate-first UI nudges the framework without prohibiting direct valid Markdown, and the plugin may display advisory metadata when present without prompting for it. The later skill can evolve its questions and user-owned prose independently while the plugin/CLI retain one deterministic structural mutation contract.
