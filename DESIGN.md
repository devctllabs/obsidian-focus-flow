---
name: Focus Flow
description: A compact Obsidian workspace for deliberate weekly planning, daily focus, and reflective review.
colors:
  primary: "#5b5bd6"
  primary-hover: "#4646bc"
  neutral-bg: "#ffffff"
  neutral-surface: "#ffffff"
  neutral-subtle: "#f5f6f8"
  neutral-hover: "#e9ebf1"
  neutral-border: "#d9dde5"
  neutral-border-hover: "#c4cad5"
  neutral-border-focus: "#aeb5c1"
  text: "#1d2939"
  muted-text: "#475467"
  quiet-text: "#5b6574"
  text-on-accent: "#ffffff"
  danger: "#b42318"
  warning: "#b54708"
  success: "#087443"
typography:
  body:
    fontFamily: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  headline:
    fontFamily: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "1.75rem"
    fontWeight: 650
    lineHeight: 1.12
    letterSpacing: "-0.03em"
  title:
    fontFamily: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "1rem"
    fontWeight: 580
    lineHeight: 1.25
  label:
    fontFamily: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "0.8rem"
    fontWeight: 600
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, monospace"
    fontSize: "0.72rem"
    fontWeight: 500
rounded:
  sm: "7px"
  md: "8px"
  lg: "0.9rem"
  pill: "999px"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
  xl: "1.5rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.text-on-accent}"
    rounded: "{rounded.sm}"
    padding: "0.3rem 0.75rem"
    height: "2rem"
  button-default:
    backgroundColor: "{colors.neutral-subtle}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: "0.3rem 0.75rem"
    height: "2rem"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.muted-text}"
    rounded: "0.4rem"
    padding: "0.3rem 0.75rem"
    height: "2rem"
  text-field:
    backgroundColor: "{colors.neutral-surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: "0.3rem 0.6rem"
    height: "2rem"
  nav-tab:
    backgroundColor: "transparent"
    textColor: "{colors.muted-text}"
    rounded: "{rounded.sm}"
    padding: "0.45rem 0.7rem"
  tag-chip:
    backgroundColor: "theme-aware mix of the exact tag base color and surface; {colors.neutral-hover} fallback"
    textColor: "{colors.text}"
    rounded: "{rounded.pill}"
    padding: "0.32rem 0.5rem"
  dialog:
    backgroundColor: "{colors.neutral-bg}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: "1.35rem"
  task-card:
    backgroundColor: "{colors.neutral-surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: "0.65rem 0.4rem"
---

# Design System: Focus Flow

## Overview

**Creative North Star: "The Deliberate Writing Workspace"**

Focus Flow is a writing-app workspace for deliberate work. Titles and next actions lead; forms unfold only when the decision needs them. The host interface font keeps the plugin native to Obsidian, while compact controls, flat rows, quiet dividers, and a restrained accent keep attention on the user's Markdown-backed work.

The system is intentionally theme-aware rather than a frozen brand palette. The accent follows Obsidian by default; a person may instead choose Focus Flow's Indigo or one custom hue. Light defaults provide the documented fallback, while dark and community themes keep the same readable role boundaries. Responsive views preserve the same information order: Focus groups Tasks in Story swimlanes, Plan stacks its Sprint, Month shortlist, and Epic backlog queues, and History progressively discloses evidence and reflection. Portalled menus and dialogs re-enter the same `.focus-flow` boundary so host-theme isolation survives overlays.

**Key Characteristics:**

- Compact 14px interface density with a host-driven sans-serif stack.
- Rounded 7–8px controls, flat working rows, and quiet divider hierarchy.
- One restrained accent for selection, focus, and primary action.
- Progressive disclosure through row details, menus, pickers, and dialogs.
- A 160ms unfold motion with a reduced-motion path.
- Canonical Markdown fields and separate multiline checkbox criteria in work forms.

## Colors

The light fallback uses a cool white workspace with slate text and soft neutral layering. The default accent maps Obsidian's accent roles; Indigo (`#5b5bd6` light, `#9898ff` dark) remains an explicit Focus Flow preset. A custom `#RRGGBB` seed is adapted into separate text, solid, hover, focus, and on-solid roles for both light and dark surfaces. Semantic danger, warning, and success colors support feedback and report meaning; they do not become decorative brand colors. Exact Workspace Tag Catalog colors may provide decorative chip, filter, and chart marks while readable text remains host-driven.

### Primary

- **Restrained Indigo** (`#5b5bd6`): Primary actions, active navigation, selected filters, focus indicators, and report emphasis.
- **Deep Indigo** (`#4646bc`): Hover state for primary actions.

