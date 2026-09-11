import { generateKeyBetween } from 'fractional-indexing';
import { compareRank } from '../../domain/ordering';
import { evaluateWip, type WipPolicy } from '../../domain/wip-policy';
import type {
  ProjectedManagedEntity,
  WorkIndex,
  WorkIndexSnapshot,
} from '../indexing/work-index';
import { activeSprintScope } from './sprint-scope';

type Story = Extract<ProjectedManagedEntity, { type: 'story' }>;
type Epic = Extract<ProjectedManagedEntity, { type: 'epic' }>;
type ActiveSprint = Extract<
  ProjectedManagedEntity,
  { type: 'sprint'; lifecycle: 'active' }
>;

export interface StoryPosition {
  beforeStoryId: string | null;
  afterStoryId: string | null;
}

export type ActiveStoryMembershipPlan =
  | {
      kind: 'add-active-story';
      story: StoryExpectation;
      sprintId: string;
      sprintRank: string;
    }
  | {
      kind: 'remove-active-story';
      story: StoryExpectation & { expectedSprintRank: string };
      sprint: { id: string; path: string };
      backlogRank: string;
    }
  | {
      kind: 'reparent-active-story';
      story: StoryExpectation;
      epicId: string;
      epicLink: string;
    };

interface StoryExpectation {
  id: string;
  path: string;
  expectedLifecycle: Story['lifecycle'];
  expectedEpicId: string;
  expectedBacklogRank: string | null;
}

export interface ActiveStoryMembershipWriter {
  apply(plan: ActiveStoryMembershipPlan): Promise<void>;
}

export type AddActiveStoryResult =
  | { kind: 'changed' }
  | { kind: 'confirmation-required'; excess: number; message: string }
  | { kind: 'rejected'; message: string };

export class ActiveStoryMembershipService {
  private tail: Promise<void> = Promise.resolve();

  constructor(
    private readonly writer: ActiveStoryMembershipWriter,
    private readonly index: Pick<WorkIndex, 'refresh' | 'getSnapshot'>,
    private readonly getScopePolicy: () => WipPolicy,
  ) {}

  add(
    storyId: string,
    position: StoryPosition,
    confirmScopeExcess = false,
  ): Promise<AddActiveStoryResult> {
    return this.enqueue(async () => {
      const snapshot = await this.readySnapshot();
      const sprint = uniqueActiveSprint(snapshot);
      const story = uniqueStory(snapshot, storyId);
      if (story.lifecycle !== 'backlog' || story.backlogRank === null) {
        throw new Error('Only a Month Backlog Story can join the Active Sprint.');
      }
      assertActiveParent(snapshot, story.epicId);
      if (story.acceptanceCriteria.length === 0) {
        throw new Error('Story needs Acceptance Criteria before Sprint selection.');
      }
      const sprintStories = activeStories(snapshot, sprint.id);
      const sprintRank = rankAtPosition(sprintStories, position, 'sprintRank');
      const currentScope = activeSprintScope(snapshot, sprint.id);
      if (currentScope === null) throw new Error('Active Sprint was not found.');
      const storyTaskIds = snapshot.entities
        .filter(
          (entity) =>
            entity.type === 'task' &&
            entity.storyId === story.id &&
            !completedByBoundary(entity.completedAt, sprint.startedAt),
        )
        .map((task) => task.id);
      const resultingCount = new Set([
        ...currentScope.taskIds,
        ...storyTaskIds,
      ]).size;
      const policy = this.getScopePolicy();
      const decision = evaluateWip(policy, resultingCount);
      if (decision.kind === 'reject') {
        return {
          kind: 'rejected',
          message: `Sprint scope has a hard WIP limit of ${policy.limit}.`,
        };
      }
      if (decision.kind === 'confirm' && !confirmScopeExcess) {
        return {
          kind: 'confirmation-required',
          excess: decision.excess,
          message: `Sprint scope exceeds its WIP limit by ${decision.excess}.`,
        };
      }
      await this.writer.apply({
        kind: 'add-active-story',
        story: expectation(story),
        sprintId: sprint.id,
        sprintRank,
      });
      await this.index.refresh();
      return { kind: 'changed' };
    });
  }

