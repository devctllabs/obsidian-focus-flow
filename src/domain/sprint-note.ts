import { z } from 'zod';
import { sprintCode } from './cycle-code';
import { timestampSchema, uuidV7Schema } from './managed-schema';
import { findMarkdownHeadings, sectionEnd } from './markdown-sections';
import type { SprintClosePlan, SprintCloseSnapshot } from './sprint-close';
import type {
  AcceptanceCriterion,
  TaskStatus,
  WorkNoteDiagnostic,
  WorkNoteSource,
} from './work-note';

export type StoryOutcome = 'achieved' | 'not_achieved' | 'closed';

interface ProvisionalStoryOutcome {
  storyId: string;
  evaluatedAt: string;
  outcome: StoryOutcome;
  evidence: string;
  acceptanceExceptionReason: string | null;
}

interface SprintStartSnapshotTask {
  id: string;
  key: string;
  title: string;
  taskRank: string;
  status: TaskStatus;
  completedBeforeSprint: boolean;
  effectiveTags: readonly string[];
}

interface SprintStartSnapshotStory {
  id: string;
  key: string;
  title: string;
  epicId: string;
  sprintRank: string;
  acceptanceCriteriaHash: string;
  acceptanceCriteria: readonly AcceptanceCriterion[];
  effectiveTags: readonly string[];
  tasks: readonly SprintStartSnapshotTask[];
}

export interface SprintStartSnapshot {
  capturedAt: string;
  stories: readonly SprintStartSnapshotStory[];
}

interface SprintEntityBase {
  id: string;
  type: 'sprint';
}

interface DraftSprintEntity extends SprintEntityBase {
  lifecycle: 'draft';
}

interface StartedSprintEntity extends SprintEntityBase {
  code: string;
  sequence: number;
  startsOn: string;
  dueOn: string;
  startedAt: string;
  provisionalStoryOutcomes: readonly ProvisionalStoryOutcome[];
  startSnapshot: SprintStartSnapshot;
}

export interface ActiveSprintEntity extends StartedSprintEntity {
  lifecycle: 'active';
  closedAt: null;
  closeSnapshot: null;
  pendingClose?: SprintClosePlan | null;
}

export interface ClosedSprintEntity extends StartedSprintEntity {
  reopenRecovery?: ReopenRecovery | null;
  pendingReopen?: boolean;
  pendingClose?: SprintClosePlan | null;
  lifecycle: 'closed';
  closedAt: string;
  closeSnapshot: SprintCloseSnapshot;
  retrospectiveItems?: readonly RetrospectiveItem[];
}

export interface RetrospectiveItem {
  kind: 'win' | 'friction' | 'improvement';
  text: string;
}

export type SprintEntity =
  | DraftSprintEntity
  | ActiveSprintEntity
  | ClosedSprintEntity;

export type ParseSprintNoteResult =
  | { ok: true; entity: SprintEntity }
  | { ok: false; diagnostics: WorkNoteDiagnostic[] };

const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const workKey = z.string().regex(/^FF-[0-9]+$/);
const taskStatus = z.enum([
  'todo',
  'tomorrow',
  'today',
  'in_progress',
  'external_in_progress',
  'on_hold',
  'done',
]);

const acceptanceCriterion = z.object({
  text: z.string().trim().min(1),
  checked: z.boolean(),
});

const startSnapshotTask = z.object({
  id: uuidV7Schema,
  key: workKey,
  title: z.string().trim().min(1),
  task_rank: z.string().trim().min(1),
  status: taskStatus,
  completed_before_sprint: z.boolean(),
  effective_tags: z.array(z.string().trim().min(1)),
});

const startSnapshotStory = z.object({
  id: uuidV7Schema,
  key: workKey,
  title: z.string().trim().min(1),
  epic_id: uuidV7Schema,
  sprint_rank: z.string().trim().min(1),
  acceptance_criteria_hash: z
    .string()
    .regex(/^sha256:[0-9a-f]{64}$/),
  acceptance_criteria: z.array(acceptanceCriterion).min(1),
  effective_tags: z.array(z.string().trim().min(1)),
  tasks: z.array(startSnapshotTask),
});