### Neutral

- **White Workspace** (`#ffffff`): Root background and dialog surface in the light fallback.
- **Cool Mist** (`#f5f6f8`): Alternate background for kanban columns, reports, and quiet settings rows.
- **Soft Hover** (`#e9ebf1`): Hover background for controls and rows.
- **Quiet Border** (`#d9dde5`): Inputs, task cards, chart tracks, and low-contrast dividers.
- **Raised Border** (`#c4cad5`): Hover border and stronger chart contrast.
- **Focus Border** (`#aeb5c1`): Input focus border before the accent outline.
- **Slate Ink** (`#1d2939`): Primary text and headings.
- **Muted Slate** (`#475467`): Supporting copy, labels, metadata, and inactive controls.
- **Quiet Slate** (`#5b6574`): Keys, small context labels, and low-priority metadata.
- **White on Accent** (`#ffffff`): Light-theme text on the primary action.

### Semantic

- **Danger Red** (`#b42318`): Destructive actions and error feedback.
- **Warning Amber** (`#b54708`): Mission or policy attention and friction signals.
- **Success Green** (`#087443`): Achieved outcomes and wins.

### Named Rules

**The One Accent Rule.** Use the accent for selection, focus, and an intentional action; let neutral layering carry most of the screen.

**The Host Theme Rule.** Follow Obsidian's accent by default. Preserve distinct `--ff-accent-text`, `--ff-accent-solid`, `--ff-accent-solid-hover`, `--ff-accent-focus`, and `--ff-text-on-accent` roles so host, Indigo, and custom sources can change without changing component semantics.

**The Tag Color Rule.** Treat a configured `#RRGGBB` value as one decorative base color, not as a foreground/background pair. Mix it with host surfaces, retain host text colors, and preserve labels, shapes, and control state so color is never the only signal.

## Typography

**Display Font:** None; the interface uses the host interface stack (`ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`).

**Body Font:** The same host interface stack.

**Label/Mono Font:** Keys, compact counts, and diagnostic paths use `ui-monospace, SFMono-Regular, monospace`.

**Character:** Quiet, native, and information-first. There is no display masthead or editorial type treatment; hierarchy comes from size, weight, line-height, and space.

### Hierarchy

- **Headline** (650, `1.75rem`, `1.12`, `-0.03em`): Page and Sprint headings.
- **Title** (580, `1rem`, `1.25`): Work titles and row identities; titles wrap when the panel narrows.
- **Body** (400, `14px`, `1.5`): Everyday copy and controls.
- **Label** (600, `0.8rem`): Section labels, status controls, and supporting UI text.
- **Mono** (500, `0.72rem`): Human keys, numeric counts, and technical paths where tabular alignment helps.

### Named Rules

**The Native Voice Rule.** Keep hierarchy in the host interface family; do not introduce a separate display face for a page heading.

## Layout

The root workspace is centered at a maximum width of `70rem`, padded by `1.5rem` on wider panels and `1rem` at the compact breakpoint. The header and page headings use a shared quiet bottom rule and a modest `1rem`–`1.75rem` separation. Common gaps use the `0.25rem` to `1.5rem` rhythm, with `0.75rem` and `1rem` doing most of the work.

Focus is a horizontally scrollable kanban: status columns use a minimum width of `14rem` and a `0.75rem` gap, while Story swimlanes keep each Story heading with its Task cards. Narrow panels show a selected status column without losing Story grouping. Plan uses one vertical stack of Sprint, Month shortlist, and Epic backlog queues; Month selection is an explicit `+ Month` action on Stories and `Return to Epic` removes it. Each section presents its name, quiet numeric count, and trailing row actions. Persistent explanatory prose is not part of the Plan header; guidance appears only in contextual empty or blocked states. Inbox rows stay single-line in structure, showing a two-line context snippet and quiet date beneath the title while row actions remain in the menu. History uses one selected report with adjacent-period navigation, responsive visual blocks, explicit Tasks/Stories/Epics tag units, and horizontal completion bars on narrow panels. Close-step navigation wraps labels onto additional lines when needed; it does not depend on horizontal scrolling.

## Elevation & Depth

Working surfaces are flat by default. Depth comes from cool tonal layering (`background` versus `background-alt` and `surface`) and quiet dividers. Shadows are reserved for transient or stateful layers: menus, dialogs, and a dragged item. Buttons, inputs, planning rows, and report content do not carry resting shadows.

### Shadow Vocabulary

