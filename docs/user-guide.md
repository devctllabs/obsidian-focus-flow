# Focus Flow user guide

Focus Flow helps you turn long-term direction into weekly outcomes and concrete
daily actions. It stores its durable state in ordinary Markdown notes inside
your Obsidian vault.

If the terms Candidate, Epic, Story, and Task are new to you, read
[How Focus Flow works](./framework.md) first.

## Install Focus Flow

### Install with BRAT

1. Install and enable **BRAT** from Obsidian's Community plugins.
2. Open the command palette and run **BRAT: Add a beta plugin for testing**.
3. Enter `https://github.com/devctllabs/obsidian-focus-flow`.
4. After BRAT installs the plugin, open **Settings → Community plugins** and
   enable **Focus Flow**.

Use BRAT to check for later Focus Flow releases.

### Install manually

1. Download `main.js`, `manifest.json`, and `styles.css` from the same Focus Flow
   release.
2. Create `<vault>/.obsidian/plugins/focus-flow/` and place all three files in it.
3. Reload Obsidian, then enable **Focus Flow** under
   **Settings → Community plugins**.

Before a manual update, let your vault finish syncing and make a normal backup.
Replace all three plugin files together, then reload Obsidian.

## Set up your Workspace

Open Focus Flow from the left ribbon, run **Open Focus**, **Open Plan**,
**Open Inbox**, or **Open History**, or capture your first Candidate. If Focus
Flow has not been set up yet, it opens setup automatically.

1. Choose a Workspace folder. The default is `Focus Flow`.
2. Create a new Workspace or select an existing Focus Flow folder.
3. Optionally choose different Candidate, Task, and Retrospective templates.
4. Select **Review setup** and inspect the folders, templates, and warnings.
5. Select **Create workspace** or **Use this workspace**.

Setup creates only missing folders and standard templates. It keeps existing
files. You can optionally create `<workspace>/MISSION.md`; a missing Mission
never blocks capture, planning, or work.

After setup, open the gear menu to choose **Week starts on** and configure any
**Work in progress** limits. **Ask first** lets you override a limit explicitly,
while **Enforce** blocks work above it.

## Know the four pages

| Page | Use it to |
| --- | --- |
| **Inbox** | Capture Candidates and decide whether they become Epics, Stories, or Distractions. |
| **Plan** | Prioritize Epics and Stories, prepare a Draft Sprint, and create Tasks. |
| **Focus** | Move the Active Sprint's Tasks through their current states. |
| **History** | Review Closed Sprints, outcomes, and retrospective learning. |

Use the top navigation to switch pages without leaving the Focus Flow leaf.
The `+` action captures a Candidate, and the gear opens Settings. The command
palette also provides **Open Focus**, **Open Plan**, **Open Inbox**,
**Open History**, **Capture candidate**, and **Refresh notes**.

## Complete your first Sprint

This walkthrough uses a learning goal. The Epic is a long-lived direction, the
Story is one observable weekly result, and the Tasks are the actions needed to
produce it.

### 1. Create the Epic

1. Select the `+` action or run **Capture candidate**.
2. Use the title `Build a practical understanding of cognitive psychology`.
3. Add any useful context under Description or Entry Review, then select
   **Create Candidate**.
4. In Inbox, open the Candidate's menu and choose **Accept as Epic**.
5. Review its Intent and Acceptance Criteria, then create the Epic.

The Epic now appears in the **Epic backlog** in Plan. Its position expresses
relative priority, not a promised date.

### 2. Define a weekly outcome

Capture another Candidate with this title:

> Summarize five cognitive-bias ideas from a book with personal examples

Choose **Accept as Story**, select the psychology Epic as its parent, and add
Acceptance Criteria such as:

- five biases are explained in your own words;
- every bias has one personal example;
- the final summary links to the reading notes.

This is a Story because it describes a result you can evaluate. “Read a book”
only describes activity, so chapter reading belongs in Tasks.

The accepted Story starts under its Epic. In Plan, expand the Epic and select
**+ Month** to add the Story to the **Month backlog**. Month is a rolling
priority shortlist, not a calendar promise.

### 3. Add concrete Tasks

Expand the Story in Plan and use its `+` action to create Tasks such as:

- read one selected chapter and capture notes;
- read the next selected chapter and capture notes;
- extract five useful ideas;
- write one personal example for each idea;
- assemble and edit the final summary.

Each Task should be one concrete action that fits within a day or less. Tasks
always belong to one Story.

### 4. Prepare and start the Sprint

1. In Plan, select **Create Draft Sprint**.
2. Select **+ Sprint** on the Story in the Month backlog.
3. Reorder the Draft if needed.
4. Review the calendar window and open scope, then select **Start Sprint**.