  remove(storyId: string, position: StoryPosition): Promise<void> {
    return this.enqueue(async () => {
      const snapshot = await this.readySnapshot();
      const sprint = uniqueActiveSprint(snapshot);
      const story = uniqueStory(snapshot, storyId);
      if (story.lifecycle === 'backlog') return;
      if (sprint.pendingClose != null) {
        throw new Error('Finish or resume Sprint close before changing Stories.');
      }
      if (
        story.lifecycle !== 'active_sprint' ||
        story.sprintId !== sprint.id ||
        story.sprintRank === null
      ) {
        throw new Error('Story is not part of the Active Sprint.');
      }
      assertActiveParent(snapshot, story.epicId);
      if (activeStories(snapshot, sprint.id).length === 1) {
        throw new Error('The last Active Sprint Story cannot be removed.');
      }
      const blocked = new Set(['tomorrow', 'today', 'in_progress']);
      if (
        snapshot.entities.some(
          (entity) =>
            entity.type === 'task' &&
            entity.storyId === story.id &&
            blocked.has(entity.status),
        )
      ) {
        throw new Error('Move focused Tasks out before returning this Story.');
      }
      const backlogStories = snapshot.entities
        .filter(
          (entity): entity is Story & { backlogRank: string } =>
            entity.type === 'story' &&
            entity.lifecycle === 'backlog' &&
            entity.backlogRank !== null,
        )
        .sort((left, right) => compareRank(
          left.backlogRank,
          right.backlogRank,
          left.id,
          right.id,
        ));
      await this.writer.apply({
        kind: 'remove-active-story',
        story: { ...expectation(story), expectedSprintRank: story.sprintRank },
        sprint: { id: sprint.id, path: sprint.path },
        backlogRank: rankAtPosition(backlogStories, position, 'backlogRank'),
      });
      await this.index.refresh();
    });
  }

  reparent(storyId: string, epicId: string): Promise<void> {
    return this.enqueue(async () => {
      const snapshot = await this.readySnapshot();
      const sprint = uniqueActiveSprint(snapshot);
      if (sprint.pendingClose != null) {
        throw new Error('Finish or resume Sprint close before changing Stories.');
      }
      const story = uniqueStory(snapshot, storyId);
      if (story.lifecycle !== 'active_sprint' || story.sprintId !== sprint.id) {
        throw new Error('Only an Active Sprint Story can be reparented here.');
      }
      const epic = assertActiveParent(snapshot, epicId);
      await this.writer.apply({
        kind: 'reparent-active-story',
        story: expectation(story),
        epicId: epic.id,
        epicLink: `[[${epic.path.replace(/\.md$/, '')}]]`,
      });
      await this.index.refresh();
    });
  }

  private async readySnapshot(): Promise<WorkIndexSnapshot> {
    await this.index.refresh();
    const snapshot = this.index.getSnapshot();
    if (snapshot.phase !== 'ready') {
      throw new Error('Focus Flow index must be ready before changing Stories.');
    }
    return snapshot;
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.tail.then(operation);
    this.tail = result.then(() => undefined, () => undefined);
    return result;
  }
}

function uniqueActiveSprint(snapshot: WorkIndexSnapshot): ActiveSprint {
  const matches = snapshot.entities.filter(
    (entity): entity is ActiveSprint =>
      entity.type === 'sprint' && entity.lifecycle === 'active',
  );
  if (matches.length !== 1) throw new Error('Exactly one Active Sprint is required.');
  return matches[0]!;
}

function uniqueStory(snapshot: WorkIndexSnapshot, id: string): Story {
  const matches = snapshot.entities.filter(
    (entity): entity is Story => entity.type === 'story' && entity.id === id,
  );
  if (matches.length !== 1) throw new Error('Story was not found.');
  return matches[0]!;
}

function assertActiveParent(snapshot: WorkIndexSnapshot, id: string): Epic {
  const matches = snapshot.entities.filter(
    (entity): entity is Epic => entity.type === 'epic' && entity.id === id,
  );
  const epic = matches.length === 1 ? matches[0] : undefined;
  if (epic?.lifecycle !== 'backlog') {
    throw new Error('Story requires an active Epic parent.');
  }
  return epic;
}

function activeStories(snapshot: WorkIndexSnapshot, sprintId: string) {
  return snapshot.entities
    .filter(
      (entity): entity is Story & { sprintRank: string } =>
        entity.type === 'story' &&
        entity.lifecycle === 'active_sprint' &&
        entity.sprintId === sprintId &&
        entity.sprintRank !== null,
    )
    .sort((left, right) => compareRank(
      left.sprintRank,
      right.sprintRank,
      left.id,
      right.id,
    ));
}

function rankAtPosition<T extends Story>(
  ordered: readonly T[],
  position: StoryPosition,
  field: 'sprintRank' | 'backlogRank',
): string {
  const beforeIndex = position.beforeStoryId === null
    ? -1
    : ordered.findIndex((story) => story.id === position.beforeStoryId);
  const afterIndex = position.afterStoryId === null
    ? ordered.length
    : ordered.findIndex((story) => story.id === position.afterStoryId);
  if (beforeIndex + 1 !== afterIndex) {
    throw new Error('Story destination changed. Choose its position again.');
  }
  const before = ordered[beforeIndex];
  const after = ordered[afterIndex];
  return generateKeyBetween(
    before === undefined ? null : before[field],
    after === undefined ? null : after[field],
  );
}

function completedByBoundary(completedAt: string | null, startedAt: string) {
  if (completedAt === null) return false;
  const completed = Date.parse(completedAt);
  const started = Date.parse(startedAt);
  return Number.isFinite(completed) && Number.isFinite(started) && completed <= started;
}

function expectation(story: Story): StoryExpectation {
  return {
    id: story.id,
    path: story.path,
    expectedLifecycle: story.lifecycle,
    expectedEpicId: story.epicId,
    expectedBacklogRank: story.backlogRank,
  };
}
