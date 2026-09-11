import { z } from 'zod';
import { timestampSchema, uuidV7Schema } from './managed-schema';
import { findMarkdownHeadings } from './markdown-sections';
import { readAcceptanceCriteria as acceptanceCriteria } from './acceptance-criteria';

export interface WorkNoteSource {
  path: string;
  frontmatter: unknown;
  body: string;
}

export interface AcceptanceCriterion {
  text: string;
  checked: boolean;
}

interface WorkEntityBase {
  id: string;
  key: string;
  title: string;
  createdAt: string;
  tags: string[];
}

interface InboxCandidateEntity extends WorkEntityBase {
  type: 'candidate';
  lifecycle: 'inbox';
}

interface RejectedCandidateEntity extends WorkEntityBase {
  type: 'candidate';
  lifecycle: 'rejected';
  rejectedAt: string;
  rejectionReason: string | null;
}

type CandidateEntity = InboxCandidateEntity | RejectedCandidateEntity;

interface EpicEntityBase extends WorkEntityBase {
  type: 'epic';
  acceptanceCriteria?: AcceptanceCriterion[];
  completedAt?: string | null;
  closedAt?: string | null;
  closeReason?: string | null;
}

interface BacklogEpicEntity extends EpicEntityBase {
  lifecycle: 'backlog';
  backlogRank: string;
}

interface DoneEpicEntity extends EpicEntityBase {
  lifecycle: 'done';
  backlogRank: null;
  completedAt: string;
  closedAt: null;
  closeReason: null;
}

interface ClosedEpicEntity extends EpicEntityBase {
  lifecycle: 'closed';
  backlogRank: null;
  completedAt: null;
  closedAt: string;
  closeReason: string | null;
}

type EpicEntity =
  | BacklogEpicEntity
  | DoneEpicEntity
  | ClosedEpicEntity;

interface StoryEntity extends WorkEntityBase {
  type: 'story';
  lifecycle: 'epic_backlog' | 'backlog' | 'draft_sprint' | 'active_sprint' | 'done' | 'closed';
  epicId: string;
  epicLink: string;
  backlogRank: string | null;
  sprintId: string | null;
  sprintRank: string | null;
  acceptanceCriteria: AcceptanceCriterion[];
  completedAt?: string | null;
  outcome?: 'achieved' | 'closed' | null;
  acceptanceExceptionReason?: string | null;
  closedAt?: string | null;
  closeReason?: string | null;
}

export type TaskStatus =
  | 'todo'
  | 'tomorrow'
  | 'today'
  | 'in_progress'
  | 'external_in_progress'
  | 'on_hold'
  | 'done';

export interface TaskEntity extends WorkEntityBase {
  type: 'task';
  lifecycle: 'active' | 'done' | 'closed';
  storyId: string;
  storyLink: string;
  taskRank: string;
  status: TaskStatus;
  startedAt: string | null;
  completedAt: string | null;
  closedAt?: string | null;
  resolution?: 'irrelevant' | null;
  continuationContext?: string | null;
}

export type WorkEntity =
  | CandidateEntity
  | EpicEntity
  | StoryEntity
  | TaskEntity;

export interface ParentLinkRepairPlan {
  kind: 'replace-parent-link';
  path: string;
  parentId: string;
  field: 'epic_link' | 'story_link';
  expectedValue: string;
  replacementValue: string;
}

export type RankField = 'backlog_rank' | 'sprint_rank' | 'task_rank';

interface RankRepairEntry {
  path: string;
  id: string;
  field: RankField;
  expectedValue: string;
  replacementValue: string;
}

export interface RankRepairPlan {
  kind: 'rebalance-ranks';
  collectionLabel: string;
  entries: readonly RankRepairEntry[];
}

export interface MoveNoteRepairPlan {
  kind: 'move-note';
  path: string;
  id: string;
  targetFolder:
    | 'Inbox'
    | 'Distractions'
    | 'Epics'
    | 'Stories'
    | 'Tasks'
    | `${'Epics' | 'Stories' | 'Tasks' | 'Sprints'}/Archive/${string}/${string}`
    | 'Sprints';
}

export interface KeyRepairEntry {
  path: string;
  id: string;
  expectedKey: string;
  replacementKey: string;
  replacementPath: string;
}

export interface KeyRepairLink {
  path: string;
  parentId: string;
  field: 'epic_link' | 'story_link';
  expectedValue: string;
  replacementValue: string;
}

