# Architecture

## System context

Focus Flow is a personal, local, mobile-compatible Obsidian community plugin.
It owns no server, account, canonical database, background daemon, telemetry,
or AI runtime. The vault is both the single operator's visible workspace and
durable domain store. Collaborative ownership and remote integrations require
different product boundaries rather than optional fields inside this plugin.

```text
Markdown notes in configured root
              │
              ▼
      Obsidian vault adapters
              │
              ▼
 Domain parser + in-memory index
              │
              ▼
      Application use cases
       │                  │
       ▼                  ▼
React ItemViews     Native Obsidian UI
Focus/Plan/...      commands/settings/menus
```

The configured root also owns the optional `TAGS.md` Tag Catalog. It is read
beside the work index rather than parsed as a work entity; plugin settings
remain host configuration, not Workspace authority. Its managed frontmatter
owns catalog membership, descriptions, and colors, while its Markdown body is
user-owned project guidance for the companion authoring skill.

## Module boundaries

The implementation uses a growing-plugin structure because several surfaces share the same domain workflows:

```text
src/
├── main.ts
├── domain/
│   ├── entities/
│   ├── policies/
│   ├── ordering/
│   └── parsing/
├── application/
│   ├── ports/
│   ├── candidates/
│   ├── planning/
│   ├── focus/
│   ├── closing/
│   ├── history/
│   └── diagnostics/
├── obsidian/
│   ├── commands/
│   ├── views/
│   ├── settings/
│   └── services/
├── features/
│   ├── shell/
│   ├── focus/
│   ├── plan/
│   ├── inbox/
│   ├── distractions/
│   └── history/
└── test/
```

Add files only when a named responsibility exists. Do not create generic repositories, managers, helpers, or shared directories in advance.

Dependency direction is strict:

- `domain` is pure TypeScript and imports neither React nor Obsidian;
- `application` imports domain types and defines narrow ports;
- `obsidian` implements ports and owns host lifecycle/resources;
- `features` consume serializable view models and application callbacks;
- `main.ts` loads settings and composes/registers concrete owners.

The Node CLI reuses these domain and application owners for Candidate/Task
creation and consistency checks without importing Obsidian runtime modules or
extracting a premature package.

## Application ports

Use narrow capability contracts rather than passing `App` or `Vault` into domain behavior:

```ts
interface WorkRepository {
  getById(id: EntityId): Promise<WorkEntity | null>
  listSnapshot(): Promise<WorkIndexSnapshot>
  apply(plan: MutationPlan): Promise<MutationResult>
}

interface SprintRepository {
  getOpen(): Promise<Sprint | null>
  apply(plan: SprintMutationPlan): Promise<MutationResult>
}

interface TemplateRepository {
  render(kind: TemplateKind, variables: TemplateVariables): Promise<string>
}

interface TagCatalogRepository {
  read(): Promise<TagCatalogResult>
  save(plan: TagCatalogWritePlan): Promise<void>
}

interface Clock {
  now(): Instant
  today(): LocalDate
}

interface IdentityGenerator {
  nextEntityId(): EntityId
}
```

The concrete Vault repository resolves configured paths with `normalizePath`, changes frontmatter through `FileManager.processFrontMatter` or YAML-preserving `Vault.process`, and trashes only through `FileManager.trashFile`. Ordinary moves use `FileManager`; planned lifecycle moves use `Vault.rename` and explicit derived-link replacements to avoid automatic rewriting of frozen snapshots and recovery data (ADR-0024).

## Index and subscriptions

The index is a disposable read model, never a source of truth.

- Initial indexing scans Markdown files only beneath the configured root after `workspace.onLayoutReady()` and on first feature use.
- The index recursively discovers Markdown throughout `Sprints/` so invalid
  placement remains diagnosable. Typed placement accepts Draft/Active Sprints
  directly under `Sprints/` and Closed Sprints only beneath the canonical
  `Sprints/Archive/YYYY/MM/` subtree. Exact `pending_close`/`pending_reopen`
  intermediate placement remains recognizable so recovery is available after
  interruption.
- It parses managed frontmatter, body markers, Acceptance Criteria, parent links, ranks, and native tags into immutable snapshots plus diagnostics.
- It derives WIP diagnostics from live settings and Review History from
  canonical entities plus Closed Sprint snapshots; neither projection writes
  back to Markdown.