A Story needs at least one Acceptance Criterion before it can enter a Sprint.
If the action is disabled, use the adjacent explanation and **Add criteria**.
A late start keeps the same calendar-aligned due date and shows the remaining
days.

### 5. Work from Focus

Open Focus and move each Task as its real state changes:

```text
TODO → Tomorrow → Today → In Progress → Done
```

**Tomorrow** and **Today** are deliberate selections, not due dates. Use
**External In Progress** when work is proceeding outside your direct control,
and **On Hold** when you intentionally pause it.

On desktop, drag cards or use their Move menu. On mobile and narrow panels, use
the Move menu and select one Task column at a time. Both paths apply the same
transition and WIP rules.

### 6. Review and close the Sprint

An Active Sprint remains open until you close it, even after its due date. In
Focus, select **Review Sprint** and complete the five steps:

1. **Overview** shows the remaining decisions.
2. **Outcomes** marks each Story Attempt as Achieved, Not Achieved, or Closed.
   Reflection is optional. Achieved with unchecked Acceptance Criteria requires
   an explicit exception.
3. **Tasks** resolves every unfinished Task: continue it with the same Story,
   move it to another Story, reclassify it as a Story, or close it as irrelevant.
4. **Retrospective** optionally records Wins, Friction, and Improvements.
5. **Review** summarizes the decisions and enables **Close Sprint**.

Nothing carries over silently. Closing records the outcome and opens History.

### 7. Learn from History

History opens the latest Sprint report. Review its Story Outcomes, completed
Tasks, Sprint Delta, and retrospective notes. You can also:

- switch between Sprint, Month, Quarter, and Year reports;
- browse by Sprint code or Story title;
- filter whole Sprints by Epic, tag, or close date;
- turn an Improvement into a new Candidate;
- reopen only the latest eligible Closed Sprint before another Sprint starts.

Review periods contain 4, 12, or 48 Closed Sprints. They are learning cadences,
not calendar-month or calendar-year containers.

## Everyday choices

### Candidates and Distractions

Capture first; decide later. A Candidate can become an Epic or Story. Choose
**Reject** to retain it as a Distraction, or **Delete…** only when it was an
accidental capture. A Distraction can be reconsidered and returned to Inbox.

### Planning

Plan owns Story membership. **+ Month** shortlists a Story; **Return to Epic**
removes it from Month without deleting it. **+ Sprint** moves it into the Draft
or Active Sprint. Adding or removing Active Sprint work requires confirmation
and appears in the Sprint Delta.

### Tags

Tags on an Epic are inherited by its Stories and Tasks. Settings → **Tags**
maintains the optional Workspace Tag Catalog in `TAGS.md`, including tag
descriptions and colors. Tags added directly to current work remain valid; the
Attention center can offer to add an uncataloged tag.

### Markdown and archives

Focus Flow notes remain ordinary, canonical Markdown. Open an item's title to
read or edit its note in Obsidian. Avoid changing the managed `focus_flow`
frontmatter while a Focus Flow operation is running.

Done and Closed work moves into dated archive folders under its type. Closed
Sprints move under `Sprints/Archive/YYYY/MM/`. These are the original notes,
not copies, and History does not depend on their paths.

## Settings and maintenance

- **Workspace folder** changes or reconnects the Workspace through a guarded
  preview. Focus Flow never merges or overwrites a conflicting destination.
- **Accent color** follows Obsidian by default. Choose Indigo or another preset,
  or enter a custom `#RRGGBB` value and select **Save color**. Focus Flow adapts
  custom colors for both light and dark themes.
- **Week starts on** controls the calendar-aligned Sprint Window.
- **Work in progress** sets optional limits for Sprint scope, Tomorrow, Today,
  and In Progress.
- **Templates** selects Candidate, Task, and Retrospective body templates.
- **Tags** edits the Workspace Tag Catalog.
- **Terminal notes → Review…** previews organization of existing terminal notes
  before moving anything.

## Troubleshooting

1. Select **Refresh notes** after manual or external Markdown changes.
2. Open the **Attention center** and follow the repair offered for the affected
   note. Repairs show what they will change and preserve unrelated content.
3. Let vault sync or external file operations finish, then reload Obsidian if a
   read problem remains.
4. If Focus Flow reports an interrupted operation, return to the relevant
   review or Settings surface, inspect it, and select **Resume operation**.

Do not try to create a second operation or manually remove recovery data while
one is pending. Use Obsidian File Recovery, git, or another vault backup for
older changes that cannot be repaired safely.

## Uninstall

Disable and remove the plugin. Focus Flow does not delete the Workspace or its
Markdown notes. They remain available to edit, archive, or remove like any
other vault content.

## Further reference

- [How Focus Flow works](./framework.md)
- [Domain language](../CONTEXT.md)
- [Markdown data model](./data-model.md)
- [Product specification](./product-spec.md)
