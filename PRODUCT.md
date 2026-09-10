# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Focus Flow is for one person who already uses Obsidian to manage personal knowledge and work. The primary user wants a deliberate weekly rhythm that connects long-term direction to outcomes and concrete daily actions without giving up direct ownership of their notes.

## Product Purpose

Focus Flow is a personal work-management system for deciding what deserves attention and carrying that decision from Mission through Epic and Story outcomes to Tasks. It combines Candidate review, ordered planning backlogs, explicit weekly Sprint commitment, a daily Focus Board, Sprint closure, and human-readable history.

Success means the user can choose work that serves their Mission, commit to observable weekly outcomes, limit current work, act from a clear daily view, and learn from completed Sprints without estimates, velocity, or automatic scheduling.

## Positioning

Focus Flow is an Obsidian-native, Markdown-backed personal operating workflow that connects Mission to weekly outcomes and today's actions. Unlike a generic task list or Kanban board, it combines reflective entry decisions, the Epic → Story → Task hierarchy, explicit weekly commitment and closure, and user-owned Markdown as one coherent practice.

## Operating Context

The product runs inside an Obsidian vault on desktop and mobile. The user can edit ordinary Markdown directly, use Obsidian links and tags, plan a Sprint each week, work from the Focus Board during the day, and explicitly close the Sprint with outcomes, Task resolutions, and retrospective observations. Vault synchronization may replicate one person's notes across devices, but conflict handling remains external to Focus Flow.

The plugin exposes Focus, Plan, Inbox, Distractions, and History modes in one Obsidian ItemView. A separate deterministic CLI supports limited authoring and consistency checks outside the plugin.

## Capabilities and Constraints

- Markdown beneath the configured vault root is the canonical source of truth; runtime indexes are rebuildable projections.
- The product is permanently personal and single-operator. It does not model teams, assignees, shared ownership, permissions, or real-time collaboration.
- The Obsidian plugin is local-only and mobile-compatible, with no account, server, network client, telemetry, advertising, secret storage, or AI runtime.
- Candidates become Epics, Stories, or retained Distractions through explicit Entry Review. Stories describe weekly-scale outcomes; Tasks describe concrete actions that fit within a day or less.
- Backlogs express relative priority rather than promised dates. Sprint commitment and closure are explicit, and unfinished work never carries over automatically.
- Sprint commitments use fixed calendar windows. Finishing initial scope early adds work to the same Active Sprint; the latest Closed Sprint may be corrected only through a guarded Reopen before another Sprint starts.
- The Workspace Tag Catalog keeps recommended exact tags, optional descriptions, and portable colors in Markdown without making uncataloged native tags invalid.
- Done and Closed work remains canonical and indexed while calendar-bucketed beneath its stable typed folder for ordinary vault navigation. The accepted target applies the same close-month placement to Closed Sprint notes without making paths authoritative for Review History.
- WIP policies can be off, advisory, or blocking. Reflective guidance such as Mission alignment remains advisory rather than a structural permission gate.
- V1 excludes estimates, velocity, time tracking, calendars, reminders, recurring Tasks, automatic prioritization, third-party task importers, and review ceremonies beyond cadence-based history summaries.
- The V1 interface is English-only. Desktop and mobile are both first-class, while pointer and keyboard drag-and-drop remain desktop-only and every movement also has a menu alternative.
- User-owned Markdown, unmanaged frontmatter, note bodies, and native tags must be preserved across managed mutations and repairs.

## Brand Commitments

The product name is **Focus Flow**. No durable visual style, palette, typography, or tone-of-voice commitment has been confirmed in this product record; the incumbent implementation remains the visual authority until it is documented or explicitly redesigned.

## Evidence on Hand

- `README.md`, `docs/product-spec.md`, and `docs/user-guide.md` describe the product promise, workflows, scope, and current implementation status.
- `CONTEXT.md` defines the canonical domain language, and accepted decisions under `docs/adr/` protect Markdown ownership, the personal single-operator model, the local-only plugin boundary, and host-agnostic core contracts.
- `docs/images/focus-board-desktop.png`, `docs/images/mobile-long-text.png`, and `docs/images/history-dark.png` show implemented desktop, mobile, and dark-theme surfaces.
- Unit, component, Storybook, performance, and real-Obsidian end-to-end tests provide implementation evidence for the delivered behavior.

There are no confirmed customer testimonials, adoption figures, comparative benchmarks, press claims, or other market proof. Future product and marketing work must not invent them.

The Tag Catalog, constrained Sprint Reopen, terminal work archive, and dated
Closed Sprint placement from ADR-0026 are implemented. Close and Reopen move the same canonical Sprint note
between its dated archive and the active root; History remains path-independent
and the organizer repairs misplaced Closed Sprints through the shared
preview/resume flow.

## Product Principles

1. **Direction before activity.** Work should be traceable from Mission to an intentional weekly outcome and a concrete action.
2. **Outcomes before task volume.** Stories express observable results; Tasks are supporting actions rather than the measure of success.
3. **Commitment stays explicit.** Priority, Sprint start, Story evaluation, Task resolution, and Sprint closure require conscious choices and never rely on silent carry-over.
4. **The user's Markdown remains sovereign.** Notes stay human-readable, directly editable, portable, and canonical; the plugin must preserve content it does not own.
5. **Reflection informs without coercing.** Entry Review, Mission alignment, retrospective learning, and WIP signals guide judgment without turning subjective practice into hidden automation.

## Accessibility & Inclusion

Every drag-and-drop action has a keyboard and menu equivalent. Focus, hover, validation, pending, empty, and error states must remain perceivable without color alone. Dialogs restore focus and support Escape. Long titles, narrow sidebars, high zoom, light and dark themes, community themes, pop-out windows, and mobile dimensions must remain usable. No specific conformance standard beyond these confirmed requirements is claimed.