- **Drag lift** (`0 4px 14px rgb(0 0 0 / 14%)`): Temporary feedback while a work item is dragged.
- **Popover lift** (`0 8px 36px rgb(0 0 0 / 22%)`): Action menus and searchable pickers above the workspace.
- **Dialog lift** (`0 24px 80px color-mix(in srgb, black 30%, transparent)`): Focused dialogs over the modal backdrop.

### Named Rules

**The Flat-at-Rest Rule.** Reserve elevation for an interaction layer or active drag; do not turn every work row into a floating card.

## Shapes

Controls use gently rounded corners: `7px` for buttons, fields, task cards, and compact rows, `8px` for larger surfaces, and a pill silhouette for tags and outcome badges. Dialogs use a softer `0.9rem` radius. Borders are generally one pixel and tonal; planning list rows often use a bottom divider with no enclosing border. Empty drop targets use a dashed outline, while focus remains a visible two-pixel accent outline with a two-pixel offset.

## Components

### Buttons

- **Shape:** Compact rounded controls (`7px`), at least `2rem` tall, with `0.3rem 0.75rem` padding.
- **Primary:** Accent background, white light-theme text, and a deep-indigo hover state; use for the committed action in a dialog or workflow.
- **Default:** Cool-mist background with a quiet border; use for ordinary actions.
- **Quiet:** Transparent, borderless, muted text; use for navigation, row actions, and secondary controls.
- **Hover / Focus:** Hover changes the neutral background or accent shade over `160ms`; `:focus-visible` uses a `2px` accent outline with `2px` offset.

### Chips

- **Style:** Tags are pill-shaped (`999px`) and compact. An exact Cataloged Tag color supplies a theme-aware soft fill/border; an absent or invalid color stays neutral. Selected tags and removable active filters retain an additional state treatment.
- **State:** Keep selected state visible through both accent color and a changed background; counts stay small and tabular.

### Cards / Containers

- **Work rows:** Compact, mostly flat rows separated by quiet dividers. Work titles lead and menus align to the trailing edge.
- **Task cards:** White/surface cards with a quiet border and `7px` radius inside the Focus kanban; hover adds tonal contrast, not a shadow.
- **Reports:** A cool-mist report container (`10px` radius) holds the outcome ring, ranked tag bars, completion rhythm, evidence, and reflection blocks.
- **Internal padding:** Use `0.5rem`–`1rem` for rows and controls, `1.5rem` for a report or broad section when space permits.

### Inputs / Fields

- **Style:** Surface background, one-pixel border, `7px` radius, `2rem` minimum height, and `0.3rem 0.6rem` padding; no inset shadow.
- **Focus:** Focus border plus a two-pixel focus halo and visible accent outline.
- **Multiline Markdown:** Description, Entry Review, Intent, and other body fields use vertically resizable textareas (`6rem` minimum); Acceptance Criteria use separate checkbox rows with `3.5rem`-minimum multiline editors and a quiet Add criterion action.
- **Progressive use:** Capture, Candidate review, Task creation, WIP policy, templates, and vault browsing unfold in a focused row, picker, or dialog rather than occupying permanent form space.

### Navigation

The four primary destinations—Focus, Plan, Inbox, and History—are compact inline tabs (`0.85rem`, `550` weight). The active page receives the accent-soft background and accent text. Capture and Settings remain quiet icon actions. Review/close uses five icon-led step buttons (`Overview`, `Outcomes`, `Tasks`, `Retrospective`, `Review`) that wrap as a flex row on narrow panels so every label remains visible.

### Focus Board

Focus is the signature surface: shared status columns, horizontal Story swimlanes, and Task cards grouped beneath their Story. The Story filter is a quiet searchable trigger with one-click clear. Task movement is available by drag and by menu, and an icon-only create action opens a focused Task dialog with its Story already selected.

### Planning Queues

Plan is a vertically stacked Sprint/Month/Epic model, not a two-pane tabbed board. Rows stay compact and folded; expansion reveals Tasks or Story locations. Month is a curated shortlist: Stories remain in their Epic until an explicit `+ Month` action selects them, and `Return to Epic` removes the selection. Draft creation and Active Sprint membership are explicit actions, with one confirmation dialog for membership changes and row actions kept at the right edge. Active Sprint timing surfaces elapsed days from its actual start; Start always exposes the planned calendar window and highlights a shortened late start. A Draft prepared after an early Close keeps Start visibly disabled with the next available date.

### History Reports

