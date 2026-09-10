---
status: accepted
date: 2026-08-30
---

# Build a domain board on an isolated DnD adapter

Focus Flow will build its Story-swimlane board from domain-specific React components and use `@dnd-kit/react` only behind `BoardDragAdapter`. The dnd-kit maintainer recommends the next API for production while noting that APIs may still change before 1.0, so no domain/application contract may expose library types ([maintainer guidance](https://github.com/clauderic/dnd-kit/discussions/1803)).

Desktop receives pointer and keyboard DnD plus an accessible Move menu. Mobile uses one status screen at a time and the same Move menu without touch DnD.

## Considered options

- **Embedding or forking Obsidian Kanban** brings a generic board format, a large unrelated feature surface, GPL obligations, and a project currently seeking maintainers ([repository](https://github.com/obsidian-community/obsidian-kanban), [maintainer note](https://github.com/obsidian-community/obsidian-kanban/blob/main/MAINTAINERS.md)).
- **Pragmatic Drag and Drop** is stable and small but was not the selected interaction API.
- **Handwritten pointer DnD** avoids a dependency but makes collision detection, keyboard parity, announcements, and cleanup application responsibilities.
- **Touch DnD on mobile** conflicts with horizontal/vertical scrolling and has no advantage over an explicit status chooser for a personal board.

## Consequences

Replacing dnd-kit is contained to the adapter and React board mechanics. All movement is validated by application use cases, and every DnD operation has a non-DnD equivalent. V1 must test desktop and mobile interaction paths separately.

## Phase 2 implementation note

The first implementation uses `@dnd-kit/react` 0.5 behind
`src/features/planning/BoardDragAdapter.tsx`, following the current sortable
hook contract ([sortable documentation](https://dndkit.com/react/hooks/use-sortable/)).
The adapter emits only an entity ID and target index. Epic, Month Story, and
per-Story Task ordering all call `PlanningReorderService`; accessible reorder
selects call that same service. A Storybook browser interaction proves keyboard
sorting, and real-Obsidian E2E proves that the resulting rank survives plugin
reload. Because the dependency remains pre-1.0, upgrades require adapter tests
and no changes outside this boundary unless a new ADR is accepted.

`@dnd-kit/react` 0.5 currently emits a React 19 development warning about an
update during `useInsertionEffect` when the keyboard drop completes. The
browser interaction still completes and the production plugin bundle selects
React's production build, where the warning is absent. The always-visible menu
is an independent interaction path. Treat removal of this warning as an
adapter-level dependency upgrade task; do not spread a workaround into domain
or application code.
