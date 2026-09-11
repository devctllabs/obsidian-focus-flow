# Markdown Data Model

## Storage contract

All domain data lives in Markdown files beneath one configured vault-relative root. Plugin `data.json` stores settings only and must never be required to reconstruct work, ranks, relationships, or history.

Default layout:

```text
Focus Flow/
├── MISSION.md
├── TAGS.md
├── WORKSPACE-OPERATIONS.md
├── Inbox/
├── Epics/Archive/YYYY/MM/
├── Stories/Archive/YYYY/MM/
├── Tasks/Archive/YYYY/MM/
├── Sprints/Archive/YYYY/MM/
├── Distractions/
└── Templates/
```

The directories are configurable only as a group through the root path.
Individual typed-folder names are stable contracts. Placement repair resolves
the current root when the user invokes it, validates the note UUID, and refuses
to overwrite an existing destination. Active Epic, Story, and Task notes and
Draft/Active Sprint notes live directly in their typed folder. Done/Closed work
and Closed Sprint notes live only in that typed folder's `Archive/YYYY/MM/`
subtree; other nested paths remain invalid.

## Managed and user-owned content

Each entity note contains:

1. a plugin-managed `focus_flow` frontmatter object;
2. native top-level Obsidian `tags` owned by the user;
3. a user-owned Markdown body created from a configurable template;
4. explicitly marked generated sections only where the plugin must regenerate content.

The plugin may update only `focus_flow` and marked generated sections. It must preserve unrelated frontmatter keys, native tags, body text, headings, links, block IDs, comments, and formatting.

Effective Tags are a read projection, never copied managed metadata. Their
stable order is first occurrence from ancestor to child: Epic tags, then Story
tags, then Task tags. A parent tag edit therefore changes descendant Effective
Tags on the next index refresh without rewriting descendant notes.

Body templates never define identity, lifecycle, relationship, status, or rank fields. The plugin creates those fields after reading the template body.

## Tag Catalog

The optional `<root>/TAGS.md` document is the canonical Workspace Tag Catalog.
It is not a work entity and has no identity, lifecycle, rank, or relationships.
Its body and unrelated frontmatter are user-owned; the plugin owns only this
branch:

```yaml
focus_flow:
  schema_version: 1
  type: tag_catalog
  tags:
    weekly-review: {}
    area/focus:
      description: "Work requiring sustained attention."
      color: "#6750A4"
```

Keys use normal tag normalization, omit the leading `#`, preserve case, and
match exact native tag values. Every structurally valid mapping entry is a
Cataloged Tag, including an empty `{}` entry. `description` is optional; when
present it is a non-empty string. `color` is an optional six-digit `#RRGGBB`
base value. An invalid optional field is ignored with an entry-local diagnostic;
an invalid color falls back to the neutral theme style without removing catalog
membership. A non-mapping entry is not cataloged. A malformed document produces
an empty catalog and a catalog-local diagnostic without making work read-only.

The Markdown body may contain project-wide tag-selection rules and examples.
The plugin preserves but does not interpret it. Future automated authoring must
follow that guidance and may apply only valid Cataloged Tags; if none fits, it
leaves the work untagged and may propose a catalog change for user confirmation.

The catalog is read live for authoring suggestions, colors, filters, and History
charts and is never copied into work notes or Sprint snapshots. Cataloged Tags
appear first in authoring suggestions and may show their description; observed
tags outside the catalog remain valid and appear in the same list without a
warning marker or separate group. Any explicit tag addition through Focus Flow
UI attempts to add an empty catalog entry, including selection of a tag observed
outside the catalog. Saving a color does the same. If the catalog write fails,
the work-note tag is still saved and the failure is reported.

Refresh and Vault events re-read `TAGS.md`. A tag used on a nonterminal Candidate,
Epic, Story, or Task but missing from the catalog produces an advisory consistency
diagnostic with an explicit confirmed repair that adds the exact tag. Terminal
work and frozen Sprint history never require current catalog membership. A
catalog entry cannot be removed while its exact native tag appears on current
nonterminal work. Removing or renaming an otherwise unused entry does not rewrite
native tags or frozen history; it removes the description, live color,
recommendation, and automated-authoring permission. The file is created on the
first successful UI catalog addition or color save. The pre-release
`TAG-COLORS.md` contract has no fallback or migration path.

## Common identity

All Candidate, Epic, Story, and Task notes contain:

