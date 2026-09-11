import { generateKeyBetween } from 'fractional-indexing';
import type {
  ProjectedManagedEntity,
  ProjectedWorkEntity,
  WorkIndex,
  WorkIndexSnapshot,
} from '../indexing/work-index';
import type {
  SprintClosePlan,
  StoryCloseMutation,
  TaskCloseMutation,
  TaskCloseResolution,
  RetrospectiveDraft,
} from '../../domain/sprint-close';
import { deriveSprintDelta } from '../../domain/sprint-delta';
import { compareOrdinal, compareRank } from '../../domain/ordering';

type Story = Extract<ProjectedWorkEntity, { type: 'story' }>;
type Task = Extract<ProjectedWorkEntity, { type: 'task' }>;
type Epic = Extract<ProjectedWorkEntity, { type: 'epic' }>;

interface StoryReinsertion {
  storyId: string;
  beforeStoryId: string | null;
}

export interface TaskCloseDecision {
  taskId: string;
  resolution: Exclude<TaskCloseResolution, 'completed'>;
  targetStoryId?: string;
  targetEpicId?: string;
  continuationContext?: string;
}

export interface CloseSprintRequest {
  storyReinsertions: readonly StoryReinsertion[];
  taskDecisions: readonly TaskCloseDecision[];
  retrospective?: RetrospectiveDraft;
}

export interface SprintCloseWriter {
  apply(plan: SprintClosePlan): Promise<void>;
}

interface ContentHasher {
  hash(content: string): Promise<string>;
}

interface SprintCloseDependencies {
  writer: SprintCloseWriter;
  index: Pick<WorkIndex, 'refresh' | 'getSnapshot'>;
  hasher: ContentHasher;
  nextId: () => string;
  now: () => string;
}

export class SprintCloseService {
  private tail: Promise<void> = Promise.resolve();

  constructor(private readonly dependencies: SprintCloseDependencies) {}

  close(request: CloseSprintRequest): Promise<void> {
    const operation = this.tail.then(() => this.closeNow(request));
    this.tail = operation.catch(() => undefined);
    return operation;
  }

  resume(): Promise<void> {
    const operation = this.tail.then(async () => {
      await this.dependencies.index.refresh();
      const sprint = onlyPendingCloseSprint(readySnapshot(this.dependencies.index.getSnapshot()));
      await this.dependencies.writer.apply(sprint.pendingClose);
      await this.dependencies.index.refresh();
    });
    this.tail = operation.catch(() => undefined);
    return operation;
  }

  private async closeNow(request: CloseSprintRequest): Promise<void> {
    await this.dependencies.index.refresh();
    const snapshot = readySnapshot(this.dependencies.index.getSnapshot());
    const plan = await buildClosePlan(snapshot, request, this.dependencies);

    try {
      await this.dependencies.writer.apply(plan);
    } catch (error) {
      await this.dependencies.index.refresh();
      throw error;
    }
    await this.dependencies.index.refresh();
  }
}

