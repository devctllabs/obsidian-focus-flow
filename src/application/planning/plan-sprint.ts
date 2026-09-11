import { generateKeyBetween } from 'fractional-indexing';
import type {
  ProjectedManagedEntity,
  WorkIndex,
  WorkIndexSnapshot,
} from '../indexing/work-index';
import { sprintCode } from '../../domain/cycle-code';
import { compareRank } from '../../domain/ordering';
import type { SprintStartSnapshot } from '../../domain/sprint-note';
import { evaluateWip, type WipPolicy } from '../../domain/wip-policy';
import { startingSprintScopeCount } from './sprint-scope';
import type { StoryPosition } from './active-story-membership';

type Story = Extract<ProjectedManagedEntity, { type: 'story' }>;
type Task = Extract<ProjectedManagedEntity, { type: 'task' }>;
type Sprint = Extract<ProjectedManagedEntity, { type: 'sprint' }>;

export interface DraftReference {
  id: string;
  path: string;
}

export interface DraftStoryMutation {
  id: string;
  path: string;
  expectedBacklogRank: string;
  expectedSprintRank: string;
  targetBacklogRank?: string;
}

export type StartSnapshot = SprintStartSnapshot;

export type SprintPlanningPlan =
  | { kind: 'create-draft'; id: string }
  | {
      kind: 'select-draft-story';
      draft: DraftReference;
      story: Omit<DraftStoryMutation, 'expectedSprintRank'> & {
        sprintRank: string;
      };
    }
  | {
      kind: 'remove-draft-story';
      draft: DraftReference;
      story: DraftStoryMutation;
    }
  | {
      kind: 'cancel-draft';
      draft: DraftReference;
      stories: readonly DraftStoryMutation[];
    }
  | {
      kind: 'start-sprint';
      draft: DraftReference;
      code: string;
      sequence: number;
      startsOn: string;
      dueOn: string;
      startedAt: string;
      stories: ReadonlyArray<{
        id: string;
        path: string;
        expectedSprintRank: string;
      }>;
      startSnapshot: StartSnapshot;
    };

export interface SprintPlanningWriter {
  apply(plan: SprintPlanningPlan): Promise<void>;
}

export interface ContentHasher {
  hash(content: string): Promise<string>;
}

export interface PlanningClock {
  now(): string;
  today(): string;
}

export class SprintPlanningService {
  private tail: Promise<void> = Promise.resolve();

  constructor(private readonly dependencies: {
    writer: SprintPlanningWriter;
    index: Pick<WorkIndex, 'refresh' | 'getSnapshot'>;
    hasher: ContentHasher;
    nextId: () => string;
    clock: PlanningClock;
    getFirstWeekday: () => number;
    getScopePolicy: () => WipPolicy;
  }) {}

  createDraft(): Promise<void> {
    return this.enqueue(async () => {
      const snapshot = await this.refreshReadySnapshot();
      if (openSprints(snapshot).length !== 0) {
        throw new Error('A Draft or Active Sprint already exists.');
      }
      await this.dependencies.writer.apply({ kind: 'create-draft', id: this.dependencies.nextId() });
      await this.dependencies.index.refresh();
    });
  }

  addStory(storyId: string, position?: StoryPosition): Promise<void> {
    return this.enqueue(async () => {
      const snapshot = await this.refreshReadySnapshot();
      const draft = uniqueDraft(snapshot);
      const available = uniqueStory(snapshot, storyId, 'backlog');
      if (available.acceptanceCriteria.length === 0) {
        throw new Error(
          'Story needs Acceptance Criteria before Sprint selection.',
        );
      }
      if (available.backlogRank === null) {
        throw new Error('Story is missing its Month rank.');
      }
      const selected = draftStories(snapshot, draft.id);
      await this.dependencies.writer.apply({
        kind: 'select-draft-story',
        draft: sprintReference(draft),
        story: {
          id: available.id,
          path: available.path,
          expectedBacklogRank: available.backlogRank,
          sprintRank: position === undefined
            ? generateKeyBetween(selected.at(-1)?.sprintRank ?? null, null)
            : rankAtPosition(selected, position, 'sprintRank'),
        },
      });
      await this.dependencies.index.refresh();
    });
  }