```yaml
focus_flow:
  schema_version: 1
  id: 019946f1-8d2a-7f05-87b1-1eebbb476300
  key: FF-42
  type: story
  lifecycle: backlog
  created_at: 2026-08-30T09:00:00+04:00
tags:
  - product/focus-flow
```

Rules:

- `id` is UUIDv7 and is the canonical identity.
- `key` is the stable human reference `FF-<positive integer>` with no padding.
- `type` is `candidate`, `epic`, `story`, or `task`.
- `created_at` is immutable RFC 3339 with offset.
- Filenames are `<key> <sanitized title>.md`; title changes rename the file through `FileManager`. The title is the filename remainder after the key. Sanitization normalizes Unicode to NFC, replaces path separators/control characters and Windows-reserved filename characters with `-`, collapses whitespace, trims trailing dots/spaces, and falls back to `Untitled`.
- Supported close and rejection workflows retain notes, so their keys remain indexed and are not reused. Permanent manual deletion falls outside that guarantee; if an older synced note later reappears with a reused key, normal collision repair applies.

Allocation scans the indexed maximum key and serializes allocations within a plugin instance; it does not maintain a central counter file. If synced devices allocate the same key, deterministic repair sorts colliding notes by UUIDv7: the lowest UUID keeps the key and later UUIDs receive consecutive numbers above the current global maximum. One serialized plan updates derived child links before changing managed keys and filenames, preventing a race with Obsidian's rename link updater. Applied replacements are valid resume points; destination collisions and unexpected current values stop the plan. If a colliding group also has a duplicate UUID, key repair remains unavailable until UUID identity is repaired.

For a duplicate UUID, the ordinal-lowest Vault path keeps the current value and every later path receives a fresh UUIDv7 when repair executes. Derived `epic_id` and `story_id` fields are updated only when their adjacent wikilink identifies exactly one colliding parent path. A `sprint_id` is updated only when the collision group contains exactly one Sprint. Any ambiguous reference keeps that collision group read-only. The resumable writer preflights every path, updates derived references first, then owner IDs, and changes no unmanaged frontmatter or body content.

## Lifecycle and type-specific fields

### Candidate

```yaml
focus_flow:
  schema_version: 1
  id: 019946f1-8d2a-7f05-87b1-1eebbb476300
  key: FF-42
  type: candidate
  lifecycle: inbox
  created_at: 2026-08-30T09:00:00+04:00
```

Allowed lifecycle values are `inbox` and `rejected`. Rejection adds `rejected_at` and optional `rejection_reason`, then moves the note to `Distractions/`. Reconsideration moves the same note back to `Inbox/` and clears both rejection fields without retaining a rejection-history record. Acceptance reclassifies the note instead of retaining an accepted Candidate record; the Sprint and entity history preserve its prior role where relevant.

Entry Review and Distraction Analysis are user-owned Markdown body sections,
not managed or advisory frontmatter. A future skill may write those sections
and native tags. Candidate acceptance or rejection preserves them with the
rest of the body.

### Epic

```yaml
focus_flow:
  schema_version: 1
  id: 019946f1-8d2a-7f05-87b1-1eebbb476300
  key: FF-42
  type: epic
  lifecycle: backlog
  backlog_rank: a0
  created_at: 2026-08-30T09:00:00+04:00
```

Allowed lifecycle values are `backlog`, `done`, and `closed`. A backlog Epic
requires `backlog_rank`. A done Epic has no rank and requires `completed_at`; a
closed Epic has no rank, requires `closed_at`, and may carry `close_reason`.
Both terminal actions require every child Story to be terminal or moved first.
Completion additionally requires at least one child Story and at least one
checked set of Epic Acceptance Criteria. Closing permits an empty Epic and does
not require its criteria to be checked. Both terminal actions move the
canonical note to `Epics/Archive/YYYY/MM/` using the local date in the terminal
timestamp.

### Story

```yaml
focus_flow:
  schema_version: 1
  id: 019946f1-8d2a-7f05-87b1-1eebbb476300
  key: FF-42
  type: story
  lifecycle: backlog
  epic_id: 019946c9-5f97-7196-8483-73469275ff90
  epic_link: "[[Focus Flow/Epics/FF-7 Build Focus Flow]]"
  backlog_rank: a0
  created_at: 2026-08-30T09:00:00+04:00
```

Allowed lifecycle values are `epic_backlog`, `backlog`, `draft_sprint`, `active_sprint`, `done`, and `closed`.

