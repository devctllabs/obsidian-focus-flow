import { describe, expect, it, vi } from 'vitest';
import type {
  ProjectedManagedEntity,
  WorkIndexSnapshot,
} from '../indexing/work-index';
import {
  SprintPlanningService,
  type SprintPlanningPlan,
} from './plan-sprint';

const draftId = '01994744-a401-759a-b582-4418f2f2405f';
const epicId = '019946c9-5f97-7196-8483-73469275ff90';
const storyId = '019946f1-8d2a-7f05-87b1-1eebbb476300';

const draft: Extract<ProjectedManagedEntity, { type: 'sprint' }> = {
  id: draftId,
  type: 'sprint',
  lifecycle: 'draft',
  path: 'Focus Flow/Sprints/DRAFT.md',
};

function story(
  overrides: Partial<Extract<ProjectedManagedEntity, { type: 'story' }>> = {},
): Extract<ProjectedManagedEntity, { type: 'story' }> {
  return {
    id: storyId,
    key: 'FF-42',
    title: 'Improve weekly focus',
    type: 'story',
    lifecycle: 'backlog',
    epicId,
    epicLink: '[[Focus Flow/Epics/FF-40 Build a calmer system]]',
    backlogRank: 'a0',
    sprintId: null,
    sprintRank: null,
    acceptanceCriteria: [
      { text: 'Weekly priorities are visible', checked: false },
    ],
    createdAt: '2026-08-30T09:00:00Z',
    tags: ['story-tag'],
    effectiveTags: ['epic-tag', 'story-tag'],
    path: 'Focus Flow/Stories/FF-42 Improve weekly focus.md',
    ...overrides,
  };
}

function task(
  overrides: Partial<Extract<ProjectedManagedEntity, { type: 'task' }>> = {},
): Extract<ProjectedManagedEntity, { type: 'task' }> {
  return {
    id: '01994706-857c-76f1-8006-85cd9bd80890',
    key: 'FF-43',
    title: 'Prepare the review',
    type: 'task',
    lifecycle: 'active',
    storyId,
    storyLink: '[[Focus Flow/Stories/FF-42 Improve weekly focus]]',
    taskRank: 'a0',
    status: 'todo',
    startedAt: null,
    completedAt: null,
    createdAt: '2026-08-30T09:15:00Z',
    tags: [],
    effectiveTags: ['epic-tag', 'story-tag'],
    path: 'Focus Flow/Tasks/FF-43 Prepare the review.md',
    ...overrides,
  };
}

function closedSprint(
  overrides: Partial<
    Extract<ProjectedManagedEntity, { type: 'sprint'; lifecycle: 'closed' }>
  > = {},
): Extract<ProjectedManagedEntity, { type: 'sprint'; lifecycle: 'closed' }> {
  return {
    id: '01994744-a401-759a-b582-4418f2f24050',
    type: 'sprint',
    lifecycle: 'closed',
    code: 'SPR-004',
    sequence: 4,
    startsOn: '2026-08-17',
    dueOn: '2026-08-23',
    startedAt: '2026-08-17T08:00:00Z',
    closedAt: '2026-08-23T18:00:00Z',
    provisionalStoryOutcomes: [],
    startSnapshot: { capturedAt: '2026-08-17T08:00:00Z', stories: [] },
    closeSnapshot: {
      operationId: '01994a8a-0371-7a2d-a3e9-247990391600',
      capturedAt: '2026-08-23T18:00:00Z',
      stories: [],
      tasks: [],
      summary: {
        attemptedStories: 0,
        storiesAtStart: 0,
        storiesAtClose: 0,
        storiesAdded: 0,
        storiesRemoved: 0,
        achievedStories: 0,
        notAchievedStories: 0,
        closedStories: 0,
        committedOpenTasks: 0,
        tasksAtStart: 0,
        tasksAtClose: 0,
        tasksAdded: 0,
        tasksRemoved: 0,
        completedDuringSprint: 0,
        openAtClose: 0,
        exceptionCount: 0,
      },
      effectiveTagSummary: [],
    },
    path: 'Focus Flow/Sprints/SPR-004.md',
    ...overrides,
  };
}

function setup(entities: readonly ProjectedManagedEntity[]) {
  const snapshot: WorkIndexSnapshot = {
    phase: 'ready',
    diagnostics: [],
    entities,
  };
  const writer = {
    apply: vi
      .fn<(plan: SprintPlanningPlan) => Promise<void>>()
      .mockResolvedValue(undefined),
  };
  const index = {
    refresh: vi.fn().mockResolvedValue(undefined),
    getSnapshot: vi.fn(() => snapshot),
  };
  const hasher = { hash: vi.fn().mockResolvedValue('sha256:criteria') };
  const service = new SprintPlanningService({ writer, index, hasher, nextId: () => '01994770-0000-7000-8000-000000000001', clock: {
      now: () => '2026-08-30T12:00:00.000Z',
      today: () => '2026-08-30',
    },
    getFirstWeekday: () => 1,
    getScopePolicy: () => ({ mode: 'soft', limit: 28 }),
  });
  return { service, writer, index, hasher };
}

