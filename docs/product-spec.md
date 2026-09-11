# Focus Flow Product Specification

## Purpose

Focus Flow turns a deliberate personal work-management system into an Obsidian-native workflow. It should help one person decide what deserves attention, connect weekly outcomes to long-lived directions, limit current work, and retain enough history to learn without introducing estimates, velocity, or calendar scheduling.

The canonical vocabulary is defined in [`CONTEXT.md`](../CONTEXT.md).

## V1 scope

V1 includes:

- a dedicated Mission note;
- Candidate capture, acceptance, and rejection;
- ordered Epic and Month backlogs;
- Draft, Active, and Closed weekly Sprints;
- a responsive Story-swimlane Focus Board;
- Story evaluation, Task triage, Sprint closure, and retrospective;
- Markdown-backed Sprint history and diagnostics;
- a Workspace-backed Tag Catalog with exact tag semantics and optional colors;
- month-bucketed placement for terminal work and Closed Sprints, with an
  explicit organizer;
- safe reopening of the latest Closed Sprint;
- configurable note and retrospective templates;
- an authoring-only Node CLI for Candidate/Task creation and consistency checks;
- an optional repository-owned skill for Focus Flow body and Cataloged Tag
  authoring outside the plugin.

V1 excludes:

- monthly, quarterly, and annual review ceremonies beyond cadence counters;
- estimates, velocity, time tracking, calendars, reminders, recurring Tasks, and automatic prioritization;
- assignees, shared ownership, permissions, collaboration, CRDTs, and conflict-free realtime editing;
- generic Markdown, Obsidian Kanban, or third-party task importers;
- a canonical database or any plugin network, account, telemetry, or AI runtime;
- localization beyond English.

Focus Flow remains a personal, single-operator product after V1. The Obsidian
plugin remains local-only and mobile-compatible; future AI or service-assisted
workflows run outside it through the deterministic CLI boundary.

## Information architecture

Focus Flow registers one Obsidian ItemView shell that can display five modes. Commands open the requested mode in an existing Focus Flow leaf by default; users may explicitly open multiple leaves side by side.

### Focus

Shows the Active Sprint as a Story-swimlane board.

- Desktop pins Today beside one selected status from the seven-state lens and groups Tasks by Story.
- Mobile defaults to a combined Now feed for Today and In Progress, with any single status available from the same lens.
- Only a card's title opens its Markdown note. The rest of the card owns selection, DnD, and actions.
- Modifier-click opens the note in another leaf using Obsidian's native link behavior.
- A keyboard-accessible **Move to** menu is always available and is the primary mobile movement interaction.

### Plan

Shows three independently expandable planning areas:

1. **Active Sprint** or **Next Sprint**, collapsible at the top.
2. **Month Backlog**, containing uncommitted Stories.
3. **Epic Backlog**, containing active Epics.

Expanding an Epic shows its Stories that are currently in the Month Backlog or Sprint. Expanding a Story shows all of its Tasks in `task_rank` order, including previously completed Tasks.

### Inbox

Shows Candidates as a searchable list in capture order. Native tags remain visible as passive metadata. A compact tag picker provides searchable tag filters, live Candidate counts, and explicit **Matches all selected tags** AND semantics. Row menus contain **Filter by tag…**, **Accept as Epic**, **Accept as Story**, and **Reject**; focused dialogs collect only the extra information an action needs. Direct valid Markdown remains supported.

Entry Review belongs to the Candidate's user-owned Markdown body and may be
written with the companion `$focus-flow` skill. The plugin does not parse or
diagnose WANT/SHOULD answers. A missing or empty Mission appears as a quiet,
dismissible reminder with a **Create and open** action and never blocks capture
or acceptance.

### Distractions

Lives inside Inbox, shows rejected Candidates, and preserves their body, tags, and any reflective Distraction Analysis. **Reconsider** returns the same note to Inbox and clears rejection metadata.

### History