- `epic_id` is canonical; `epic_link` is a human-readable derived value.
- Parent-link validation accepts either the vault-relative target or its
  filename target; the UUID remains authoritative when the link is stale.
- A backlog Story has `backlog_rank` and no active `sprint_id`.
- An `epic_backlog` Story is accepted under its Epic but not shortlisted for Month; it has no backlog or Sprint rank. **+ Month** selects it explicitly. See [ADR 0019](adr/0019-curate-month-backlog-explicitly.md).
- A Draft or Active Story has `sprint_id` and `sprint_rank`. Its old `backlog_rank` may remain only as a cancellation hint and is not part of the live Month order.
- Returning from a Closed Sprint always assigns an explicit new `backlog_rank`.
- `done` adds `completed_at`, `outcome`, and optional `acceptance_exception_reason`.
- `closed` adds `closed_at` and `close_reason`.

Both terminal lifecycles place the canonical note under
`Stories/Archive/YYYY/MM/`. The move updates current child `story_link` values;
Sprint snapshots remain unchanged.

An outcome recorded during an Active Sprint is stored provisionally in that Sprint note; it does not change the Story from `active_sprint`. Sprint closure finalizes the outcome and applies `done`, `closed`, or a return to `backlog`.

Candidate, Epic, Story, and Task templates contain a recognizable Acceptance
Criteria section. Candidate and Task criteria are authoring guidance. Story
criteria are required before Sprint selection, and Epic criteria are required
before completion:

```markdown
## Description

The context and constraints for this outcome.

## Acceptance Criteria

- [ ] The Focus Board opens on desktop and mobile
- [ ] Invalid moves explain the allowed statuses
```

The section is identified by the exact `Acceptance Criteria` heading at any
Markdown heading level. The heading is intentionally user-readable; it must
not be renamed or duplicated.

### Task

```yaml
focus_flow:
  schema_version: 1
  id: 01994706-857c-76f1-8006-85cd9bd80890
  key: FF-43
  type: task
  lifecycle: active
  story_id: 019946f1-8d2a-7f05-87b1-1eebbb476300
  story_link: "[[Focus Flow/Stories/FF-42 Use Focus on mobile]]"
  task_rank: a0
  status: todo
  created_at: 2026-08-30T09:10:00+04:00
  started_at:
  completed_at:
```

Allowed lifecycle values are `active`, `done`, and `closed`.

- `story_id` is canonical; `story_link` is derived.
- Parent-link validation accepts either the vault-relative target or its
  filename target; the UUID remains authoritative when the link is stale.
- `status` is `todo`, `tomorrow`, `today`, `in_progress`, `external_in_progress`, `on_hold`, or `done`.
- `active` Tasks use a non-Done status; `done` Tasks use status `done`.
- `closed` retains its last status and adds `closed_at` plus `resolution: irrelevant`.
- Entering `in_progress` for the first time sets `started_at`; later movement never resets it.
- Entering `done` sets `completed_at`. A direct `today -> done` may legitimately have no `started_at`.
- `external_in_progress -> done` is valid when work outside the user's direct control completes.

Done and Closed Tasks live under `Tasks/Archive/YYYY/MM/`, derived from
`completed_at` or `closed_at`. Editing a terminal Task retains that bucket.

Task-to-Story reclassification changes the existing note's `type`, folder, lifecycle, parent fields, and ranks. There is no surviving current Task record; historical Close Snapshots retain the Task representation.

During Sprint closure, a continuing Task in `external_in_progress` or
`on_hold` retains that truthful status. Other continuing open statuses reset to
`todo` before the Story returns to the Month Backlog.

## Rank contracts

Ranks use Rocicorp fractional-indexing keys and case-sensitive ordinal comparison, never locale comparison. UUID is the deterministic tie-breaker.

| Rank | Owning ordered collection | Active for |
| --- | --- | --- |
| `backlog_rank` on Epic | Single Epic Backlog | Epic lifecycle `backlog` |
| `backlog_rank` on Story | Single Month Backlog | Story lifecycle `backlog` |
| `sprint_rank` on Story | One Draft or Active Sprint | Story lifecycle `draft_sprint` or `active_sprint` |
| `task_rank` on Task | Parent Story | All current Tasks of the Story |

DnD generates a key between the visible neighbors in the owning collection. Bulk repair uses `generateNKeysBetween` to produce evenly spaced keys while preserving `(rank, UUID)` order. One repair action covers the complete owning collection, records the expected old value for every note, and treats an already-written replacement as a safe resume point. A different current value makes the plan stale and stops further writes. Sprint and backlog ranks are deliberately separate; `task_rank` is deliberately shared across Plan and Focus projections.