- It reads Tag Catalog state and diagnostics separately from work entities,
  compares it with native tags on current nonterminal work for advisory
  consistency diagnostics, then notifies every tag surface when `TAGS.md`
  changes.
- It subscribes to the narrow Vault and metadata-cache create/modify/delete/rename events needed to invalidate affected entities and descendants.
- Burst modifications are deduplicated into a batch scheduled from the first event,
  with cancellation owned by the plugin component. A continuous metadata-event
  stream therefore cannot postpone an index refresh indefinitely.
- Effective Tag changes invalidate the modified entity and its descendants only.
- React reads typed snapshots through `useSyncExternalStore`; no Redux, Zustand, or TanStack Query is needed in V1.
- Unload cancels pending scans, removes subscriptions, and drops the in-memory state.

Performance acceptance on representative fixture vaults:

- 100,000 Focus Flow notes index without freezing the UI;
- warm incremental updates are limited to affected entities and descendants;
- opening an already indexed view renders its useful loaded state within 100 ms on the reference desktop environment;
- initial mobile indexing is measured before introducing any cache or SQL projection.

A derived database may be reconsidered only after profiling demonstrates that incremental indexing cannot meet the target. It may never become canonical without a new ADR and migration design.

## Use cases and mutation safety

Application use cases return a mutation plan before touching the vault. A plan contains preconditions, affected files, managed-field changes, moves, report changes, and user-visible consequences. The adapter revalidates preconditions immediately before writing.

Single-file operations use `processFrontMatter` or `Vault.process`. Multi-file
operations are serialized by one plugin-owned mutation queue and are
idempotent. When interruption can leave several notes inconsistent, the full
plan is made durable before dependent writes and recovery resumes it forward;
automatic rollback cannot safely distinguish partial workflow state from later
user or sync edits.

Parent-link repair is the first single-file implementation of this contract.
Its diagnostic carries the affected path, canonical parent UUID, field,
expected old link, and replacement. The Obsidian adapter revalidates those
preconditions inside `processFrontMatter`, changes only the link field, and
rejects a stale plan without a partial write.

Duplicate-rank repair is the first multi-file implementation. One diagnostic
action represents the complete owning collection, ordered by the current
ordinal rank and UUID tie-breaker. The plan contains each file's identity,
rank field, expected value, and replacement generated by
`generateNKeysBetween`. Its application service serializes repair attempts.
The adapter writes files in plan order, accepts already-applied replacements
when resuming an interrupted operation, rejects stale values, preserves all
unmanaged content, and refreshes the index only after the plan succeeds.

Wrong-folder repair carries the note UUID and canonical typed-folder name, not
an index-derived root path. The Obsidian adapter resolves the current configured
root at execution time, rejects a destination collision, revalidates identity,
and moves through `FileManager.renameFile`. If the source is gone but the
destination contains the planned UUID, the operation is already complete and
only the index refresh remains.

Terminal placement refines this contract without opening arbitrary nested
folders. Active work resolves to `<Type>/`, while Done and Closed Epic, Story,
and Task notes resolve to `<Type>/Archive/YYYY/MM/` from their terminal
timestamp. The index accepts only those canonical descendants. Parent archive
moves add derived child-link replacements to the durable plan before moving the
owner; UUID relationships remain authoritative and Sprint snapshots are not
rewritten.

Duplicate-key repair is one serialized global plan. Within each collision the
lowest UUID keeps its key; later UUIDs receive consecutive keys above the
current global maximum. Groups containing an ambiguous duplicate UUID remain
read-only. The plan includes new filenames and derived child links. After a
destination-collision preflight, the adapter updates dependent links first,
then each managed key and filename. This ordering avoids racing Obsidian's own
rename link updater. Every step accepts its planned replacement as an
idempotent resume state and rejects any other current value.

Duplicate-UUID repair is also serialized, but generates replacements only when
the user executes the action. The ordinal-lowest path keeps the colliding UUID.
Typed parent links may disambiguate an Epic or Story owner; a Sprint reference
is safe only when exactly one colliding entity is a Sprint. If any reference in
a collision group cannot identify one owner, Diagnostics leaves that group
read-only. The adapter preflights every affected file, writes derived UUID
references before owner IDs, accepts planned replacements as resume states, and
refreshes the index before key repair can be offered for the same notes.