async function buildClosePlan(snapshot: WorkIndexSnapshot, request: CloseSprintRequest, dependencies: SprintCloseDependencies): Promise<SprintClosePlan> {
  const sprint = onlyActiveSprint(snapshot);
  if (sprint.pendingClose != null) throw new Error('Sprint close is pending; resume it instead.');
  const stories = activeSprintStories(snapshot, sprint.id);
  const outcomes = new Map(sprint.provisionalStoryOutcomes.map((outcome) => [outcome.storyId, outcome]));
  assertStoryOutcomes(stories, outcomes);
  const tasks = sprintTasks(snapshot, stories);
  const unfinished = tasks.filter((task) => task.lifecycle === 'active');
  const decisions = uniqueDecisions(request.taskDecisions);
  assertTaskDecisions(unfinished, decisions);
  const continuing = stories.filter((story) => outcomes.get(story.id)?.outcome === 'not_achieved');
  const backlogRanks = explicitBacklogRanks(snapshot, continuing, request.storyReinsertions);
  const capturedAt = dependencies.now();
  const taskMutations = buildTaskMutations(snapshot, unfinished, decisions, outcomes);
  const storyMutations = buildStoryMutations(stories, outcomes, backlogRanks);
  const operationId = dependencies.nextId();
  const retrospective = normalizeRetrospective(request.retrospective);
  const decisionsHash = await dependencies.hasher.hash(JSON.stringify({ storyReinsertions: request.storyReinsertions, taskDecisions: request.taskDecisions, retrospective }));
  const closeStories = buildCloseStories(stories, outcomes);
  const closeTasks = buildCloseTasks(tasks, taskMutations);
  const delta = deriveSprintDelta({ stories: sprint.startSnapshot.stories, tasks: sprint.startSnapshot.stories.flatMap((story) => story.tasks) }, { stories: closeStories, tasks: closeTasks });
  return {
    operationId, decisionsHash, capturedAt, sprintId: sprint.id, sprintPath: sprint.path,
    stories: storyMutations, tasks: taskMutations, delta, retrospective,
    closeSnapshot: { operationId, capturedAt, stories: closeStories, tasks: closeTasks, summary: closeSummary({ sprint, stories, tasks, outcomes, delta }), effectiveTagSummary: effectiveTagSummary(sprint.startedAt, tasks) },
  };
}

function assertStoryOutcomes(stories: readonly Story[], outcomes: ReadonlyMap<string, { outcome: string; acceptanceExceptionReason: string | null }>): void {
  if (stories.length === 0 || stories.some((story) => !outcomes.has(story.id)) || outcomes.size !== stories.length) throw new Error('Every Active Sprint Story must be evaluated.');
  for (const story of stories) {
    const outcome = outcomes.get(story.id)!;
    if (outcome.outcome === 'achieved' && story.acceptanceCriteria.some((criterion) => !criterion.checked) && !outcome.acceptanceExceptionReason?.trim()) throw new Error('Unchecked Acceptance Criteria need an exception.');
  }
}

function assertTaskDecisions(tasks: readonly Task[], decisions: ReadonlyMap<string, TaskCloseDecision>): void {
  if (tasks.some((task) => !decisions.has(task.id)) || decisions.size !== tasks.length) throw new Error('Every unfinished Task needs a close decision.');
}

function buildStoryMutations(stories: readonly Story[], outcomes: ReadonlyMap<string, ReturnType<typeof onlyActiveSprint>['provisionalStoryOutcomes'][number]>, backlogRanks: ReadonlyMap<string, string>): StoryCloseMutation[] {
  return stories.map((story) => {
    const outcome = outcomes.get(story.id)!;
    return { id: story.id, path: story.path, expectedSprintRank: story.sprintRank!, outcome: outcome.outcome, evidence: outcome.evidence, acceptanceExceptionReason: outcome.acceptanceExceptionReason, backlogRank: backlogRanks.get(story.id) ?? null };
  });
}

function buildCloseStories(stories: readonly Story[], outcomes: ReadonlyMap<string, ReturnType<typeof onlyActiveSprint>['provisionalStoryOutcomes'][number]>) {
  return stories.map((story) => {
    const outcome = outcomes.get(story.id)!;
    return { id: story.id, key: story.key, title: story.title, epicId: story.epicId, outcome: outcome.outcome, evidence: outcome.evidence, acceptanceExceptionReason: outcome.acceptanceExceptionReason, acceptanceCriteria: story.acceptanceCriteria, effectiveTags: story.effectiveTags };
  });
}