## Sprint notes

Sprint codes use `SPR-001` minimum three-digit display width and grow naturally. Review codes are derived from the one-based Sprint sequence. `MON` uses a minimum three-digit width; `QTR` and `YR` use a minimum two-digit width:

- `MON-001` groups four Sprints;
- `QTR-01` groups twelve Sprints;
- `YR-01` groups forty-eight Sprints.

The codes are operational cadence labels, not item memberships or calendar promises.

Before start, the single Draft is `Sprints/DRAFT.md`. It has an ID, `type: sprint`, and `lifecycle: draft`, but no code, sequence, dates, or snapshots. Starting assigns the next code/sequence, renames the note to `Sprints/SPR-nnn.md`, sets dates, and creates the Start Snapshot. Closing moves that same canonical note to `Sprints/Archive/YYYY/MM/SPR-nnn.md`, where the bucket comes from the local date and offset in `closed_at` without conversion to UTC.

An Active Sprint note begins with:

```yaml
focus_flow:
  schema_version: 1
  id: 01994744-a401-759a-b582-4418f2f2405f
  type: sprint
  code: SPR-014
  sequence: 14
  lifecycle: active
  starts_on: 2026-08-24
  due_on: 2026-08-30
  started_at: 2026-08-24T08:30:00+04:00
  closed_at:
  provisional_story_outcomes: []
  start_snapshot:
    captured_at: 2026-08-24T08:30:00+04:00
    stories:
      - id: 019946f1-8d2a-7f05-87b1-1eebbb476300
        key: FF-42
        title: Use Focus on mobile
        epic_id: 019946c9-5f97-7196-8483-73469275ff90
        sprint_rank: a0
        acceptance_criteria_hash: sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
        acceptance_criteria:
          - text: The Focus Board opens on mobile
            checked: false
        effective_tags: [product/focus-flow]
        tasks: []
  close_snapshot:
```

`lifecycle` is `draft`, `active`, or `closed`. Only one note may be Draft or Active.
Cancelling a Draft returns its Stories to the Month Backlog using their retained
`backlog_rank`, removes `sprint_id`/`sprint_rank`, and trashes `DRAFT.md`; it
does not create bookkeeping events. Starting uses the configured week
containing the current local date, from `firstWeekday` through six days later.
The Sprint stays Active until explicit closure and is displayed as overdue
after `due_on`. A late start retains this boundary and may therefore create a
short first Sprint after a break; the start review exposes the remaining days.

The sequence counts Sprints that actually started; elapsed weeks without a
Sprint do not reserve codes. A start is invalid if another Sprint already has
the same `starts_on` date, even when that earlier Sprint is Closed. A new Draft
may still be prepared after that Close, but Start remains unavailable until the
next unused Sprint Window.

The start limit counts only active, non-Done Tasks beneath selected Stories.
Prior Done Tasks remain in the frozen and live Story context with
`completed_before_sprint: true`, but do not consume Sprint Scope. A soft limit
requires explicit confirmation; a hard limit blocks start.

### Start Snapshot

The Start Snapshot stores frozen values required to interpret the commitment even after notes change:

```yaml
start_snapshot:
  captured_at: 2026-08-24T08:30:00+04:00
  stories:
    - id: 019946f1-8d2a-7f05-87b1-1eebbb476300
      key: FF-42
      title: Use Focus on mobile
      epic_id: 019946c9-5f97-7196-8483-73469275ff90
      sprint_rank: a0
      acceptance_criteria_hash: sha256:...
      acceptance_criteria:
        - text: The Focus Board opens on mobile
          checked: false
      effective_tags:
        - product/focus-flow
      tasks:
        - id: 01994706-857c-76f1-8006-85cd9bd80890
          key: FF-43
          title: Build the mobile status pager
          task_rank: a0
          status: todo
          completed_before_sprint: false
          effective_tags:
            - product/focus-flow
```

Full Acceptance Criteria text is stored; the hash supports deterministic comparison and is not a substitute for the snapshot.

### Sprint Delta

Sprint closure compares the Start Snapshot with the live closing boundary. The
derived value contains `added_stories`, `removed_stories`, `added_tasks`,
`removed_tasks`, and `changed_acceptance_criteria_stories`. Each entry freezes
its ID, key, and title; Story entries also include ordered Acceptance Criteria.
Text or order changes count, while checkbox-only changes do not.

