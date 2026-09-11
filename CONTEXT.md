# Focus Flow

Focus Flow is a personal work-management system that connects long-term direction to weekly outcomes and daily actions. This glossary defines its ubiquitous language independently of any user interface or storage technology.

## Direction and Entry

**Workspace**:
One coherent collection of a person's Mission, Candidates, work hierarchy, Sprints, and Review History.
_Avoid_: Vault, Project

**Mission**:
The personal direction used to reflect on whether work deserves attention.
_Avoid_: Goal, vision statement

**Candidate**:
An uncommitted idea, request, or intention awaiting a decision about whether and how it should enter Focus Flow.
_Avoid_: Ticket, backlog item, Task

**Distraction**:
A rejected Candidate retained as evidence of an influence, cost, or recurring pattern worth recognizing later.
_Avoid_: Trash, deleted Candidate

**Entry Review**:
The reflective WANT/SHOULD and Mission-alignment conversation recorded in the Candidate body and used to decide whether it becomes an Epic or Story.
_Avoid_: Validation, approval gate

## Work Hierarchy

**Epic**:
A long-lived direction that provides strategic context for Stories and remains active while there is a conscious intention to continue it.
_Avoid_: Project, annual goal

**Story**:
A weekly-scale, observable outcome belonging to exactly one Epic and evaluated against explicit Acceptance Criteria.
_Avoid_: Feature, large Task

**Story Attempt**:
One Story's participation in one Sprint, producing one Story Outcome without replacing the enduring Story.
_Avoid_: Story copy, retry Task

**Task**:
One concrete action belonging to exactly one Story and small enough to perform within a day or less.
_Avoid_: Subtask, standalone to-do

**Acceptance Criteria**:
Observable conditions that make the intended result of a work item explicit. They are evaluated structurally for Story Outcomes and Epic completion, while Candidate and Task criteria remain authoring guidance.
_Avoid_: Definition of Done, checklist of Tasks

**Acceptance Exception**:
An explicit reason why a Story is Achieved despite one or more unchecked Acceptance Criteria.
_Avoid_: A separate Story Outcome, silent waiver

**Effective Tags**:
The deduplicated union of a work item's own tags and tags inherited from its Epic and, for a Task, its Story.
_Avoid_: Copied tags, child tags

**Tag Catalog**:
The Workspace-curated set of exact tags recommended for work authoring. A catalog entry may explain the tag's meaning and choose its display color without changing Effective Tags or frozen work history.
_Avoid_: Exhaustive tag whitelist, Tag Palette

**Cataloged Tag**:
An exact native tag included in the Tag Catalog and therefore explicitly approved for automated reuse.
_Avoid_: Any observed tag, enforced tag

## Planning Horizons

**Epic Backlog**:
The single priority-ordered collection of accepted, active Epics. Its order expresses relative importance without promising a completion date.
_Avoid_: Year bucket, roadmap calendar

**Month Backlog**:
The single rolling, priority-ordered shortlist of accepted Stories explicitly selected from their Epics for upcoming Sprints. Other accepted Stories remain within their Epic until selected.
_Avoid_: Calendar month, monthly schedule

**Sprint**:
A calendar-aligned weekly commitment to selected Story Attempts and their Tasks. Sprint numbers count actual commitments, not elapsed or skipped weeks.
_Avoid_: Week folder, weekly backlog

**Draft Sprint**:
A reversible selection of Stories being prepared for the current Sprint window before commitment begins.
_Avoid_: Active Sprint, automatic carry-over

**Active Sprint**:
The one started commitment for a Sprint window. It remains Active until explicitly closed, including after its expected end.
_Avoid_: Current calendar week, automatically closed Sprint

**Closed Sprint**:
A finalized Sprint whose outcomes, resolutions, and learning have been recorded.
_Avoid_: Archived live board, deleted Sprint

**Sprint Window**:
The configured calendar week available for one Sprint commitment. Starting after its first day shortens the remaining commitment without moving the window.
_Avoid_: Rolling seven-day period, elapsed week