History shows one visual report at a time: a compact outcome ring, ranked Effective Tag bars, completion rhythm, and progressively disclosed evidence and reflection. The tag chart switches between Tasks, Stories, and Epics with units that match the selected level; frozen effective tags and current Epic tags are labeled as distinct attribution. Tag marks read the live Workspace palette, so changing a color also changes old reports without changing their data. The latest eligible Closed Sprint exposes Reopen; unavailable legacy or older Sprints explain why without presenting a destructive control. Sprint opening and correction use its current indexed path, so dated archive placement is invisible to History. On narrow panels, the completion chart becomes readable horizontal bars. Filters are a single searchable Epic/tag surface with removable chips.

### Settings & Vault Pickers

Settings is value-first: workspace location, weekday buttons, and WIP policies remain readable in compact rows, while policy editors and vault-scoped folder/file pickers open only when requested. Folder move confirmation lives inside the picker; switching to an existing root remains a distinct operation.

Accent editing reuses the Tag color pattern: the collapsed row shows a color marker plus `Obsidian`, `Indigo`, or the selected HEX value. The expanded row starts with `Obsidian`, then Indigo, Blue, Teal, Green, Amber, and Rose swatches, followed by `Custom HEX` and `Save color`. Presets save immediately; invalid custom values cannot be submitted.

Tag Catalog editing must be reachable through plugin UI and show each exact entry with its optional description, base color, and neutral fallback. Its detailed control layout is deferred; the UI must not imply prefix inheritance or store catalog metadata outside the Workspace document.

Terminal-note organization keeps one preview/resume surface for Done/Closed
work and Closed Sprints. It does not expose Review Cycle folders or rewrite
arbitrary user-authored Sprint links.

First-use Setup combines the workspace folder and expandable template selection with a creation/adoption preview. Existing template files are explicitly marked for reuse. Its Storybook content is framed as a compact native modal, with one aligned title/content measure and a 560px maximum width.

### Reflection and corrections

Retrospective categories hold compact text cards. Each column opens one vertically resizable, two-row editor on demand; saving returns it to a card. Item menus expose edit and removal. Story Outcomes offer a separately labeled optional Reflection. An early Close adds one final boundary confirmation; Reopen remains a separate correction action and never silently cancels a Draft. Plan keeps unavailable Sprint selection compact: a disabled transfer button plus an information icon reveals a nonmodal explanation and direct Story-editor action on hover or activation. Epic selection uses a searchable keyboard-accessible picker containing active Epics only. Delete previews include Inbox Candidates, show child/history blockers, and require acknowledgement for content. Refresh is a named circular-arrow icon in the workspace header, with pending feedback and reduced-motion support.

Plugin buttons explicitly use content-driven height to avoid Obsidian's global fixed input height. Storybook includes that host rule in its curated fixture; geometry assertions cover multiline Focus cards, Review overview rows, and Story selectors so isolated previews do not conceal native-host overflow.

### Inbox & Candidate Review

Inbox is a quiet capture list: one icon-only create action, typed title/tag capture, compact title-led rows, two-line description or rejection context, and a quiet date. Candidate edit and Distraction recovery/trash actions live in row menus. Review maps the candidate's fields to the selected Epic or Story fields in a focused dialog, keeps Entry Review and unrelated Markdown, and uses the same tag and criteria editors as other work forms.

## Do's and Don'ts

### Do:

- **Do** use the host-driven `--ff-*` roles and preserve readable light, dark, and community theme fallbacks.
- **Do** keep titles and next actions primary, with context folded into rows, menus, details, and dialogs.
- **Do** use quiet dividers, flat surfaces, and the restrained accent to show action, focus, and selection.
- **Do** preserve Story grouping and menu/keyboard equivalents as panels narrow.
- **Do** keep portalled menus and dialogs inside the same isolated token boundary.
- **Do** honor the `160ms ease-out` reveal and disable it under `prefers-reduced-motion`.

### Don't:

- **Don't** add display mastheads, separate system display faces, or loud all-caps kickers to ordinary workspace pages.
- **Don't** use persistent explanatory paragraphs in Plan section headers; reserve copy for contextual empty or blocked states.
- **Don't** turn the flat workspace into a card wall or add resting shadows to buttons, inputs, or work rows.
- **Don't** freeze a community theme's font or palette as Focus Flow's global brand identity.
- **Don't** replace the compact searchable Story/tag pickers with wide native dropdowns or hide state behind color alone; tag suggestions overlay the form and must not change its height.
- **Don't** make close-step labels depend on a horizontal scroller at narrow widths; let the five named steps wrap.
- **Don't** invent approval scores, quality bars, or other decorative metrics that are not part of the frozen History evidence.