The recoverable `pending_close` plan stores this delta while close mutations
are in progress. The completed report renders non-empty categories and omits
the entire Sprint Delta section when nothing changed. There is no mid-Sprint
journal, reason, acknowledgement, or Task-removal membership event.

Every Task beneath an Active Sprint Story belongs to Sprint Scope except a Task
already Done at start. Creation applies the configured Sprint Scope WIP policy;
later completion does not release scope.

### Provisional Story outcomes

An evaluation recorded during an Active Sprint is mutable current Sprint state, not a historical event stream:

```yaml
provisional_story_outcomes:
  - story_id: 019946f1-8d2a-7f05-87b1-1eebbb476300
    evaluated_at: 2026-08-29T18:10:00+04:00
    outcome: achieved # achieved | not_achieved | closed
    evidence: Verified the complete flow on iOS and desktop
    acceptance_exception_reason:
```

Re-evaluation replaces the entry for that Story. Sprint closure copies the final value into the Close Snapshot before changing the Story lifecycle.

### Close Snapshot

The Close Snapshot contains:

- frozen Story and Task identity, title, parent, rank, Effective Tags, and final status;
- Story outcome and Acceptance Criteria state;
- Task resolution and continuation context;
- `started_at` and `completed_at` values;
- Story and Task counts at start and close, additions/removals, committed-open, completed-current-Sprint, and open-at-close counts;
- a frozen summary grouped by Effective Tags;
- Sprint Delta and exception facts.

It does not contain a status-transition timeline.

### Recoverable close marker

Before mutating work notes, closure writes `pending_close` with an operation UUID, a hash of the reviewed decisions, and the frozen per-entity decisions needed to resume idempotently. Its plan also contains the Closed Sprint destination. The marker remains while the report and Close Snapshot are written, the managed state becomes Closed, and the note moves to its dated archive path; it is removed only after all four results are durable. The exact planned state at either source or destination is resumable. A Sprint carrying `pending_close` is never projected as a completed Closed Sprint or Review History boundary.

Current Close plans include `workspace_entries` (full before/after path and
managed-block replacements), `reopen_recovery`, and `expected_sprint`. The last
field is the complete original Sprint managed block used to reject concurrent
changes before finalization.

Terminal transitions, renames, and explicit organization use the optional
non-entity `<root>/WORKSPACE-OPERATIONS.md`. Its `focus_flow` block has
`schema_version: 1`, `type: workspace_operation`, an `operation_id`,
`pending: true`, and `entries`. Each entry contains the note UUID and complete
`before`/`after` states with `path` and `managed` fields. Completion replaces
this block with just its schema, type, and `pending: false`; unrelated
frontmatter and the body remain user-owned. It is a recovery marker, not
History or an event log.

### Reopen recovery and marker

A Close that supports Sprint Reopen also persists `reopen_recovery` on the
Closed Sprint. It contains the Close operation ID, the pre-close provisional
outcomes, and one entry for every work note changed by Close, derived-link
repair, reclassification, or terminal archive placement:

```yaml
reopen_recovery:
  close_operation_id: 01994744-a401-759a-b582-4418f2f24060
  provisional_story_outcomes: []
  notes:
    - id: 019946f1-8d2a-7f05-87b1-1eebbb476300
      before_close:
        path: Focus Flow/Stories/FF-42 Use Focus on mobile.md
        focus_flow:
          schema_version: 1
          id: 019946f1-8d2a-7f05-87b1-1eebbb476300
          type: story
          lifecycle: active_sprint
          # remaining complete managed fields
      expected_after_close:
        path: Focus Flow/Stories/Archive/2026/09/FF-42 Use Focus on mobile.md
        focus_flow:
          schema_version: 1
          id: 019946f1-8d2a-7f05-87b1-1eebbb476300
          type: story
          lifecycle: done
          # remaining complete managed fields
```

The nested `focus_flow` values are complete managed blocks; user-owned tags,
frontmatter, and body are not captured. Reopen requires the Closed Sprint with
the highest sequence, no Draft or Active Sprint, no later Sprint, and an exact
path and managed-frontmatter match with every `expected_after_close`. It writes
a durable `pending_reopen` plan and restores each `before_close` state in
deterministic UUID order, accepting either the expected state or an
already-restored state while resuming. Because frontmatter replacement and
rename are separate host writes, resume also recognizes the exact planned
replacement block at its original path. All replacements, including derived
child links, precede moves. This recorded intermediate state does not permit
unrelated third states or overwriting destinations.