Leads with the latest reflection and Story outcomes, with filters for date range, Epic, and Effective Tags. Raw counts and older Month/Quarter/Year groups remain secondary disclosures. Selecting a title opens the ordinary Sprint Markdown note.

## Core workflows

### Capture and entry

1. **Capture Candidate** creates an Inbox note immediately with a UUIDv7 identity and global `FF-n` key.
2. The user may add arbitrary context and native Obsidian tags.
3. **Accept as Epic** reclassifies and moves the same note into `Epics/`, assigns the last Epic backlog rank, and preserves identity.
4. **Accept as Story** reviews typed Story fields and requires selecting one Epic, then reclassifies and moves the same note into `Stories/` as `epic_backlog`. In Plan, **+ Month** explicitly shortlists it at the end of Month; **Return to Epic** removes that selection before Sprint commitment.
5. **Reject** moves the same note into `Distractions/` and optionally records a reason. Reflective analysis remains ordinary body content and may be completed later by the user or future skill.

### Story preparation

A Story uses:

- an outcome-oriented title;
- free Markdown under `## Description`;
- one or more checkboxes under `## Acceptance Criteria` before Sprint selection;
- zero or more Tasks created only through that Story.

Acceptance Criteria are required for Sprint selection; Tasks are not. An empty selected Story displays **Decompose story**. Tasks added before Sprint start belong to the initial snapshot. Tasks added later belong to the Active Sprint immediately and are captured in the Sprint Delta at closure.

### Sprint planning and start

1. With no Active Sprint, Plan exposes one Draft Sprint.
2. Selecting a Story transfers it from Month Backlog to Draft Sprint and assigns `sprint_rank`. Its previous backlog position is retained only for cancelling the Draft.
3. Draft Stories can be reordered and decomposed directly.
4. Starting validates Acceptance Criteria, shows the soft scope limit, assigns the next `SPR-n` code, and writes the Start Snapshot.
5. The configured first weekday defaults to Monday. Start always shows the calendar-aligned `starts_on` and `due_on`; a midweek start keeps that due date and shows the remaining days.
6. A Sprint remains Active until explicitly closed; after its configured calendar window ends it is marked overdue.

Only one Draft or Active Sprint may exist. The next Sprint is not planned alongside an Active Sprint.
Sprint codes count Sprints that actually started, so a break creates no skipped
numbers. At most one Sprint may start for a configured calendar window; closing
early does not permit a second commitment with the same `starts_on` date. After
an early Close, one Draft may be prepared immediately, but Start remains
disabled until the next unused window and explains its next available date.

### Task flow

The exact allowed transitions are:

```text
TODO -> Tomorrow | Today
Tomorrow -> Today
Today -> In Progress | On Hold | Done
In Progress -> Done | External In Progress | On Hold
External In Progress -> In Progress | On Hold | Done
On Hold -> TODO | Tomorrow
Done -> terminal
```

Tomorrow and Today are manually selected intent states, not dates or automatic
queues. External In Progress means work is proceeding outside the user's direct
control; On Hold means it is intentionally paused.

Dropping onto an invalid status restores the card and explains the allowed destinations. The Move menu only lists valid destinations.

Moving a Task atomically updates `status` and its canonical `task_rank`. That rank is reused in the expanded Story and in every filtered status cell. Moving into `In Progress` for the first time sets `started_at`; moving into `Done` sets `completed_at`.

### WIP policies

Each policy has `off`, `soft`, or `hard` enforcement and a positive integer limit. Defaults are soft:

| Policy | Limit | Counting rule |
| --- | ---: | --- |
| Sprint scope | 28 | All Tasks under Active Sprint Stories except Tasks already Done at start; Done does not release scope |
| Tomorrow | 7 | Current Tasks in Tomorrow |
| Today | 7 | Current Tasks in Today |
| In Progress | 1 | Current Tasks in In Progress |

Tasks completed before the current Sprint remain visible, muted, in Done but do not count toward current Sprint scope.