export interface KeyRepairPlan {
  kind: 'repair-duplicate-keys';
  entries: readonly KeyRepairEntry[];
  links: readonly KeyRepairLink[];
}

interface IdRepairEntry {
  path: string;
  expectedId: string;
}

export interface IdRepairReference {
  path: string;
  field: 'epic_id' | 'story_id' | 'sprint_id';
  expectedId: string;
  replacementForPath: string;
}

export interface IdRepairPlan {
  kind: 'repair-duplicate-ids';
  entries: readonly IdRepairEntry[];
  references: readonly IdRepairReference[];
}

export interface CatalogTagRepairPlan {
  kind: 'catalog-tag';
  tag: string;
}

export type RepairPlan =
  | ParentLinkRepairPlan
  | RankRepairPlan
  | MoveNoteRepairPlan
  | KeyRepairPlan
  | IdRepairPlan
  | CatalogTagRepairPlan;

export interface WorkNoteDiagnostic {
  code:
    | 'invalid-managed-data'
    | 'duplicate-id'
    | 'duplicate-key'
    | 'duplicate-rank'
    | 'missing-parent'
    | 'parent-link-mismatch'
    | 'terminal-parent'
    | 'missing-mission'
    | 'missing-transition-timestamp'
    | 'multiple-open-sprints'
    | 'wip-limit-exceeded'
    | 'uncataloged-tag'
    | 'wrong-folder';
  message: string;
  path: string;
  severity?: 'warning' | 'error';
  repair?: RepairPlan;
}

export type ParseWorkNoteResult =
  | { ok: true; entity: WorkEntity }
  | { ok: false; diagnostics: WorkNoteDiagnostic[] };

const optionalTimestamp = timestampSchema
  .nullish()
  .transform((value) => value ?? null);

const managedBase = z.object({
  schema_version: z.literal(1),
  id: uuidV7Schema,
  key: z.string().regex(/^FF-[1-9]\d*$/),
  created_at: timestampSchema,
});

const managedEntity = z.discriminatedUnion('type', [
  managedBase.extend({
    type: z.literal('candidate'),
    lifecycle: z.enum(['inbox', 'rejected']),
    rejected_at: timestampSchema.optional(),
    rejection_reason: z.string().min(1).optional(),
  }),
  managedBase.extend({
    type: z.literal('epic'),
    lifecycle: z.enum(['backlog', 'done', 'closed']),
    backlog_rank: z.string().min(1).optional(),
    completed_at: optionalTimestamp,
    closed_at: optionalTimestamp,
    close_reason: z.string().trim().min(1).nullish(),
  }),
  managedBase.extend({
    type: z.literal('story'),
    lifecycle: z.enum([
      'epic_backlog',
      'backlog',
      'draft_sprint',
      'active_sprint',
      'done',
      'closed',
    ]),
    epic_id: uuidV7Schema,
    epic_link: z.string().min(1),
    backlog_rank: z.string().min(1).optional(),
    sprint_id: uuidV7Schema.optional(),
    sprint_rank: z.string().min(1).optional(),
    completed_at: optionalTimestamp,
    outcome: z.enum(['achieved', 'closed']).nullish(),
    acceptance_exception_reason: z.string().nullish(),
    closed_at: optionalTimestamp,
    close_reason: z.string().nullish(),
  }),
  managedBase.extend({
    type: z.literal('task'),
    lifecycle: z.enum(['active', 'done', 'closed']),
    story_id: uuidV7Schema,
    story_link: z.string().min(1),
    task_rank: z.string().min(1),
    status: z.enum([
      'todo',
      'tomorrow',
      'today',
      'in_progress',
      'external_in_progress',
      'on_hold',
      'done',
    ]),
    started_at: optionalTimestamp,
    completed_at: optionalTimestamp,
    closed_at: optionalTimestamp,
    resolution: z.literal('irrelevant').nullish(),
    continuation_context: z.string().nullish(),
  }),
]);

const workFrontmatter = z.object({
  focus_flow: managedEntity,
  tags: z.array(z.string()).optional(),
});

function invalid(source: WorkNoteSource, message: string): ParseWorkNoteResult {
  return {
    ok: false,
    diagnostics: [
      {
        code: 'invalid-managed-data',
        message,
        path: source.path,
      },
    ],
  };
}

function fileIdentity(path: string): { key: string; title: string } | null {
  const filename = path.split('/').at(-1);
  const match = filename?.match(/^(FF-[1-9]\d*) (.+)\.md$/);

  return match?.[1] && match[2]
    ? { key: match[1], title: match[2] }
    : null;
}