  removeStory(storyId: string, position?: StoryPosition): Promise<void> {
    return this.enqueue(async () => {
      const snapshot = await this.refreshReadySnapshot();
      const draft = uniqueDraft(snapshot);
      const selected = uniqueStory(snapshot, storyId, 'draft_sprint');
      assertDraftMembership(selected, draft.id);
      const mutation = draftStoryMutation(selected);
      if (position !== undefined) {
        const monthStories = snapshot.entities
          .filter((entity): entity is Story & { backlogRank: string } => entity.type === 'story' && entity.lifecycle === 'backlog' && entity.backlogRank !== null)
          .sort((left, right) => compareRank(left.backlogRank, right.backlogRank, left.id, right.id));
        mutation.targetBacklogRank = rankAtPosition(monthStories, position, 'backlogRank');
      }
      await this.dependencies.writer.apply({
        kind: 'remove-draft-story',
        draft: sprintReference(draft),
        story: mutation,
      });
      await this.dependencies.index.refresh();
    });
  }

  cancelDraft(): Promise<void> {
    return this.enqueue(async () => {
      const snapshot = await this.refreshReadySnapshot();
      const draft = uniqueDraft(snapshot);
      await this.dependencies.writer.apply({
        kind: 'cancel-draft',
        draft: sprintReference(draft),
        stories: draftStories(snapshot, draft.id).map(draftStoryMutation),
      });
      await this.dependencies.index.refresh();
    });
  }

  startDraft(confirmScopeExcess: boolean): Promise<void> {
    return this.enqueue(async () => {
      const snapshot = await this.refreshReadySnapshot();
      const draft = uniqueDraft(snapshot);
      const selected = draftStories(snapshot, draft.id);
      if (selected.length === 0) {
        throw new Error('Select at least one Story before starting.');
      }
      if (selected.some((story) => story.acceptanceCriteria.length === 0)) {
        throw new Error('Every selected Story needs Acceptance Criteria.');
      }

      const selectedIds = new Set(selected.map((story) => story.id));
      const tasks = snapshot.entities.filter(
        (entity): entity is Task =>
          entity.type === 'task' && selectedIds.has(entity.storyId),
      );
      const openScope = startingSprintScopeCount(tasks);
      const scopeDecision = evaluateWip(this.dependencies.getScopePolicy(), openScope);
      if (scopeDecision.kind === 'reject') {
        throw new Error('Sprint scope exceeds the hard limit.');
      }
      if (scopeDecision.kind === 'confirm' && !confirmScopeExcess) {
        throw new Error('Sprint scope confirmation is required.');
      }

      const sequence = nextSprintSequence(snapshot);
      const startedAt = this.dependencies.clock.now();
      const boundary = sprintDateBoundary(
        this.dependencies.clock.today(),
        this.dependencies.getFirstWeekday(),
      );
      if (
        snapshot.entities.some(
          (entity) =>
            entity.type === 'sprint' &&
            entity.lifecycle !== 'draft' &&
            entity.startsOn === boundary.startsOn,
        )
      ) {
        throw new Error(`A Sprint already started for ${boundary.startsOn}.`);
      }
      const startSnapshot = await this.buildStartSnapshot(
        selected,
        tasks,
        startedAt,
      );
      await this.dependencies.writer.apply({
        kind: 'start-sprint',
        draft: sprintReference(draft),
        code: sprintCode(sequence),
        sequence,
        startsOn: boundary.startsOn,
        dueOn: boundary.dueOn,
        startedAt,
        stories: selected.map((story) => ({
          id: story.id,
          path: story.path,
          expectedSprintRank: story.sprintRank,
        })),
        startSnapshot,
      });
      await this.dependencies.index.refresh();
    });
  }

  private async buildStartSnapshot(
    stories: readonly (Story & { sprintRank: string })[],
    tasks: readonly Task[],
    capturedAt: string,
  ): Promise<StartSnapshot> {
    return {
      capturedAt,
      stories: await Promise.all(
        stories.map(async (story) => ({
          id: story.id,
          key: story.key,
          title: story.title,
          epicId: story.epicId,
          sprintRank: story.sprintRank,
          acceptanceCriteriaHash: await this.dependencies.hasher.hash(
            JSON.stringify(story.acceptanceCriteria),
          ),
          acceptanceCriteria: story.acceptanceCriteria,
          effectiveTags: story.effectiveTags,
          tasks: tasks
            .filter((task) => task.storyId === story.id)
            .sort(compareTaskRank)
            .map((task) => ({
              id: task.id,
              key: task.key,
              title: task.title,
              taskRank: task.taskRank,
              status: task.status,
              completedBeforeSprint:
                task.lifecycle !== 'active' || task.status === 'done',
              effectiveTags: task.effectiveTags,
            })),
        })),
      ),
    };
  }

  private async refreshReadySnapshot(): Promise<WorkIndexSnapshot> {
    await this.dependencies.index.refresh();
    const snapshot = this.dependencies.index.getSnapshot();
    if (snapshot.phase !== 'ready') {
      throw new Error('Focus Flow index must be ready before Sprint planning.');
    }
    return snapshot;
  }