Soft violations require confirmation. Hard violations reject the operation. Existing violations caused by manual edits remain visible and diagnostic; the plugin does not silently move work.

### Active Sprint changes

Tasks may be added beneath an Active Sprint Story without a reason. Sprint Scope WIP policy is enforced before creation: soft excess requires typed confirmation and hard excess rejects the operation. Every such Task belongs to Sprint Scope, including after it becomes Done.

When the initially committed work finishes early, the normal path is to add a
ready Month Story to the same Active Sprint. The Story remains subject to WIP
and close decisions, and Sprint Delta preserves the factual scope addition.

Plan explicitly adds a Month Backlog Story to the Active Sprint, returns an
Active Story to a chosen Month position, or reparents it to an active Epic.
Focus remains a Task-flow surface. These actions validate rank neighbors,
Acceptance Criteria, Scope WIP, close state, and parent lifecycle without
asking for reasons.

Returning a Story rejects Tomorrow, Today, or In Progress child Tasks and the
last Story in a Sprint. TODO, External In Progress, On Hold, and Done remain
truthful. A saved provisional outcome is cleared first; interruption therefore
leaves a valid unevaluated Active Story that ordinary retry can finish.

At closure, Focus Flow derives a Sprint Delta by comparing the Start Snapshot
with the live Story/Task boundary and ordered Acceptance Criteria text. Added
or removed Stories and Tasks and changed Acceptance Criteria are reported;
checkbox-only and Epic-parent changes are not. No mid-Sprint journal or
acknowledgement is required.

### Story evaluation

Completing all Tasks never completes a Story automatically. It only marks the Story **Ready to evaluate**.

The user explicitly records the actual outcome and chooses:

- **Achieved** when Acceptance Criteria are satisfied;
- **Not achieved** when the Story remains active;
- **Closed** when the outcome is no longer relevant.

When unchecked Acceptance Criteria have an explicit Acceptance Exception, the
outcome remains Achieved; “Achieved with exception” is not a fourth outcome.

An evaluation recorded before Sprint closure is provisional: the Story remains visible in the Active Sprint and may be revised. The close ceremony finalizes the outcome and terminal lifecycle.

An Epic cannot be completed while it owns active Stories. Completion requires
at least one terminal child Story and all Epic Acceptance Criteria checked.
Closing permits an empty Epic or unchecked criteria after active children are
moved or finalized; its reason is optional.

### Sprint closure

Closing is an explicit ceremony:

1. Evaluate every unevaluated Story.
2. For every unfinished Task choose: continue in the same Story, move to another Story, reclassify as Story under an Epic, or close as irrelevant.
3. Preserve optional continuation context. Continuing Tasks in External In Progress or On Hold retain that truthful state; TODO, Tomorrow, Today, and In Progress reset to TODO.
4. Move every continuing Story back into a user-chosen Month Backlog position. There is no automatic carry-over.
5. Record optional Retrospective Items under Wins, Friction, and Improvements.
6. Derive the Sprint Delta, write the Close Snapshot and generated report,
   move the Sprint to its `closed_at` month, then mark it Closed.

Closing before `due_on` requires a dedicated confirmation that another Sprint
cannot start in the same Sprint Window. The latest Closed Sprint may be
reopened until another Sprint starts, provided no Draft or Active Sprint exists,
its Close captured `reopen_recovery`, and every affected managed note still
matches the expected post-close state. The user cancels a Draft explicitly
before Reopen; the plugin never merges or suspends it.

Reopen retracts that Close boundary, restores the same Sprint and its affected
work to their exact pre-close managed state through a resumable operation, and
moves the Sprint note from its dated archive back to `Sprints/SPR-nnn.md`. It
removes the generated report while preserving user-owned retrospective text. A
later Close derives a fresh archive bucket from the new `closed_at`. Older
Closed Sprints without `reopen_recovery` and any non-latest Sprint remain valid
History but cannot be reopened.