function buildCloseTasks(tasks: readonly Task[], taskMutations: readonly TaskCloseMutation[]) {
  const mutationById = new Map(taskMutations.map((mutation) => [mutation.id, mutation]));
  return tasks.map((task) => {
    const mutation = mutationById.get(task.id);
    return { id: task.id, key: task.key, title: task.title, storyId: task.storyId, status: task.status, startedAt: task.startedAt, completedAt: task.completedAt, effectiveTags: task.effectiveTags, resolution: mutation?.resolution ?? 'completed', targetStoryId: mutation?.targetStoryId ?? null, targetEpicId: mutation?.targetEpicId ?? null, continuationContext: mutation?.continuationContext ?? null } as const;
  });
}

function normalizeRetrospective(value?: RetrospectiveDraft): RetrospectiveDraft {
  const clean = (items: readonly string[] | undefined) =>
    (items ?? []).map((item) => item.trim()).filter((item) => item !== '');
  return {
    wins: clean(value?.wins),
    friction: clean(value?.friction),
    improvements: clean(value?.improvements),
  };
}

function readySnapshot(snapshot: WorkIndexSnapshot): WorkIndexSnapshot {
  if (snapshot.phase !== 'ready') {
    throw new Error('Focus Flow index must be ready before Sprint close.');
  }
  return snapshot;
}

function onlyActiveSprint(snapshot: WorkIndexSnapshot) {
  const matches = snapshot.entities.filter(
    (entity) => entity.type === 'sprint' && entity.lifecycle === 'active',
  );
  if (matches.length !== 1) throw new Error('Exactly one Active Sprint is required.');
  return matches[0]!;
}

function onlyPendingCloseSprint(snapshot: WorkIndexSnapshot) {
  const matches = snapshot.entities.filter(
    (entity): entity is Extract<ProjectedManagedEntity, { type: 'sprint'; lifecycle: 'active' | 'closed' }> & { pendingClose: SprintClosePlan } =>
      entity.type === 'sprint' &&
      entity.lifecycle !== 'draft' &&
      entity.pendingClose != null,
  );
  if (matches.length !== 1) throw new Error('There is no single pending Sprint close to resume.');
  return matches[0]!;
}

function activeSprintStories(snapshot: WorkIndexSnapshot, sprintId: string) {
  return snapshot.entities
    .filter(
      (entity): entity is Story =>
        entity.type === 'story' &&
        entity.lifecycle === 'active_sprint' &&
        entity.sprintId === sprintId,
    )
    .sort((left, right) =>
      compareRank(left.sprintRank!, right.sprintRank!, left.id, right.id),
    );
}

function sprintTasks(snapshot: WorkIndexSnapshot, stories: readonly Story[]) {
  const storyIds = new Set(stories.map((story) => story.id));
  return snapshot.entities
    .filter(
      (entity): entity is Task =>
        entity.type === 'task' && storyIds.has(entity.storyId),
    )
    .sort((left, right) => compareOrdinal(left.id, right.id));
}

function uniqueDecisions(decisions: readonly TaskCloseDecision[]) {
  const map = new Map(decisions.map((decision) => [decision.taskId, decision]));
  if (map.size !== decisions.length) throw new Error('Task close decisions must be unique.');
  return map;
}

function explicitBacklogRanks(
  snapshot: WorkIndexSnapshot,
  continuing: readonly Story[],
  reinsertions: readonly StoryReinsertion[],
): ReadonlyMap<string, string> {
  assertReinsertions(continuing, reinsertions);

  const ordered = snapshot.entities
    .filter(
      (entity): entity is Story =>
        entity.type === 'story' && entity.lifecycle === 'backlog',
    )
    .sort((left, right) =>
      compareRank(left.backlogRank!, right.backlogRank!, left.id, right.id),
    )
    .map((story) => ({ id: story.id, rank: story.backlogRank! }));
  const ranks = new Map<string, string>();

  for (const insertion of reinsertions) {
    const index =
      insertion.beforeStoryId === null
        ? ordered.length
        : ordered.findIndex((item) => item.id === insertion.beforeStoryId);
    if (index < 0) throw new Error('Month insertion target was not found.');
    const rank = generateKeyBetween(
      ordered[index - 1]?.rank ?? null,
      ordered[index]?.rank ?? null,
    );
    ordered.splice(index, 0, { id: insertion.storyId, rank });
    ranks.set(insertion.storyId, rank);
  }
  return ranks;
}