`pending_reopen` likewise remains until work restoration, generated-report
removal, Active managed state, and the move back to `Sprints/SPR-nnn.md` are all
durable. The exact planned archived or root state is resumable; an unrelated
state blocks continuation.

Successful Reopen restores the captured paths, managed blocks, and provisional
outcomes; moves the same Sprint note back to `Sprints/SPR-nnn.md`; marks it
Active; removes `closed_at`, `close_snapshot`, `reopen_recovery`,
`pending_reopen`, and the generated report; and preserves user-owned
Retrospective Items. History retracts that close boundary until the Sprint
closes again. A later Close derives a fresh archive bucket from its new
`closed_at`. Existing Closed Sprints without `reopen_recovery` remain valid
History but cannot be reopened.

`Organize terminal notes` includes Closed Sprint notes that remain directly
under `Sprints/` or occupy the wrong dated bucket. It previews and applies the
same canonical placement without changing lifecycle, `closed_at`, snapshots,
report, or retrospective body. Draft and Active Sprint notes inside `Archive/`
remain placement errors and use explicit repair back to `Sprints/`.

### Generated report and retrospective

The Sprint body separates generated and user-owned content with stable markers:

```markdown
<!-- focus-flow:report:start -->
## Sprint report

Generated summary, Story outcomes, Task outcomes, and Sprint Delta when non-empty.
<!-- focus-flow:report:end -->

## Wins

- A short observation

## Friction

## Improvements
```

Repair may replace only the report marker range. Retrospective headings and list
items are user-owned; the exact `Wins`, `Friction`, and `Improvements` headings
identify their categories. Duplicate category headings make the Sprint note
invalid; a missing category simply contributes no Retrospective Items.

## Mission and templates

`MISSION.md` is one dedicated ordinary Markdown note, not a keyed work entity.
Missing or empty Mission content produces a soft diagnostic only. It is
created manually or by the future skill rather than from a configurable vault
template.

Standard Candidate, Epic, Story, Task, and Retrospective body templates live
under `Templates/`. They contain user-owned Markdown and never managed
frontmatter. Candidate uses Description, Entry Review, and Acceptance Criteria;
Epic uses Intent and Acceptance Criteria; Story and Task use Description and
Acceptance Criteria. The Retrospective fragment uses canonical Wins, Friction,
and Improvements sections. Candidate reclassification preserves the existing
body instead of merging a new template into it.

Plugin workflows configure and read only Candidate, Task, and Retrospective
template paths. Candidate and Task rendering supports these deterministic
substitutions:

- `{{title}}`
- `{{key}}`
- `{{date}}`
- `{{parent_link}}`

Tokens match exactly; whitespace variants and unknown tokens remain literal.
`date` is a local `YYYY-MM-DD`. Standard templates use only `title`, but custom
Candidate and Task templates may use all four substitutions.

The Retrospective template is inserted as a Markdown fragment without variable
substitution. The Sprint report is deterministic managed output, not a
template. Each Retrospective category heading must appear exactly once in a
configured template; an invalid or missing fragment falls back to the
deterministic built-in and produces a warning. This mechanism is compatible
with ordinary Markdown template files but does not depend on the Obsidian
Templates core plugin or its internal API.

## Review History projection

Review History derives Month, Quarter, and Year groups from each Closed Sprint's
sequence. Current groups may be partial. Done/Closed Epic timestamps after one
Sprint closes belong to the next close boundary and remain visible as evidence
since the last Sprint until then. Period summaries derive Epic finalizations,
Story Outcomes, and completed Task counts by frozen Effective Tags; they never
write cycle identifiers or archive copies back to work notes. Terminal archive
paths are navigation only and never determine these groups.

## Validation and migrations

Every managed object carries `schema_version`. Readers parse frontmatter from `unknown` into a discriminated domain result:

- valid entity;
- valid entity with non-blocking diagnostics;
- invalid managed data with repair actions;
- unsupported future schema, read-only until the plugin is upgraded.

An incompatible migration is an explicit, idempotent, version-by-version batch.
The plugin previews the affected count, asks for confirmation, and keeps
incompatible notes read-only until the forward-resumable operation completes.
It operates only on managed fields through Obsidian APIs; plugin load and
ordinary note writes never migrate silently or lazily.