const startSnapshot = z.object({
  captured_at: timestampSchema,
  stories: z.array(startSnapshotStory).min(1),
});

const storyOutcome = z.enum(['achieved', 'not_achieved', 'closed']);
const taskCloseResolution = z.enum([
  'completed',
  'continue',
  'move',
  'reclassify',
  'irrelevant',
]);
const closeSnapshotStory = z.object({
  id: uuidV7Schema,
  key: workKey,
  title: z.string().trim().min(1),
  epic_id: uuidV7Schema,
  outcome: storyOutcome,
  evidence: z.string().trim().default(''),
  acceptance_exception_reason: z.string().nullable(),
  acceptance_criteria: z.array(acceptanceCriterion),
  effective_tags: z.array(z.string().trim().min(1)),
});
const closeSnapshotTask = z.object({
  id: uuidV7Schema,
  key: workKey,
  title: z.string().trim().min(1),
  story_id: uuidV7Schema,
  status: taskStatus,
  started_at: timestampSchema.nullable(),
  completed_at: timestampSchema.nullable(),
  effective_tags: z.array(z.string().trim().min(1)),
  resolution: taskCloseResolution,
  target_story_id: uuidV7Schema.nullable(),
  target_epic_id: uuidV7Schema.nullable(),
  continuation_context: z.string().nullable(),
});
const closeSummary = z.object({
  attempted_stories: z.number().int().nonnegative(),
  stories_at_start: z.number().int().nonnegative(),
  stories_at_close: z.number().int().nonnegative(),
  stories_added: z.number().int().nonnegative(),
  stories_removed: z.number().int().nonnegative(),
  achieved_stories: z.number().int().nonnegative(),
  not_achieved_stories: z.number().int().nonnegative(),
  closed_stories: z.number().int().nonnegative(),
  committed_open_tasks: z.number().int().nonnegative(),
  tasks_at_start: z.number().int().nonnegative(),
  tasks_at_close: z.number().int().nonnegative(),
  tasks_added: z.number().int().nonnegative(),
  tasks_removed: z.number().int().nonnegative(),
  completed_during_sprint: z.number().int().nonnegative(),
  open_at_close: z.number().int().nonnegative(),
  exception_count: z.number().int().nonnegative(),
});
const effectiveTagCount = z.object({
  tag: z.string().trim().min(1),
  completed_tasks: z.number().int().nonnegative(),
});
const closeSnapshot = z.object({
  operation_id: uuidV7Schema,
  captured_at: timestampSchema,
  stories: z.array(closeSnapshotStory),
  tasks: z.array(closeSnapshotTask),
  summary: closeSummary,
  effective_tag_summary: z.array(effectiveTagCount),
});
const storyCloseMutation = z.object({
  id: uuidV7Schema,
  path: z.string().trim().min(1),
  expected_sprint_rank: z.string().trim().min(1),
  outcome: storyOutcome,
  evidence: z.string().trim().default(''),
  acceptance_exception_reason: z.string().nullable(),
  backlog_rank: z.string().nullable(),
});
const taskCloseMutation = z.object({
  id: uuidV7Schema,
  path: z.string().trim().min(1),
  expected_story_id: uuidV7Schema,
  expected_status: taskStatus,
  resolution: taskCloseResolution,
  target_story_id: uuidV7Schema.nullable(),
  target_story_link: z.string().nullable(),
  target_epic_id: uuidV7Schema.nullable(),
  target_epic_link: z.string().nullable(),
  target_rank: z.string().nullable(),
  continuation_context: z.string().nullable(),
});
const sprintDeltaStory = z.object({
  id: uuidV7Schema,
  key: workKey,
  title: z.string().trim().min(1),
  acceptance_criteria: z.array(acceptanceCriterion),
});
const sprintDeltaTask = z.object({
  id: uuidV7Schema,
  key: workKey,
  title: z.string().trim().min(1),
});
const sprintDelta = z.object({
  added_stories: z.array(sprintDeltaStory),
  removed_stories: z.array(sprintDeltaStory),
  added_tasks: z.array(sprintDeltaTask),
  removed_tasks: z.array(sprintDeltaTask),
  changed_acceptance_criteria_stories: z.array(sprintDeltaStory),
});
const pendingClose = z.object({
  operation_id: uuidV7Schema,
  decisions_hash: z.string().trim().min(1),
  captured_at: timestampSchema,
  sprint_id: uuidV7Schema,
  sprint_path: z.string().trim().min(1),
  stories: z.array(storyCloseMutation),
  tasks: z.array(taskCloseMutation),
  delta: sprintDelta,
  close_snapshot: closeSnapshot,
  retrospective: z.object({
    wins: z.array(z.string()),
    friction: z.array(z.string()),
    improvements: z.array(z.string()),
  }).optional().default({ wins: [], friction: [], improvements: [] }),
});