function assertReinsertions(continuing: readonly Story[], reinsertions: readonly StoryReinsertion[]): void {
  const unique = new Set(reinsertions.map((item) => item.storyId)).size === reinsertions.length;
  const complete = reinsertions.length === continuing.length && continuing.every((story) => reinsertions.some((item) => item.storyId === story.id));
  if (!unique || !complete) throw new Error('Every continuing Story needs a Month position.');
}

function buildTaskMutations(
  snapshot: WorkIndexSnapshot,
  tasks: readonly Task[],
  decisions: ReadonlyMap<string, TaskCloseDecision>,
  outcomes: ReadonlyMap<string, { outcome: string }>,
): TaskCloseMutation[] {
  const projected = snapshot.entities.filter(
    (entity): entity is ProjectedWorkEntity => entity.type !== 'sprint',
  );
  const byId = new Map(projected.map((entity) => [entity.id, entity]));
  const tailRanks = new Map<string, string | null>();
  return tasks.map((task) => buildTaskMutation({ task, decision: decisions.get(task.id)!, outcomes, projected, byId, tailRanks }));
}

function buildTaskMutation({ task, decision, outcomes, projected, byId, tailRanks }: { task: Task; decision: TaskCloseDecision; outcomes: ReadonlyMap<string, { outcome: string }>; projected: readonly ProjectedWorkEntity[]; byId: ReadonlyMap<string, ProjectedWorkEntity>; tailRanks: Map<string, string | null> }): TaskCloseMutation {
  const targets = taskMutationTargets(task, decision, outcomes, byId);
  const targetRank = mutationTargetRank(decision, targets.story, projected, tailRanks);
  return { id: task.id, path: task.path, expectedStoryId: task.storyId, expectedStatus: task.status, resolution: decision.resolution, targetStoryId: targets.story?.id ?? null, targetStoryLink: targets.story ? noteLink(targets.story.path) : null, targetEpicId: targets.epic?.id ?? null, targetEpicLink: targets.epic ? noteLink(targets.epic.path) : null, targetRank, continuationContext: decision.continuationContext?.trim() || null };
}

function taskMutationTargets(task: Task, decision: TaskCloseDecision, outcomes: ReadonlyMap<string, { outcome: string }>, byId: ReadonlyMap<string, ProjectedWorkEntity>): { story?: Story; epic?: Epic } {
  if (decision.resolution === 'continue') {
    if (outcomes.get(task.storyId)?.outcome !== 'not_achieved') throw new Error('A Task can continue only with a not-achieved Story.');
    return { story: byId.get(task.storyId) as Story };
  }
  if (decision.resolution === 'move') return { story: continuingTargetStory(decision, outcomes, byId) };
  if (decision.resolution === 'reclassify') return { epic: activeTargetEpic(decision, byId) };
  return {};
}

function continuingTargetStory(decision: TaskCloseDecision, outcomes: ReadonlyMap<string, { outcome: string }>, byId: ReadonlyMap<string, ProjectedWorkEntity>): Story {
  const target = decision.targetStoryId ? byId.get(decision.targetStoryId) : undefined;
  if (target?.type !== 'story') throw new Error('Target Story was not found.');
  const active = target.lifecycle === 'epic_backlog' || target.lifecycle === 'backlog' || target.lifecycle === 'active_sprint' && outcomes.get(target.id)?.outcome === 'not_achieved';
  if (!active) throw new Error('Target Story will not remain active after close.');
  return target;
}

function activeTargetEpic(decision: TaskCloseDecision, byId: ReadonlyMap<string, ProjectedWorkEntity>): Epic {
  const target = decision.targetEpicId ? byId.get(decision.targetEpicId) : undefined;
  if (target?.type !== 'epic' || target.lifecycle !== 'backlog') throw new Error('Target Epic was not found.');
  return target;
}