Sprint closure uses a recoverable protocol:

1. validate the entire close decision set without writes;
2. derive the Sprint Delta and write it with a stable operation ID into the Active Sprint's `pending_close` plan;
3. apply entity mutations idempotently in deterministic UUID order;
4. write the Close Snapshot and generated report, omitting an empty Sprint Delta section;
5. persist the Closed managed state while retaining `pending_close`;
6. move the Sprint to `Sprints/Archive/YYYY/MM/`;
7. remove `pending_close` and publish the Review History boundary only after
   its state, report, snapshot, and destination are durable.

If reload or failure interrupts steps 3–7, Diagnostics presents **Resume close** and **Inspect changes**. It never starts a second close or guesses rollback across already-written user files.

Close plans also capture exact `reopen_recovery` data: pre-close
provisional outcomes and, for each affected note, nested `before_close` and
`expected_after_close` path/managed-block pairs. `ObsidianLifecycleWriter` accepts
only the highest-sequence Closed Sprint when no Draft, Active, later, or pending
Sprint exists. It persists `pending_reopen`, restores entries in deterministic
UUID order, accepts already-restored states on resume, and retracts the close
projection only after every precondition succeeds. Reopen also returns the same
Sprint note to `Sprints/SPR-nnn.md`; a later Close uses the new `closed_at` to
choose its archive bucket. Closed Sprints without the recovery data remain
readable but expose no Reopen operation.

Host-agnostic `planCloseWork`, `planArchive`, and `applyReplacements` own full
managed replacements, terminal destinations, derived links, and deterministic
execution. `ObsidianLifecycleWriter` coordinates their durable markers through
`ObsidianManagedStore`. The organizer refreshes, previews the complete plan, and
performs no writes when every note is already canonical. Automatic terminal
work transitions, renames, and bulk organization share these planners and the
optional `WORKSPACE-OPERATIONS.md` journal. Sprint Close and Reopen reuse the
same planners but keep their recovery markers on the Sprint note. Resume accepts
exact before/after states and the recorded frontmatter-before-rename substep,
never arbitrary changes.

The Tag Catalog service has its own external-store subscription and
Vault store. Catalog parse or write errors do not make work read-only. The work
projection contributes only current nonterminal native-tag usage to catalog
consistency analysis; terminal work and frozen Sprint snapshots never require
membership. React tag surfaces read live catalog colors, including historical
charts, without mutating captured tags or snapshots.

Candidate reclassification and Sprint closure use the same preflight/idempotency principles. A partial move or derived-link failure becomes an explicit diagnostic with a safe completion action.

Phase 2 implements Candidate and backlog mutations as three narrow application
owners:

- `WorkCreationService` serializes Candidate and Task creation so global
  `FF-n` allocation cannot race within either entry path. It refreshes before
  planning, requires one backlog, Draft Sprint, or Active Sprint Story for a Task, applies Sprint Scope WIP policy for the Active case, renders the
  configured body template, and refreshes only after the Vault create succeeds.
- `CandidateTriageService` requires one Inbox Candidate and, for Story
  acceptance, one active backlog Epic. Its adapter changes only managed
  frontmatter through `processFrontMatter`, then moves the same `TFile` through
  `renameFile`; UUID, key, native tags, extension fields, and body remain on the
  durable note. A retry accepts an already-applied destination state.
- `PlanningReorderService` derives the owning Epic Backlog, Month Backlog, or
  Draft/Active Sprint Story, or per-Story Task collection from the indexed
  entity. It generates one rank between the target neighbors and delegates the
  optimistic write to the same rank writer used by Diagnostics. No-op and
  out-of-range moves do not write.

Missing or empty `MISSION.md` is projected as a soft diagnostic. It never
removes Candidates from Inbox or blocks capture and triage.

Phase 3 adds one `SprintPlanningService` as the mutation owner for Draft and
Active Sprint planning. Every operation refreshes and validates the Markdown
projection, runs through one serialized queue, writes one explicit plan, and
refreshes again only after success. It rejects a second Draft/Active Sprint,
requires Acceptance Criteria at selection and again at start, derives the next
`SPR-n` sequence from persisted Sprints, applies the configured local week
boundary, rejects a second Sprint for an already-used `starts_on` date, and
enforces the Sprint Scope policy against open Tasks only. The sequence counts
actual Sprints and does not skip codes for weeks without one.