const provisionalStoryOutcome = z.object({
  story_id: uuidV7Schema,
  evaluated_at: timestampSchema,
  outcome: storyOutcome,
  evidence: z.string().default(''),
  acceptance_exception_reason: z.string().nullable(),
});

const draftSprint = z.object({
  schema_version: z.literal(1),
  id: uuidV7Schema,
  type: z.literal('sprint'),
  lifecycle: z.literal('draft'),
});

const startedSprint = z.object({
  schema_version: z.literal(1),
  id: uuidV7Schema,
  type: z.literal('sprint'),
  code: z.string().regex(/^SPR-[0-9]{3,}$/),
  sequence: z.number().int().positive(),
  starts_on: localDate,
  due_on: localDate,
  started_at: timestampSchema,
  provisional_story_outcomes: z.array(provisionalStoryOutcome),
  start_snapshot: startSnapshot,
});

const managedSprint = z.discriminatedUnion('lifecycle', [
  draftSprint,
  startedSprint.extend({
    lifecycle: z.literal('active'),
    closed_at: z.null().optional(),
    close_snapshot: z.null().optional(),
    pending_close: pendingClose.nullish().transform((value) => value ?? null),
  }),
  startedSprint.extend({
    lifecycle: z.literal('closed'),
    closed_at: timestampSchema,
    close_snapshot: closeSnapshot,
    pending_close: pendingClose.nullish().transform((value) => value ?? null),
    reopen_recovery: z.unknown().optional(),
    pending_reopen: z.unknown().optional(),
  }),
]);

export function parseSprintNote(source: WorkNoteSource): ParseSprintNoteResult {
  const frontmatter = z
    .object({ focus_flow: managedSprint })
    .safeParse(source.frontmatter);
  if (!frontmatter.success) {
    return invalid(source, z.prettifyError(frontmatter.error));
  }

  const duplicateSection = duplicateRetrospectiveSection(source.body);
  if (duplicateSection) return invalid(source, `Body contains duplicate ${duplicateSection} sections.`);

  const managed = frontmatter.data.focus_flow;
  const filename = source.path.split('/').at(-1);
  if (managed.lifecycle === 'draft') return projectDraftSprint(source, managed.id, filename);

  if (
    managed.code !== sprintCode(managed.sequence) ||
    filename !== `${managed.code}.md`
  ) {
    return invalid(source, 'Sprint code, sequence, and filename must agree.');
  }

  return projectStartedSprint(managed, source.body);
}

function duplicateRetrospectiveSection(body: string): string | null {
  const lines = body.split(/\r?\n/);
  return ['Wins', 'Friction', 'Improvements'].find((title) => findMarkdownHeadings(lines, title).length > 1) ?? null;
}

function projectDraftSprint(source: WorkNoteSource, id: string, filename: string | undefined): ParseSprintNoteResult {
  if (filename !== 'DRAFT.md') return invalid(source, 'Draft Sprint filename must be DRAFT.md.');
  return { ok: true, entity: { id, type: 'sprint', lifecycle: 'draft' } };
}