Reclassifying a Task as Story preserves its UUID, key, body, and native tags; replaces its parent Story with a parent Epic; requires Acceptance Criteria before future Sprint selection; and moves the note from `Tasks/` to `Stories/`. The Close Snapshot preserves the historical Task representation.

### Retrospective

The default template contains:

- **Wins** — what worked and should be retained;
- **Friction** — blockers, overload, distraction, and what went badly;
- **Improvements** — changes or experiments worth considering.

All sections are optional. Any Retrospective Item may be promoted to a new Candidate with a backlink to the Sprint; it never becomes a Task directly.

## History and summaries

History groups actual commitments into partial or completed Review Years,
Quarters, and Months of forty-eight, twelve, and four Closed Sprints. Each
period summarizes Done/Closed Epics, Story Outcomes, and completed Tasks by
frozen Effective Tags, then exposes its Sprint cards. Epic finalizations after
the latest close remain under **Since last Sprint** until the next close
boundary. Generated Review notes are not created. Terminal Archive folders are
navigation over canonical notes and never determine period membership. History
opens a Sprint through its current indexed path rather than deriving a location
from its Review Cycle.

The History card and generated report show raw counts rather than velocity:

- Stories achieved versus attempted;
- open Tasks committed at start;
- Tasks present at start and close;
- Tasks completed during the Sprint;
- Tasks still open at close;
- Sprint Delta and exceptions;
- approximate `completed_at - started_at` elapsed calendar time when both exist;
- completed Tasks grouped by frozen Effective Tags.

Wins, Friction, Improvements, and Promote to Candidate remain on their source
Sprint card rather than being duplicated into period summaries.

V1 deliberately cannot answer time-in-status, active effort, number of status reversals, or cumulative flow because it does not record every transition.

## Tag Catalog and Terminal Archive

`<root>/TAGS.md` stores the Workspace Tag Catalog as exact tag keys with optional
descriptions and `#RRGGBB` base colors. Its Markdown body contains user-owned
project guidance for choosing tags. Catalog membership recommends a tag to the
person and permits the companion skill to reuse it; native tags outside
the catalog remain valid.

Focus Flow automatically attempts to catalog every tag explicitly added through
its UI, including an observed non-cataloged tag, and also catalogs a tag when a
color is assigned. Cataloged tags appear first in suggestions and may show their
description, while other observed tags remain in the same list without a badge
or separate group. A catalog-write failure does not block saving the work tag
and is reported separately.

Direct Markdown edits are read live. A tag outside the catalog on current
nonterminal work produces an advisory consistency warning and can be added by
an explicit confirmed repair. Terminal work and frozen Sprint history do not
require catalog membership. Missing or invalid catalog data never makes work
read-only; valid entries remain usable, and an invalid color falls back to
neutral without invalidating the tag. Colors apply live to tag chips, filters,
and tag charts, including existing History, while snapshots continue to freeze
tag values without colors.

Removing or renaming an entry never rewrites work notes or frozen history.
Removal is blocked while the exact tag appears on current nonterminal work;
terminal work and frozen Sprint history do not block it. An allowed removal
also removes the entry's description, color, recommendation, and permission for
automated reuse. The companion skill may use only valid Cataloged Tags, must
follow the file body, and may add a new entry only after user confirmation. If
no entry fits, it leaves the work untagged rather than choosing an approximate
match.

Every Done or Closed Epic, Story, and Task moves automatically to its typed
`Archive/YYYY/MM/` path using the local date in `completed_at` or `closed_at`.
Closing a Sprint similarly moves it to
`Sprints/Archive/YYYY/MM/SPR-nnn.md` using `closed_at`; Draft and Active Sprints
remain directly under `Sprints/`. These are canonical moves, not copies: UUID
relationships and History remain stable, while moves of work parents update
current derived child wikilinks. Sprint snapshots are never rewritten.