function normalizeTags(tags: string[] | undefined): string[] {
  return Array.from(
    new Set(
      (tags ?? [])
        .map((tag) => tag.trim().replace(/^#/, ''))
        .filter((tag) => tag !== ''),
    ),
  );
}


function taskStateIsValid(
  task: Extract<z.infer<typeof managedEntity>, { type: 'task' }>,
): boolean {
  if (task.lifecycle === 'active') {
    return (
      task.status !== 'done' &&
      task.closed_at === null &&
      (task.resolution === null || task.resolution === undefined)
    );
  }
  if (task.lifecycle === 'done') {
    return task.status === 'done';
  }
  return task.closed_at !== null && task.resolution === 'irrelevant';
}

function candidateStateIsValid(
  candidate: Extract<
    z.infer<typeof managedEntity>,
    { type: 'candidate' }
  >,
): boolean {
  return candidate.lifecycle === 'rejected'
    ? candidate.rejected_at !== undefined
    : candidate.rejected_at === undefined &&
        candidate.rejection_reason === undefined;
}

function storyRanksAreValid(
  story: Extract<z.infer<typeof managedEntity>, { type: 'story' }>,
): boolean {
  if (story.lifecycle === 'backlog' || story.lifecycle === 'epic_backlog') {
    return backlogStoryRanksAreValid(story);
  }

  if (
    story.lifecycle === 'draft_sprint' ||
    story.lifecycle === 'active_sprint'
  ) {
    return sprintStoryRanksAreValid(story);
  }
  if (story.lifecycle === 'done') {
    return doneStoryRanksAreValid(story);
  }
  return closedStoryRanksAreValid(story);
}

type ManagedStory = Extract<z.infer<typeof managedEntity>, { type: 'story' }>;

function backlogStoryRanksAreValid(story: ManagedStory): boolean {
  const backlogRankMatches = story.lifecycle === 'backlog' ? story.backlog_rank !== undefined : story.backlog_rank === undefined;
  return backlogRankMatches && story.sprint_id === undefined && story.sprint_rank === undefined && story.completed_at === null && story.closed_at === null && story.outcome == null;
}

function sprintStoryRanksAreValid(story: ManagedStory): boolean {
  return story.sprint_id !== undefined && story.sprint_rank !== undefined && story.completed_at === null && story.closed_at === null && story.outcome == null;
}

function doneStoryRanksAreValid(story: ManagedStory): boolean {
  return story.completed_at !== null && story.outcome === 'achieved' && story.closed_at === null && story.sprint_id === undefined && story.sprint_rank === undefined;
}

function closedStoryRanksAreValid(story: ManagedStory): boolean {
  return story.closed_at !== null && story.outcome === 'closed' && story.close_reason != null && story.sprint_id === undefined && story.sprint_rank === undefined;
}

function epicStateIsValid(
  epic: Extract<z.infer<typeof managedEntity>, { type: 'epic' }>,
): boolean {
  if (epic.lifecycle === 'backlog') {
    return activeEpicStateIsValid(epic);
  }
  if (epic.lifecycle === 'done') {
    return doneEpicStateIsValid(epic);
  }
  return epic.backlog_rank === undefined &&
    epic.completed_at === null &&
    epic.closed_at !== null;
}

type ManagedEpic = Extract<z.infer<typeof managedEntity>, { type: 'epic' }>;
function activeEpicStateIsValid(epic: ManagedEpic): boolean { return epic.backlog_rank !== undefined && epic.completed_at === null && epic.closed_at === null && epic.close_reason == null; }
function doneEpicStateIsValid(epic: ManagedEpic): boolean { return epic.backlog_rank === undefined && epic.completed_at !== null && epic.closed_at === null && epic.close_reason == null; }

type ManagedWork = z.infer<typeof managedEntity>;
type ManagedCandidate = Extract<ManagedWork, { type: 'candidate' }>;
type ManagedTask = Extract<ManagedWork, { type: 'task' }>;

function managedStateError(managed: ManagedWork): string | null {
  if (managed.type === 'task' && !taskStateIsValid(managed)) return 'Task lifecycle and status must agree.';
  if (managed.type === 'candidate' && !candidateStateIsValid(managed)) return 'Candidate lifecycle and rejection fields must agree.';
  if (managed.type === 'story' && !storyRanksAreValid(managed)) return 'Story lifecycle and ranks must agree.';
  if (managed.type === 'epic' && !epicStateIsValid(managed)) return 'Epic lifecycle and terminal fields must agree.';
  return null;
}

function hasDuplicateAcceptanceCriteria(body: string): boolean {
  return findMarkdownHeadings(body.split(/\r?\n/), 'Acceptance Criteria').length > 1;
}

function projectWorkEntity(managed: ManagedWork, common: WorkEntityBase, body: string): WorkEntity {
  if (managed.type === 'candidate') return projectCandidate(managed, common);
  if (managed.type === 'epic') return projectEpic(managed, common, body);
  if (managed.type === 'task') return projectTask(managed, common);
  return projectStory(managed, common, body);
}

function projectCandidate(managed: ManagedCandidate, common: WorkEntityBase): CandidateEntity {
  if (managed.lifecycle !== 'rejected') return { ...common, type: 'candidate', lifecycle: 'inbox' };
  return { ...common, type: 'candidate', lifecycle: 'rejected', rejectedAt: managed.rejected_at!, rejectionReason: managed.rejection_reason ?? null };
}

function projectEpic(managed: ManagedEpic, common: WorkEntityBase, body: string): EpicEntity {
  const epic = { ...common, type: 'epic' as const, acceptanceCriteria: acceptanceCriteria(body) };
  if (managed.lifecycle === 'backlog') return { ...epic, lifecycle: 'backlog', backlogRank: managed.backlog_rank!, completedAt: null, closedAt: null, closeReason: null };
  if (managed.lifecycle === 'done') return { ...epic, lifecycle: 'done', backlogRank: null, completedAt: managed.completed_at!, closedAt: null, closeReason: null };
  return { ...epic, lifecycle: 'closed', backlogRank: null, completedAt: null, closedAt: managed.closed_at!, closeReason: managed.close_reason ?? null };
}

function projectTask(managed: ManagedTask, common: WorkEntityBase): TaskEntity {
  return {
    ...common,
    type: 'task',
    lifecycle: managed.lifecycle,
    storyId: managed.story_id,
    storyLink: managed.story_link,
    taskRank: managed.task_rank,
    status: managed.status,
    startedAt: managed.started_at,
    completedAt: managed.completed_at,
    ...optionalField('closedAt', managed.closed_at),
    ...optionalField('resolution', managed.resolution),
    ...optionalField('continuationContext', managed.continuation_context),
  };
}

function projectStory(managed: ManagedStory, common: WorkEntityBase, body: string): StoryEntity {
  return {
    ...common,
    type: 'story',
    lifecycle: managed.lifecycle,
    epicId: managed.epic_id,
    epicLink: managed.epic_link,
    backlogRank: managed.backlog_rank ?? null,
    sprintId: managed.sprint_id ?? null,
    sprintRank: managed.sprint_rank ?? null,
    acceptanceCriteria: acceptanceCriteria(body),
    ...optionalField('completedAt', managed.completed_at),
    ...optionalField('outcome', managed.outcome),
    ...optionalField('acceptanceExceptionReason', managed.acceptance_exception_reason),
    ...optionalField('closedAt', managed.closed_at),
    ...optionalField('closeReason', managed.close_reason),
  };
}

function optionalField<Key extends string, Value>(key: Key, value: Value | null | undefined): Partial<Record<Key, Value>> {
  return value == null ? {} : { [key]: value } as Record<Key, Value>;
}

export function parseWorkNote(source: WorkNoteSource): ParseWorkNoteResult {
  const parsed = workFrontmatter.safeParse(source.frontmatter);
  if (!parsed.success) {
    return invalid(source, z.prettifyError(parsed.error));
  }

  const file = fileIdentity(source.path);
  if (file === null || file.key !== parsed.data.focus_flow.key) {
    return invalid(source, 'Filename must match the managed Focus Flow key.');
  }

  const managed = parsed.data.focus_flow;
  const stateError = managedStateError(managed);
  if (stateError) return invalid(source, stateError);
  if (hasDuplicateAcceptanceCriteria(source.body)) return invalid(source, 'Body contains duplicate Acceptance Criteria sections.');

  const common = {
    id: managed.id,
    key: managed.key,
    title: file.title,
    createdAt: managed.created_at,
    tags: normalizeTags(parsed.data.tags),
  };

  return { ok: true, entity: projectWorkEntity(managed, common, source.body) };
}