describe('SprintPlanningService', () => {
  it('creates the only Draft Sprint and refreshes the projection', async () => {
    const { service, writer, index } = setup([]);

    await service.createDraft();

    expect(writer.apply).toHaveBeenCalledWith({
      kind: 'create-draft',
      id: '01994770-0000-7000-8000-000000000001',
    });
    expect(index.refresh).toHaveBeenCalledTimes(2);
  });

  it('rejects a second Draft or Active Sprint', async () => {
    const { service, writer } = setup([draft]);

    await expect(service.createDraft()).rejects.toThrow(
      'A Draft or Active Sprint already exists.',
    );
    expect(writer.apply).not.toHaveBeenCalled();
  });

  it('selects a ready Story at the end of the Draft order', async () => {
    const available = story();
    const selected = story({
      id: '019946f1-8d2a-7f05-87b1-1eebbb476301',
      key: 'FF-44',
      lifecycle: 'draft_sprint',
      sprintId: draftId,
      sprintRank: 'a0',
      backlogRank: 'a1',
      path: 'Focus Flow/Stories/FF-44 Selected.md',
    });
    const { service, writer } = setup([draft, available, selected]);

    await service.addStory(available.id);

    expect(writer.apply).toHaveBeenCalledWith({
      kind: 'select-draft-story',
      draft: { id: draftId, path: draft.path },
      story: {
        id: available.id,
        path: available.path,
        expectedBacklogRank: 'a0',
        sprintRank: 'a1',
      },
    });
  });

  it('does not select a Story without Acceptance Criteria', async () => {
    const unavailable = story({ acceptanceCriteria: [] });
    const { service, writer } = setup([draft, unavailable]);

    await expect(service.addStory(unavailable.id)).rejects.toThrow(
      'Story needs Acceptance Criteria before Sprint selection.',
    );
    expect(writer.apply).not.toHaveBeenCalled();
  });

  it('returns one Story to its retained Month position', async () => {
    const selected = story({
      lifecycle: 'draft_sprint',
      sprintId: draftId,
      sprintRank: 'a0',
    });
    const { service, writer } = setup([draft, selected]);

    await service.removeStory(selected.id);

    expect(writer.apply).toHaveBeenCalledWith({
      kind: 'remove-draft-story',
      draft: { id: draftId, path: draft.path },
      story: {
        id: selected.id,
        path: selected.path,
        expectedBacklogRank: 'a0',
        expectedSprintRank: 'a0',
      },
    });
  });

  it('cancels the Draft by returning every selected Story', async () => {
    const first = story({
      lifecycle: 'draft_sprint',
      sprintId: draftId,
      sprintRank: 'a0',
    });
    const second = story({
      id: '019946f1-8d2a-7f05-87b1-1eebbb476301',
      key: 'FF-44',
      lifecycle: 'draft_sprint',
      sprintId: draftId,
      sprintRank: 'a1',
      backlogRank: 'a1',
      path: 'Focus Flow/Stories/FF-44 Selected.md',
    });
    const { service, writer } = setup([draft, second, first]);

    await service.cancelDraft();

    expect(writer.apply).toHaveBeenCalledWith({
      kind: 'cancel-draft',
      draft: { id: draftId, path: draft.path },
      stories: [
        {
          id: first.id,
          path: first.path,
          expectedBacklogRank: 'a0',
          expectedSprintRank: 'a0',
        },
        {
          id: second.id,
          path: second.path,
          expectedBacklogRank: 'a1',
          expectedSprintRank: 'a1',
        },
      ],
    });
  });

  it('starts an empty-Task Story with a typed Start Snapshot', async () => {
    const selected = story({
      lifecycle: 'draft_sprint',
      sprintId: draftId,
      sprintRank: 'a0',
    });
    const closed: Extract<ProjectedManagedEntity, { type: 'sprint' }> = {
      id: '01994744-a401-759a-b582-4418f2f24050',
      type: 'sprint',
      lifecycle: 'closed',
      code: 'SPR-004',
      sequence: 4,
      startsOn: '2026-08-17',
      dueOn: '2026-08-23',
      startedAt: '2026-08-17T08:00:00Z',
      closedAt: '2026-08-23T18:00:00Z',
      provisionalStoryOutcomes: [],
      startSnapshot: {
        capturedAt: '2026-08-17T08:00:00Z',
        stories: [],
      },
      closeSnapshot: {
        operationId: '01994a8a-0371-7a2d-a3e9-247990391600',
        capturedAt: '2026-08-23T18:00:00Z',
        stories: [],
        tasks: [],
        summary: {
          attemptedStories: 0,
          storiesAtStart: 0,
          storiesAtClose: 0,
          storiesAdded: 0,
          storiesRemoved: 0,
          achievedStories: 0,
          notAchievedStories: 0,
          closedStories: 0,
          committedOpenTasks: 0,
          tasksAtStart: 0,
          tasksAtClose: 0,
          tasksAdded: 0,
          tasksRemoved: 0,
          completedDuringSprint: 0,
          openAtClose: 0,
          exceptionCount: 0,
        },
        effectiveTagSummary: [],
      },
      path: 'Focus Flow/Sprints/SPR-004.md',
    };
    const { service, writer, hasher } = setup([draft, selected, closed]);

    await service.startDraft(false);

    expect(hasher.hash).toHaveBeenCalledWith(
      JSON.stringify(selected.acceptanceCriteria),
    );
    expect(writer.apply).toHaveBeenCalledWith({
      kind: 'start-sprint',
      draft: { id: draftId, path: draft.path },
      code: 'SPR-005',
      sequence: 5,
      startsOn: '2026-08-24',
      dueOn: '2026-08-30',
      startedAt: '2026-08-30T12:00:00.000Z',
      stories: [
        {
          id: selected.id,
          path: selected.path,
          expectedSprintRank: 'a0',
        },
      ],
      startSnapshot: {
        capturedAt: '2026-08-30T12:00:00.000Z',
        stories: [
          {
            id: selected.id,
            key: selected.key,
            title: selected.title,
            epicId,
            sprintRank: 'a0',
            acceptanceCriteriaHash: 'sha256:criteria',
            acceptanceCriteria: selected.acceptanceCriteria,
            effectiveTags: ['epic-tag', 'story-tag'],
            tasks: [],
          },
        ],
      },
    });
  });

  it('rejects a second commitment in the same calendar window', async () => {
    const selected = story({
      lifecycle: 'draft_sprint',
      sprintId: draftId,
      sprintRank: 'a0',
    });
    const prior = closedSprint({
      startsOn: '2026-08-24',
      dueOn: '2026-08-30',
    });
    const { service, writer } = setup([draft, selected, prior]);

    await expect(service.startDraft(false)).rejects.toThrow(
      'A Sprint already started for 2026-08-24.',
    );
    expect(writer.apply).not.toHaveBeenCalled();
  });

  it('requires confirmation when open Tasks exceed the soft scope limit', async () => {
    const selected = story({
      lifecycle: 'draft_sprint',
      sprintId: draftId,
      sprintRank: 'a0',
    });
    const context = setup([
      draft,
      selected,
      task(),
      task({
        id: '01994706-857c-76f1-8006-85cd9bd80891',
        key: 'FF-44',
        taskRank: 'a1',
        path: 'Focus Flow/Tasks/FF-44 Another.md',
      }),
    ]);
    const service = new SprintPlanningService({ writer: context.writer, index: context.index, hasher: context.hasher, nextId: () => 'unused', clock: {
        now: () => '2026-08-30T12:00:00.000Z',
        today: () => '2026-08-30',
      },
      getFirstWeekday: () => 1,
      getScopePolicy: () => ({ mode: 'soft', limit: 1 }),
    });

    await expect(service.startDraft(false)).rejects.toThrow(
      'Sprint scope confirmation is required.',
    );
    expect(context.writer.apply).not.toHaveBeenCalled();

    await service.startDraft(true);
    expect(context.writer.apply).toHaveBeenCalledOnce();
  });

  it('freezes prior Done Tasks as visible, non-committed context', async () => {
    const selected = story({
      lifecycle: 'draft_sprint',
      sprintId: draftId,
      sprintRank: 'a0',
    });
    const open = task();
    const done = task({
      id: '01994706-857c-76f1-8006-85cd9bd80891',
      key: 'FF-44',
      lifecycle: 'done',
      status: 'done',
      taskRank: 'a1',
      completedAt: '2026-08-29T18:00:00Z',
      path: 'Focus Flow/Tasks/FF-44 Already done.md',
    });
    const context = setup([draft, selected, done, open]);

    await context.service.startDraft(false);

    const applied = context.writer.apply.mock.calls[0]?.[0];
    expect(applied?.kind).toBe('start-sprint');
    if (applied?.kind !== 'start-sprint') throw new Error('Sprint did not start.');
    expect(
      applied.startSnapshot.stories[0]?.tasks.map((snapshotTask) => ({
        id: snapshotTask.id,
        completedBeforeSprint: snapshotTask.completedBeforeSprint,
      })),
    ).toEqual([
      { id: open.id, completedBeforeSprint: false },
      { id: done.id, completedBeforeSprint: true },
    ]);
  });
});