  private enqueue(operation: () => Promise<void>): Promise<void> {
    const result = this.tail.then(operation);
    this.tail = result.catch(() => undefined);
    return result;
  }
}

function rankAtPosition<T extends Story>(
  ordered: readonly T[],
  position: StoryPosition,
  field: 'sprintRank' | 'backlogRank',
): string {
  const beforeIndex = position.beforeStoryId === null ? -1 : ordered.findIndex((story) => story.id === position.beforeStoryId);
  const afterIndex = position.afterStoryId === null ? ordered.length : ordered.findIndex((story) => story.id === position.afterStoryId);
  if (beforeIndex + 1 !== afterIndex) throw new Error('Story destination changed. Choose its position again.');
  const before = ordered[beforeIndex];
  const after = ordered[afterIndex];
  return generateKeyBetween(
    before === undefined ? null : before[field],
    after === undefined ? null : after[field],
  );
}

export function sprintDateBoundary(
  today: string,
  firstWeekday: number,
): { startsOn: string; dueOn: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) {
    throw new Error('Planning date must be a local ISO date.');
  }
  if (!Number.isInteger(firstWeekday) || firstWeekday < 0 || firstWeekday > 6) {
    throw new Error('First weekday must be between Sunday and Saturday.');
  }
  const date = new Date(`${today}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || isoDate(date) !== today) {
    throw new Error('Planning date must be a local ISO date.');
  }
  const daysSinceStart = (date.getUTCDay() - firstWeekday + 7) % 7;
  const starts = addDays(date, -daysSinceStart);
  return { startsOn: isoDate(starts), dueOn: isoDate(addDays(starts, 6)) };
}

function uniqueDraft(snapshot: WorkIndexSnapshot) {
  const open = openSprints(snapshot);
  if (open.length !== 1 || open[0]?.lifecycle !== 'draft') {
    throw new Error('Exactly one Draft Sprint is required.');
  }
  return open[0];
}

function openSprints(snapshot: WorkIndexSnapshot): Sprint[] {
  return snapshot.entities.filter(
    (entity): entity is Sprint =>
      entity.type === 'sprint' &&
      (entity.lifecycle === 'draft' || entity.lifecycle === 'active'),
  );
}

function uniqueStory(
  snapshot: WorkIndexSnapshot,
  storyId: string,
  lifecycle: Story['lifecycle'],
): Story {
  const matches = snapshot.entities.filter(
    (entity): entity is Story =>
      entity.type === 'story' &&
      entity.id === storyId &&
      entity.lifecycle === lifecycle,
  );
  if (matches.length !== 1) throw new Error('Story was not found.');
  return matches[0]!;
}

function draftStories(
  snapshot: WorkIndexSnapshot,
  draftId: string,
): Array<Story & { sprintRank: string }> {
  return snapshot.entities
    .filter(
      (entity): entity is Story & { sprintRank: string } =>
        entity.type === 'story' &&
        entity.lifecycle === 'draft_sprint' &&
        entity.sprintId === draftId &&
        entity.sprintRank !== null,
    )
    .sort(compareSprintRank);
}

function assertDraftMembership(story: Story, draftId: string): void {
  if (story.sprintId !== draftId || story.sprintRank === null) {
    throw new Error('Story does not belong to the Draft Sprint.');
  }
}

function draftStoryMutation(story: Story): DraftStoryMutation {
  if (story.backlogRank === null || story.sprintRank === null) {
    throw new Error('Draft Story ranks are incomplete.');
  }
  return {
    id: story.id,
    path: story.path,
    expectedBacklogRank: story.backlogRank,
    expectedSprintRank: story.sprintRank,
  };
}

function sprintReference(sprint: Sprint): DraftReference {
  return { id: sprint.id, path: sprint.path };
}

function nextSprintSequence(snapshot: WorkIndexSnapshot): number {
  return (
    snapshot.entities.reduce(
      (maximum, entity) =>
        entity.type === 'sprint' && entity.lifecycle !== 'draft'
          ? Math.max(maximum, entity.sequence)
          : maximum,
      0,
    ) + 1
  );
}

function compareSprintRank(
  left: Story & { sprintRank: string },
  right: Story & { sprintRank: string },
): number {
  return compareRank(left.sprintRank, right.sprintRank, left.id, right.id);
}

function compareTaskRank(left: Task, right: Task): number {
  return compareRank(left.taskRank, right.taskRank, left.id, right.id);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
