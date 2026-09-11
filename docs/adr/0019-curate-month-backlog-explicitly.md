---
status: accepted
date: 2026-09-05
---

# Curate the Month Backlog explicitly

The user expects to select Stories from an Epic into a short Month Backlog, rather than have every accepted Story appear there automatically. Newly accepted Stories therefore begin in `epic_backlog`, with no Month or Sprint rank; an explicit transfer appends them to the Month queue (`backlog`), and returning to the Epic removes the Month rank without changing identity, parent, Tasks, or content.

This refines ADR-0003: Epic ownership is independent of the Story’s current planning horizon. Existing `backlog` Stories remain selected in Month; no existing notes are rewritten. Sprint selection still transfers Month → Draft/Active, unfinished Stories return to Month on review, and the one-Draft-or-Active limit remains unchanged. This additional authoring state is introduced before the first plugin release and needs no transformation of existing schema-version-1 notes.