An explicit **Terminal notes → Review…** action previews and arranges terminal
work and Closed Sprint notes that predate automatic placement, were moved
manually, or belong to an interrupted operation. Its durable plan is idempotent
and resumable; a collision or changed note is reported and never overwritten.
Draft or Active Sprints under `Archive/` remain placement errors.

History, Open, and Reopen resolve the current Sprint path from its UUID. A
Candidate promoted from an Improvement uses the stable `[[SPR-nnn]]` backlink.
Focus Flow does not migrate arbitrary user-authored path-qualified Sprint links.

## Diagnostics and recovery

Diagnostics never hide valid content or rewrite user notes silently. They cover:

- invalid or unsupported schema versions;
- malformed managed frontmatter;
- duplicate UUIDs, keys, or ranks;
- missing or mismatched parent UUID/link pairs;
- missing parent entities and orphaned Tasks;
- invalid lifecycle/status combinations;
- missing Acceptance Criteria for selected Stories;
- missing transition timestamps;
- files stored outside their configured active or terminal typed placement;
- invalid Tag Catalog entries and nonterminal work tags missing from the catalog;
- unsafe or unavailable Sprint Reopen state.

Repair operations show exact affected files and preserve unmanaged frontmatter and body content. Duplicate human keys are repaired deterministically: the lowest UUIDv7 keeps the key and newer entities receive the next free sequence, with corresponding file rename and derived-link repair.

## Settings

V1 settings are:

- Focus Flow root folder, default `Focus Flow`;
- accent color source, default Obsidian, with Indigo and custom `#RRGGBB`
  alternatives adapted to accessible light/dark UI roles;
- first weekday, default Monday;
- four WIP policy modes and limits;
- body-template paths for Candidate, Task, and Retrospective;
- setup completion state;
- schema version, managed internally.

Tag Catalog editing is available under **Settings → Tags** but writes the
canonical Workspace Markdown document rather than plugin settings. Hovering or
focusing a row shows its description in the host tooltip. Expanding the row
edits or clears its optional description and color without closing after each
save; the expanded overflow menu changes catalog membership. Work editors
catalog new explicit tag additions after the work change succeeds.

Focus Flow provides standard Candidate, Epic, Story, Task, and Retrospective
body templates. Candidate, Task, and Retrospective are applied by plugin
workflows. Epic and Story templates are conventions that a person or agent may
apply to user-owned Markdown; Candidate reclassification always preserves the
existing body. Mission is one user-owned document created manually or by the
future skill, and the Sprint report remains deterministic generated content.

The Accent color editor uses the same compact interaction as Tag colors:
`Obsidian` replaces the neutral choice, six named swatches save immediately,
and a custom HEX value uses an explicit **Save color** action. Its collapsed row
shows the effective marker and `Obsidian`, `Indigo`, or the saved HEX value.

The same settings surface renders in the Focus Flow leaf and native Obsidian Settings. No default hotkeys are assigned.

On first use, onboarding previews the root and exact folders/default body
templates to create. It creates only missing paths and never overwrites an
existing note or template. If the root already contains Focus Flow metadata,
onboarding validates and adopts it instead. Setup starts on the first
root-dependent action rather than plugin enable and never generates Mission
content.

After the root contains domain notes, changing it is a deliberate **Move Focus
Flow root** operation rather than an immediate text-setting update. The target
must not exist. The operation records transient recovery state, renames the
whole tree through the Vault API, remaps configured template paths inside the
old root, updates the setting only after success, and reindexes. Selecting an
existing root is a separate validation flow with no domain writes.

## Accessibility and platform acceptance

- Every DnD operation has a keyboard and menu equivalent.
- Focus, hover, validation, pending, empty, and error states are perceivable without color alone.
- Dialogs restore focus and support Escape.
- Long titles, narrow sidebars, high zoom, light/dark themes, pop-out windows, and mobile dimensions remain usable.
- The plugin is `isDesktopOnly: false` and never evaluates Node.js, Electron, or direct filesystem modules on mobile.