function projectStartedSprint(managed: Exclude<z.infer<typeof managedSprint>, { lifecycle: 'draft' }>, body: string): ParseSprintNoteResult {
  const common = {
    id: managed.id,
    type: 'sprint' as const,
    code: managed.code,
    sequence: managed.sequence,
    startsOn: managed.starts_on,
    dueOn: managed.due_on,
    startedAt: managed.started_at,
    provisionalStoryOutcomes: managed.provisional_story_outcomes.map(
      (outcome) => ({
        storyId: outcome.story_id,
        evaluatedAt: outcome.evaluated_at,
        outcome: outcome.outcome,
        evidence: outcome.evidence,
        acceptanceExceptionReason: outcome.acceptance_exception_reason,
      }),
    ),
    startSnapshot: projectStartSnapshot(managed.start_snapshot),
  };

  return managed.lifecycle === 'active'
    ? {
        ok: true,
        entity: {
          ...common,
          lifecycle: 'active',
          closedAt: null,
          closeSnapshot: null,
          pendingClose:
            managed.pending_close === null
              ? null
              : projectPendingClose(managed.pending_close),
        },
      }
    : {
        ok: true,
        entity: {
          ...common,
          lifecycle: 'closed',
          closedAt: managed.closed_at,
          closeSnapshot: projectCloseSnapshot(managed.close_snapshot),
          pendingClose:
            managed.pending_close === null
              ? null
              : projectPendingClose(managed.pending_close),
          reopenRecovery: reopenRecoverySchema.safeParse(managed.reopen_recovery).data ?? null,
          pendingReopen: Boolean(managed.pending_reopen),
          retrospectiveItems: parseRetrospectiveItems(body),
        },
      };
}

function parseRetrospectiveItems(body: string): RetrospectiveItem[] {
  const sections: Array<{ title: string; kind: RetrospectiveItem['kind'] }> = [
    { title: 'Wins', kind: 'win' },
    { title: 'Friction', kind: 'friction' },
    { title: 'Improvements', kind: 'improvement' },
  ];
  const lines = body.split(/\r?\n/);
  const items: RetrospectiveItem[] = [];
  for (const { title, kind } of sections) {
    const heading = findMarkdownHeadings(lines, title)[0];
    if (heading === undefined) continue;
    let current: string[] = [];
    const flush = () => {
      const text = current.join('\n').trimEnd();
      if (text) items.push({ kind, text });
      current = [];
    };
    for (const line of lines.slice(
      heading.index + 1,
      sectionEnd(lines, heading.index, heading.level),
    )) {
      const item = line.match(/^[-*+]\s+(.+?)\s*$/)?.[1];
      if (item) { flush(); current.push(item); }
      else if (current.length > 0 && (line.startsWith('  ') || line.trim() === '')) current.push(line.startsWith('  ') ? line.slice(2) : '');
      else flush();
    }
    flush();
  }
  return items;
}

function projectStartSnapshot(
  managed: z.infer<typeof startSnapshot>,
): SprintStartSnapshot {
  return {
    capturedAt: managed.captured_at,
    stories: managed.stories.map((story) => ({
      id: story.id,
      key: story.key,
      title: story.title,
      epicId: story.epic_id,
      sprintRank: story.sprint_rank,
      acceptanceCriteriaHash: story.acceptance_criteria_hash,
      acceptanceCriteria: story.acceptance_criteria,
      effectiveTags: story.effective_tags,
      tasks: story.tasks.map((task) => ({
        id: task.id,
        key: task.key,
        title: task.title,
        taskRank: task.task_rank,
        status: task.status,
        completedBeforeSprint: task.completed_before_sprint,
        effectiveTags: task.effective_tags,
      })),
    })),
  };
}