function mutationTargetRank(decision: TaskCloseDecision, story: Story | undefined, projected: readonly ProjectedWorkEntity[], tailRanks: Map<string, string | null>): string | null {
  if (story) return nextTaskRank(projected, story.id, tailRanks);
  return decision.resolution === 'reclassify' ? nextStoryRank(projected, tailRanks) : null;
}

function nextTaskRank(
  entities: readonly ProjectedWorkEntity[],
  storyId: string,
  tails: Map<string, string | null>,
) {
  const key = `task:${storyId}`;
  const previous = tails.has(key)
    ? tails.get(key)!
    : entities
        .filter((entity): entity is Task => entity.type === 'task' && entity.storyId === storyId)
        .sort((left, right) => compareRank(left.taskRank, right.taskRank, left.id, right.id))
        .at(-1)?.taskRank ?? null;
  const rank = generateKeyBetween(previous, null);
  tails.set(key, rank);
  return rank;
}

function nextStoryRank(
  entities: readonly ProjectedWorkEntity[],
  tails: Map<string, string | null>,
) {
  const key = 'story';
  const previous = tails.has(key)
    ? tails.get(key)!
    : entities
        .filter((entity): entity is Story => entity.type === 'story' && entity.backlogRank !== null)
        .sort((left, right) => compareRank(left.backlogRank!, right.backlogRank!, left.id, right.id))
        .at(-1)?.backlogRank ?? null;
  const rank = generateKeyBetween(previous, null);
  tails.set(key, rank);
  return rank;
}

function noteLink(path: string): string {
  return `[[${path.replace(/\.md$/, '')}]]`;
}

function closeSummary(
  { sprint, stories, tasks, outcomes, delta }: { sprint: ReturnType<typeof onlyActiveSprint>; stories: readonly Story[]; tasks: readonly Task[]; outcomes: ReadonlyMap<string, { outcome: string; acceptanceExceptionReason: string | null }>; delta: ReturnType<typeof deriveSprintDelta> },
) {
  const startTasks = sprint.startSnapshot.stories.flatMap((story) => story.tasks);
  return {
    attemptedStories: stories.length,
    storiesAtStart: sprint.startSnapshot.stories.length,
    storiesAtClose: stories.length,
    storiesAdded: delta.addedStories.length,
    storiesRemoved: delta.removedStories.length,
    achievedStories: stories.filter((story) => outcomes.get(story.id)?.outcome === 'achieved').length,
    notAchievedStories: stories.filter((story) => outcomes.get(story.id)?.outcome === 'not_achieved').length,
    closedStories: stories.filter((story) => outcomes.get(story.id)?.outcome === 'closed').length,
    committedOpenTasks: startTasks.filter((task) => !task.completedBeforeSprint).length,
    tasksAtStart: startTasks.length,
    tasksAtClose: tasks.length,
    tasksAdded: delta.addedTasks.length,
    tasksRemoved: delta.removedTasks.length,
    completedDuringSprint: tasks.filter(
      (task) => task.completedAt !== null && task.completedAt >= sprint.startedAt,
    ).length,
    openAtClose: tasks.filter((task) => task.lifecycle === 'active').length,
    exceptionCount: stories.filter(
      (story) => outcomes.get(story.id)?.acceptanceExceptionReason !== null,
    ).length,
  };
}

function effectiveTagSummary(startedAt: string, tasks: readonly Task[]) {
  const counts = new Map<string, number>();
  for (const task of tasks) {
    if (task.completedAt === null || task.completedAt < startedAt) continue;
    for (const tag of task.effectiveTags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return Array.from(counts, ([tag, completedTasks]) => ({ tag, completedTasks })).sort(
    (left, right) => compareOrdinal(left.tag, right.tag),
  );
}
