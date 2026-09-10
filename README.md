# Focus Flow

Focus Flow is an Obsidian plugin for running a personal work-management system from Markdown notes. It connects a filtered idea inbox to Epic and Story backlogs, a weekly Story-swimlane board, explicit Sprint closure, and human-readable history.

## Product principles

- Markdown in the current vault is the source of truth.
- Permanently personal: one operator and one hierarchy, Epic → Story → Task.
- Backlogs express priority, not delivery dates.
- Stories express outcomes; Tasks express actions.
- Weekly commitment is explicit and never rolls over automatically.
- Reflective practices guide decisions without turning subjective judgment into a permission system.
- Desktop and mobile are first-class; the plugin remains local-only with no account, network, telemetry, or AI runtime.

## Documentation

- [Domain language](./CONTEXT.md)
- [How Focus Flow works](./docs/framework.md)
- [Product specification](./docs/product-spec.md)
- [Architecture](./docs/architecture.md)
- [Markdown data model](./docs/data-model.md)
- [Implementation roadmap](./docs/roadmap.md)
- [User guide](./docs/user-guide.md)
- [Privacy and security](./docs/privacy-security.md)
- [Performance evidence](./docs/performance.md)
- [Release support matrix](./docs/release-matrix.md)
- [Architecture decisions](./docs/adr/)

## Status

The V1 implementation is substantial and the windowless quality gate passes,
but the target contract is not yet release-complete. The implemented baseline
includes:

- the mobile-compatible Obsidian/React lifecycle shell and native settings are wired;
- Focus, Plan, Inbox, and History commands share one persisted view; Distractions is an Inbox section, while Close and Settings stay in the same leaf;
- Candidate, Epic, Story, Task, and Draft/Active/Closed Sprint Markdown metadata is validated and parsed;
- managed notes are indexed from the configured Vault root with loading and stale-error states;
- read-only diagnostics retain valid entities while reporting malformed metadata, duplicate UUIDs/keys/ranks, missing or mismatched parents, and incorrect typed-folder placement with an actionable reason;
- stale parent links, safely disambiguated duplicate UUIDs, duplicate human keys, collection-scoped duplicate ranks, and wrong typed-folder placement can be repaired explicitly with optimistic precondition checks while preserving unrelated frontmatter and note body content;
- the exact Task transition graph is covered by domain tests;
- pure domain policies cover off/soft/hard WIP, Sprint Scope, Effective Tags, and Sprint/Month/Quarter/Year cycle codes;
- Phase 1 domain, Markdown, indexing, diagnostics, and collision-repair contracts are complete;
- Candidate capture, searchable tag-filtered Inbox triage, durable Epic/Story acceptance, rejection and reconsideration,
  ordered Month/Epic/Task planning, Story-owned Task creation, reusable native note
  opening, accessible menus, and desktop keyboard/pointer DnD are
  implemented for Phase 2;
- Draft Sprint creation/cancellation, ready Story transfer and decomposition,
  Sprint ordering, scope confirmation, strict Start Snapshots, cycle/date
  assignment, overdue projection, and Markdown-only Active Sprint reload are
  implemented for Phase 3;
- lint, strict TypeScript, Vitest, Storybook browser tests, production bundling, and isolated-vault Obsidian E2E are configured.
- the populated Focus Board, explicit Sprint evaluation/closure, resumable recovery, retrospective History, 100,000-note incremental index profile, responsive/theme hardening, CI, and release packaging.
- a Node 22 authoring CLI for Candidate/Task creation and read-only vault consistency checks.

Primary discovery on 2026-09-02 reopened root onboarding/relocation, the body
template contract, Active Sprint Story membership workflows, Epic terminal
lifecycle actions, manual-edit diagnostics, and a small set of Sprint/Task
semantic corrections. Those refinements are implemented in the current source.

The repository includes a companion `$focus-flow` authoring skill under
`skills/focus-flow/`. Higher-order review analytics remain later roadmap work.

Workspace lifecycle refinements from ADRs 0024–0025 are implemented in the
current source: planning explains calendar-window boundaries; History
can reopen the latest eligible Closed Sprint; and terminal Epic, Story, and
Task notes move to canonical `Archive/YYYY/MM` folders. ADR-0026 is also
implemented: Close moves the canonical Sprint to
`Sprints/Archive/YYYY/MM/`, History opens it at its current path, Reopen returns
the same UUID-identified note to `Sprints/`, and a later Close derives a new
bucket from its new boundary. **Settings → Terminal notes → Review…** previews
and safely resumes organization of existing terminal work and Closed Sprints.

ADR-0027 replaces the pre-release Tag Palette with the broader `TAGS.md` Tag
Catalog. **Settings → Tags** maintains exact entries, descriptions, and colors;
authoring prefers and extends that catalog without restricting human tags; and
the Attention center can repair tags added directly to current work.

## Development

```sh
pnpm install
pnpm check
```

Use `pnpm dev` for a watched `main.js` bundle and `pnpm storybook` for isolated React surfaces. `pnpm check` runs the windowless local gate; `pnpm check:full` additionally launches a disposable desktop Obsidian instance. On macOS, use `pnpm test:e2e:headless` or `pnpm test:e2e:mobile:headless` to run real-Obsidian E2E in Docker under Xvfb without showing a window. The first invocation downloads the pinned Playwright image; later runs reuse Docker and Obsidian caches. A production build emits the community-plugin artifacts `main.js`, `manifest.json`, and `styles.css`; generated build outputs and the Obsidian E2E cache are ignored by Git.

`pnpm build:cli` emits the Node 22 executable `dist/focus-flow.mjs`. The CLI intentionally supports only Candidate/Task creation and consistency checks, including Tag Catalog diagnostics; it does not move work or change statuses. The source for the optional companion authoring skill lives at `skills/focus-flow/`; installation and marketplace packaging are not part of this repository yet.

## Releases

Prepare the version metadata in a pull request so `package.json`, `manifest.json`,
and `versions.json` agree. Run **Preview release** on the default branch and
review the generated `git-cliff` notes, then run **Release** with the same
`patch`, `minor`, or `major` choice. The workflow runs the full CI, validates
the prepared version, creates an annotated `vX.Y.Z` tag, and publishes the
draft GitHub Release in the same run after artifact and release verification
checks pass.

RC releases are not part of the current release process.

## License

Focus Flow is licensed under the [MIT License](./LICENSE).