function projectPendingClose(
  managed: z.infer<typeof pendingClose>,
): SprintClosePlan {
  return {
    operationId: managed.operation_id,
    decisionsHash: managed.decisions_hash,
    capturedAt: managed.captured_at,
    sprintId: managed.sprint_id,
    sprintPath: managed.sprint_path,
    stories: managed.stories.map((story) => ({
      id: story.id,
      path: story.path,
      expectedSprintRank: story.expected_sprint_rank,
      outcome: story.outcome,
      evidence: story.evidence,
      acceptanceExceptionReason: story.acceptance_exception_reason,
      backlogRank: story.backlog_rank,
    })),
    tasks: managed.tasks.map((task) => ({
      id: task.id,
      path: task.path,
      expectedStoryId: task.expected_story_id,
      expectedStatus: task.expected_status,
      resolution: task.resolution,
      targetStoryId: task.target_story_id,
      targetStoryLink: task.target_story_link,
      targetEpicId: task.target_epic_id,
      targetEpicLink: task.target_epic_link,
      targetRank: task.target_rank,
      continuationContext: task.continuation_context,
    })),
    delta: projectSprintDelta(managed.delta),
    closeSnapshot: projectCloseSnapshot(managed.close_snapshot),
    retrospective: managed.retrospective,
  };
}

function projectCloseSnapshot(
  managed: z.infer<typeof closeSnapshot>,
): SprintCloseSnapshot {
  return {
    operationId: managed.operation_id,
    capturedAt: managed.captured_at,
    stories: managed.stories.map((story) => ({
      id: story.id,
      key: story.key,
      title: story.title,
      epicId: story.epic_id,
      outcome: story.outcome,
      evidence: story.evidence,
      acceptanceExceptionReason: story.acceptance_exception_reason,
      acceptanceCriteria: story.acceptance_criteria,
      effectiveTags: story.effective_tags,
    })),
    tasks: managed.tasks.map((task) => ({
      id: task.id,
      key: task.key,
      title: task.title,
      storyId: task.story_id,
      status: task.status,
      startedAt: task.started_at,
      completedAt: task.completed_at,
      effectiveTags: task.effective_tags,
      resolution: task.resolution,
      targetStoryId: task.target_story_id,
      targetEpicId: task.target_epic_id,
      continuationContext: task.continuation_context,
    })),
    summary: {
      attemptedStories: managed.summary.attempted_stories,
      storiesAtStart: managed.summary.stories_at_start,
      storiesAtClose: managed.summary.stories_at_close,
      storiesAdded: managed.summary.stories_added,
      storiesRemoved: managed.summary.stories_removed,
      achievedStories: managed.summary.achieved_stories,
      notAchievedStories: managed.summary.not_achieved_stories,
      closedStories: managed.summary.closed_stories,
      committedOpenTasks: managed.summary.committed_open_tasks,
      tasksAtStart: managed.summary.tasks_at_start,
      tasksAtClose: managed.summary.tasks_at_close,
      tasksAdded: managed.summary.tasks_added,
      tasksRemoved: managed.summary.tasks_removed,
      completedDuringSprint: managed.summary.completed_during_sprint,
      openAtClose: managed.summary.open_at_close,
      exceptionCount: managed.summary.exception_count,
    },
    effectiveTagSummary: managed.effective_tag_summary.map((entry) => ({
      tag: entry.tag,
      completedTasks: entry.completed_tasks,
    })),
  };
}

function projectSprintDelta(managed: z.infer<typeof sprintDelta>) {
  const story = (entry: z.infer<typeof sprintDeltaStory>) => ({
    id: entry.id,
    key: entry.key,
    title: entry.title,
    acceptanceCriteria: entry.acceptance_criteria,
  });
  const task = (entry: z.infer<typeof sprintDeltaTask>) => ({
    id: entry.id,
    key: entry.key,
    title: entry.title,
  });
  return {
    addedStories: managed.added_stories.map(story),
    removedStories: managed.removed_stories.map(story),
    addedTasks: managed.added_tasks.map(task),
    removedTasks: managed.removed_tasks.map(task),
    changedAcceptanceCriteriaStories:
      managed.changed_acceptance_criteria_stories.map(story),
  };
}

function invalid(
  source: WorkNoteSource,
  message: string,
): ParseSprintNoteResult {
  return {
    ok: false,
    diagnostics: [
      { code: 'invalid-managed-data', message, path: source.path },
    ],
  };
}
import { reopenRecoverySchema, type ReopenRecovery } from './managed-replacement';