The Obsidian Sprint writer creates `Sprints/DRAFT.md`, transfers Stories
by changing only managed lifecycle/Sprint fields, and retains `backlog_rank` as
a cancellation hint. Cancellation restores all selected Stories before
trashing the Draft and writes no bookkeeping journal. Start preflights the
destination, promotes Stories, writes the typed Start Snapshot, and renames the
Draft to its code. Each step accepts its intended end state so an interrupted
multi-file start can be safely completed. The Start Snapshot freezes full
Acceptance Criteria plus a Web Crypto SHA-256 digest, Effective Tags, and all
sibling Tasks; prior Done Tasks are marked as non-committed context.

Close moves the coded Sprint into its `closed_at` month as part of the same
forward-resumable operation. History and native opening use the current indexed
path rather than reconstructing one from a Review Cycle. Reopen performs the
inverse placement before exposing the Sprint as Active. Improvement promotion
uses a code-only `[[SPR-nnn]]` backlink; arbitrary user-authored path-qualified
links are not scanned or migrated.

React continues to render the live Draft/Active Sprint exclusively from the
Markdown index. The index reports every path if more than one Draft or Active
Sprint exists, while the UI disables planning until the conflict is repaired.
Overdue is a projection of the local date compared with persisted `due_on`, not
a lifecycle transition or timer.

## Obsidian lifecycle ownership

- `main.ts` constructors and `onload` remain cheap and registration-only.
- Plugin-wide commands, Vault events, settings tab, and view registrations are registered through Obsidian lifecycle helpers.
- One `ItemView` instance owns one React root and unmounts it in `onClose`.
- Native `Menu`, `Notice`, short `Modal`, and `PluginSettingTab` surfaces are used where React would add no value.
- Complex planning, closing, and board surfaces use React behind a native lifecycle shell.
- Reload tests must prove one registration, no detached root, and no callback from a prior plugin instance.

## View shell and state

Register a stable view type and store its mode in Obsidian view state. The connected root owns providers for the application service, index subscription, current settings, and an error boundary. Presentational feature surfaces receive serializable view data and callbacks and render in Storybook without constructing an Obsidian `App`.

Every surface represents applicable states explicitly: loading, loaded, empty, stale data with error, mutation pending, mutation failure, and diagnostics requiring action.

The shell provides an accessible page menu for Focus, Plan, Inbox, History, Capture, and Settings. Distractions is persisted as an Inbox section; Sprint Close is a secondary mode in the same leaf. Ribbon and command activation reveal the existing Focus Flow leaf instead of multiplying views.

## Board interaction

`@dnd-kit/react` is wrapped by `BoardDragAdapter`. No domain or application module imports DnD types. The Phase 2 adapter accepts only serializable IDs, labels, a group, and an `onMove(id, targetIndex)` callback. Its drag-end event is translated at that boundary before reaching the connected workflow.

```ts
type MoveTask = (
  taskId: EntityId,
  targetStatus: TaskStatus,
  beforeTaskId: EntityId | null,
  afterTaskId: EntityId | null,
) => Promise<MoveResult>
```

The application service validates the transition, WIP policy, parent Story, Active Sprint membership, and neighbor ranks before returning the new status/rank mutation. The UI applies optimistic movement only while retaining the previous state; rejection restores it and announces the reason.

Story swimlane reordering calls a separate `reorderSprintStory` use case. Month and Epic backlog DnD use their owning ranks. The adapter may be replaced if pre-1.0 DnD APIs change without altering these contracts.

Keyboard movement and the Move menu call the same application operation. On
desktop, sortable rows expose dedicated drag handles and the library's keyboard
sensor. On mobile, `Platform.isDesktopApp` is false and the adapter renders a
plain list without mounting `DragDropProvider` or `useSortable`; the reorder
menu remains available.

Title links first reveal an existing Markdown leaf for the same file, otherwise reuse one tracked preview leaf. `Keymap.isModEvent`, middle-click, and `hover-link` events preserve Obsidian's explicit-new-leaf and preview behavior. The surrounding row never impersonates a link.

## Styling and accessibility