**Sprint Reopen**:
An explicit correction that retracts the latest Closed Sprint boundary and returns that same Sprint to Active before another Sprint begins.
_Avoid_: Second Sprint in the same window, historical edit

**Sprint Scope**:
All Tasks belonging to Stories in the Active Sprint, except Tasks already Done when the Sprint started. A Task added after start immediately belongs to Sprint Scope, and completing it does not release scope.
_Avoid_: Scope-change ledger, capacity estimate

**WIP Policy**:
A limit on selected current work whose enforcement is off, advisory, or blocking.
_Avoid_: Estimate, velocity target

**Review Cycle**:
A cadence marker derived from Closed Sprints: Month every four, Quarter every twelve, and Year every forty-eight.
_Avoid_: Backlog container, calendar period

**Review History**:
The evidence from Closed Sprints, Story Outcomes, finalized Epics, and frozen Effective Tags grouped by Review Cycle.
_Avoid_: Archive copy, calendar roadmap

**Terminal Archive**:
The organizational collection of canonical terminal notes: Done and Closed Epic, Story, and Task notes plus Closed Sprint notes, grouped by the month in which each became terminal. It remains part of the Workspace and does not define Review Cycles.
_Avoid_: Review History, Trash, archive copy

## Task Flow

**TODO**:
An open Task not yet selected for a nearer planning horizon or started.
_Avoid_: Unaccepted Candidate, Story Backlog

**Tomorrow**:
A Task manually selected for the user's next day of work.
_Avoid_: Due date, automatic daily schedule

**Today**:
A Task manually selected for the user's current day of work.
_Avoid_: Due date, automatic daily schedule

**In Progress**:
A Task currently being performed under the user's direct control.
_Avoid_: Selected work, externally progressing work

**External In Progress**:
A Task whose work is currently proceeding outside the user's direct control.
_Avoid_: On Hold, delegated ownership

**On Hold**:
A Task intentionally paused because it cannot or should not progress now.
_Avoid_: External In Progress, forgotten Task

**Done**:
A terminal Task whose intended action has been completed.
_Avoid_: Closed as irrelevant, completed Story

**Task Resolution**:
The explicit disposition of an unfinished Task during Sprint closure: continue, move, reclassify as a Story, or close as irrelevant.
_Avoid_: Task Status, automatic carry-over

## Flow and Learning

**Focus Board**:
The operational view of an Active Sprint, organized as Story swimlanes whose Task cards move through the workflow.
_Avoid_: Month Backlog, generic Kanban note

**Sprint Delta**:
The factual difference between a Sprint's Start Snapshot and its live Story, Task, and Acceptance Criteria boundary at closure. It records added or removed Stories and Tasks and changed Acceptance Criteria without asking for reasons or storing transition events.
_Avoid_: Scope Change, audit log, Task Status history

**Story Outcome**:
The explicit evaluation of a Story Attempt as Achieved, Not Achieved, or Closed. An Acceptance Exception qualifies Achieved rather than creating another outcome.
_Avoid_: Automatic completion, Task count

**Story Reflection**:
An optional note about one Story Attempt's outcome, capturing what is worth remembering without being a prerequisite for evaluation.
_Avoid_: Required evidence, Retrospective Item

**Start Snapshot**:
The immutable baseline of selected Stories, Acceptance Criteria, Tasks, and inherited context captured when a Sprint starts.
_Avoid_: Current board state, backup

**Close Snapshot**:
The immutable final account of Story Outcomes, Task Resolutions, Sprint Delta, and summary facts while a Sprint remains Closed. Sprint Reopen retracts the whole closure boundary rather than editing its snapshot.
_Avoid_: Generated report, current work state

**Retrospective Item**:
A short observation recorded as a Win, Friction, or Improvement during Sprint closure.
_Avoid_: Retrospective Ticket, Task, automatically committed action