- Scope all CSS beneath `.focus-flow` and use Obsidian CSS variables.
- Do not use Tailwind, shadcn/ui, or global resets in V1.
- Use semantic buttons, lists, headings, dialogs, and live regions; never make a draggable container the only interactive control.
- Keep title links compatible with modifier-click, middle-click, hover previews, and focus visibility.
- Restore focus after dialogs and menus and announce invalid moves and saved mutations.
- Test light/dark, community themes, high zoom, narrow sidebars, pop-outs, long titles, and mobile.

## Settings

Settings persist through `loadData`/`saveData` with their own versioned shape, defaults, handwritten normalizer, and idempotent migrations. Domain data never appears in settings.

Tag Catalog data stays out of plugin settings. A narrow port reads and updates
only `focus_flow.tags` in `<root>/TAGS.md`, preserves its body and unrelated
frontmatter, and publishes catalog-local diagnostics without changing work-index
readiness. **Settings → Tags** owns catalog metadata editing. Any explicit tag
addition through Focus Flow UI and any color assignment attempts to create the
exact catalog entry; a failed catalog write is reported but does not block the
work-note tag. Catalog removal is a deliberate entry operation and is blocked
when current nonterminal work uses the exact native tag; terminal notes and
frozen history remain independent of current catalog membership.

Simple fields use native `PluginSettingTab` and `Setting`. Writes are serialized; a failed save keeps the prior durable value and reports an inline error. English strings remain plain constants; no i18n runtime is included until a second locale is supported.

Root onboarding and migration are application use cases, not raw settings writes. They preflight paths, preserve existing files/templates, use Vault APIs, update the setting only after a successful move/adoption, and then rebuild the index.

Only Candidate, Task, and Retrospective body-template paths are runtime
settings. Standard Epic and Story templates are user/agent conventions,
Mission is a unique user-owned document, and the managed Sprint report has no
template setting.

Managed Markdown schema migration is a separate explicit batch workflow. It
previews the affected note count, keeps incompatible notes read-only, and uses
the same durable forward-resume protocol. No migration runs on load or lazily
inside an ordinary note mutation.

## Security, privacy, and mobile

- Set `isDesktopOnly: false`.
- Use no Node.js, Electron, `FileSystemAdapter`, subprocess, direct filesystem, network, secret, analytics, or telemetry APIs.
- Treat note names, bodies, tags, settings, and commands as sensitive; omit them from production logs.
- Keep runtime dependencies few, pinned by lockfile, and bundled except Obsidian/CodeMirror/Lezer/Node externals required by the official build contract.

## Tooling and release contract

Scaffold from the current official Obsidian sample-plugin contract with pnpm, strict TypeScript, React, esbuild for the plugin bundle, and Vite only for Vitest/Storybook.

Keep the runtime dependency set explicit and small: React/React DOM for composed views, `@dnd-kit/react` behind the adapter, `fractional-indexing` for ranks, `uuid` for UUIDv7 generation, and Zod for the nested externally editable domain/snapshot schema. Use a handwritten normalizer for the small primitive settings shape. Pin resolved versions in `pnpm-lock.yaml` and add no state, date, CSS, or Markdown framework until a concrete behavior requires it.

Required checks are lint, typecheck, unit/component tests, Storybook tests/build, production plugin build, and isolated-vault Obsidian E2E smoke. The release attaches `main.js`, `manifest.json`, and `styles.css`; `main.js` remains out of normal source commits. Manifest/package/version entries remain synchronized, releases use exact version tags without a `v` prefix, and no default hotkeys are shipped.

## Skill and CLI boundary

The Node 22 CLI is an authoring adapter with exactly three commands: `create
candidate`, `create task`, and read-only `check`. It uses an explicit vault
path, reads plugin settings, and reuses indexing, schemas, templates, key
allocation, serialization, parent validation, and Sprint Scope WIP policy. It
does not expose lifecycle, status, ordering, Sprint, evaluation, or repair
mutations.

The repository-owned `$focus-flow` skill calls the two creation commands and
edits only user-owned Markdown body content and native tags. It may record
Mission-aware WANT/SHOULD reflection during an Entry Review, but Candidate
triage and every workflow transition remain explicit plugin actions. The CLI
`check` also projects Tag Catalog and uncataloged-current-tag diagnostics as
warnings. The plugin itself gains no network or AI integration.
