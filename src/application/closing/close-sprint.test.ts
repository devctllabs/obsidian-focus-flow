import { describe, expect, it, vi } from 'vitest';
import type {
  ProjectedManagedEntity,
  WorkIndexSnapshot,
} from '../indexing/work-index';
import type { SprintClosePlan } from '../../domain/sprint-close';
import { SprintCloseService, type CloseSprintRequest } from './close-sprint';

const sprintId = '01994744-a401-759a-b582-4418f2f2405f';
const epicId = '019946c9-5f97-7196-8483-73469275ff90';
const ids = {
  achieved: '019946f1-8d2a-7f05-87b1-1eebbb476300',
  continuing: '019946f1-8d2a-7f05-87b1-1eebbb476301',
  closed: '019946f1-8d2a-7f05-87b1-1eebbb476302',
  exception: '019946f1-8d2a-7f05-87b1-1eebbb476303',
  achievedTask: '01994706-857c-76f1-8006-85cd9bd80890',
  continuingTask: '01994706-857c-76f1-8006-85cd9bd80891',
};

function story(
  id: string,
  rank: string,
  checked = true,
): Extract<ProjectedManagedEntity, { type: 'story' }> {
  return {
    id,
    key: `FF-${Number(rank.slice(1)) + 42}`,
    title: `Story ${rank}`,
    type: 'story',
    lifecycle: 'active_sprint',
    epicId,
    epicLink: '[[Focus Flow/Epics/FF-40 Product]]',
    backlogRank: rank,
    sprintId,
    sprintRank: rank,
    acceptanceCriteria: [{ text: 'Works', checked }],
    createdAt: '2026-08-20T09:00:00Z',
    tags: [],
    effectiveTags: ['product/focus-flow'],
    path: `Focus Flow/Stories/FF-42 Story ${rank}.md`,
  };
}

function task(
  id: string,
  storyId: string,
  rank: string,
): Extract<ProjectedManagedEntity, { type: 'task' }> {
  return {
    id,
    key: `FF-${Number(rank.slice(1)) + 50}`,
    title: `Task ${rank}`,
    type: 'task',
    lifecycle: 'active',
    storyId,
    storyLink: '[[Focus Flow/Stories/Parent]]',
    taskRank: rank,
    status: 'in_progress',
    startedAt: '2026-08-27T09:00:00Z',
    completedAt: null,
    createdAt: '2026-08-20T09:00:00Z',
    tags: [],
    effectiveTags: ['product/focus-flow'],
    path: `Focus Flow/Tasks/FF-50 Task ${rank}.md`,
  };
}

function fixture(): readonly ProjectedManagedEntity[] {
  return [
    {
      id: sprintId,
      type: 'sprint',
      lifecycle: 'active',
      code: 'SPR-014',
      sequence: 14,
      startsOn: '2026-08-24',
      dueOn: '2026-08-30',
      startedAt: '2026-08-24T08:30:00Z',
      closedAt: null,
      provisionalStoryOutcomes: [
        outcome(ids.achieved, 'achieved'),
        outcome(ids.continuing, 'not_achieved'),
        outcome(ids.closed, 'closed'),
        outcome(ids.exception, 'achieved', 'One edge case is deferred.'),
      ],
      startSnapshot: {
        capturedAt: '2026-08-24T08:30:00Z',
        stories: [
          {
            id: ids.achieved,
            key: 'FF-42',
            title: 'Story a0',
            epicId,
            sprintRank: 'a0',
            acceptanceCriteriaHash: `sha256:${'a'.repeat(64)}`,
            acceptanceCriteria: [{ text: 'Works', checked: false }],
            effectiveTags: ['product/focus-flow'],
            tasks: [
              {
                id: ids.achievedTask,
                key: 'FF-50',
                title: 'Task a0',
                taskRank: 'a0',
                status: 'in_progress',
                completedBeforeSprint: false,
                effectiveTags: ['product/focus-flow'],
              },
            ],
          },
        ],
      },
      closeSnapshot: null,
      path: 'Focus Flow/Sprints/SPR-014.md',
    },
    story(ids.achieved, 'a0'),
    story(ids.continuing, 'a1'),
    story(ids.closed, 'a2'),
    story(ids.exception, 'a3', false),
    task(ids.achievedTask, ids.achieved, 'a0'),
    task(ids.continuingTask, ids.continuing, 'a1'),
  ];
}

function outcome(
  storyId: string,
  value: 'achieved' | 'not_achieved' | 'closed',
  exception: string | null = null,
) {
  return {
    storyId,
    evaluatedAt: '2026-08-30T17:00:00Z',
    outcome: value,
    evidence: `Evidence for ${value}.`,
    acceptanceExceptionReason: exception,
  } as const;
}

function request(): CloseSprintRequest {
  return {
    storyReinsertions: [{ storyId: ids.continuing, beforeStoryId: null }],
    taskDecisions: [
      {
        taskId: ids.achievedTask,
        resolution: 'irrelevant',
      },
      {
        taskId: ids.continuingTask,
        resolution: 'continue',
        continuationContext: 'Resume from the device verification.',
      },
    ],
  };
}

function setup(entities = fixture()) {
  const snapshot: WorkIndexSnapshot = {
    phase: 'ready',
    diagnostics: [],
    entities,
  };
  const writer = {
    apply: vi.fn<(plan: SprintClosePlan) => Promise<void>>(),
  };
  const index = {
    refresh: vi.fn().mockResolvedValue(undefined),
    getSnapshot: vi.fn(() => snapshot),
  };
  const service = new SprintCloseService({ writer, index, hasher: { hash: vi.fn().mockResolvedValue('sha256:reviewed-decisions') }, nextId: () => '01994a8a-0371-7a2d-a3e9-247990391600', now: () => '2026-08-30T18:00:00Z' });
  return { service, writer, index };
}

describe('SprintCloseService', () => {
  it('can move unfinished work to an accepted Story still held in its Epic', async () => {
    const target = { ...story('019946f1-8d2a-7f05-87b1-1eebbb476399', 'a9'), lifecycle: 'epic_backlog' as const, backlogRank: null, sprintId: null, sprintRank: null };
    const { service, writer } = setup([...fixture(), target]);
    const change = request();
    await service.close({ ...change, taskDecisions: change.taskDecisions.map((decision) => decision.taskId === ids.achievedTask ? { taskId: decision.taskId, resolution: 'move', targetStoryId: target.id } : decision) });
    expect(writer.apply.mock.calls[0]![0].tasks.find((task) => task.id === ids.achievedTask)?.targetStoryId).toBe(target.id);
  });
  it('closes with empty optional Story reflections while preserving required decisions', async () => {
    const data = fixture();
    const sprint = data.find((entity) => entity.type === 'sprint');
    if (!sprint || sprint.lifecycle !== 'active') throw new Error();
    sprint.provisionalStoryOutcomes = sprint.provisionalStoryOutcomes.map((entry) => ({ ...entry, evidence: '' }));
    const { service, writer } = setup(data);
    await service.close(request());
    expect(writer.apply.mock.calls[0]![0].closeSnapshot.stories.every((entry) => entry.evidence === '')).toBe(true);
  });

  it('builds one frozen plan for all outcomes and explicit Task decisions', async () => {
    const { service, writer, index } = setup();

    await service.close(request());

    const plan = writer.apply.mock.calls[0]?.[0];
    expect(plan).toMatchObject({
      operationId: '01994a8a-0371-7a2d-a3e9-247990391600',
      decisionsHash: 'sha256:reviewed-decisions',
      sprintId,
      stories: [
        { id: ids.achieved, outcome: 'achieved', backlogRank: null },
        { id: ids.continuing, outcome: 'not_achieved' },
        { id: ids.closed, outcome: 'closed', backlogRank: null },
        {
          id: ids.exception,
          outcome: 'achieved',
          acceptanceExceptionReason: 'One edge case is deferred.',
        },
      ],
      tasks: [
        { id: ids.achievedTask, resolution: 'irrelevant' },
        {
          id: ids.continuingTask,
          resolution: 'continue',
          targetStoryId: ids.continuing,
          continuationContext: 'Resume from the device verification.',
        },
      ],
      delta: {
        addedStories: [
          expect.objectContaining({ id: ids.continuing }),
          expect.objectContaining({ id: ids.closed }),
          expect.objectContaining({ id: ids.exception }),
        ],
        removedStories: [],
        addedTasks: [expect.objectContaining({ id: ids.continuingTask })],
        removedTasks: [],
        changedAcceptanceCriteriaStories: [],
      },
      closeSnapshot: {
        summary: {
          attemptedStories: 4,
          storiesAtStart: 1,
          storiesAtClose: 4,
          storiesAdded: 3,
          storiesRemoved: 0,
          achievedStories: 2,
          notAchievedStories: 1,
          closedStories: 1,
          committedOpenTasks: 1,
          tasksAtStart: 1,
          tasksAtClose: 2,
          tasksAdded: 1,
          tasksRemoved: 0,
          completedDuringSprint: 0,
          openAtClose: 2,
          exceptionCount: 1,
        },
      },
    });
    expect(plan?.stories[1]?.backlogRank).toEqual(expect.any(String));
    expect(index.refresh).toHaveBeenCalledTimes(2);
  });

  it('writes nothing until every Story and unfinished Task has a decision', async () => {
    const missingEvaluation = fixture().map((entity) =>
      entity.type === 'sprint' && entity.lifecycle === 'active'
        ? {
            ...entity,
            provisionalStoryOutcomes: entity.provisionalStoryOutcomes.slice(1),
          }
        : entity,
    );
    const first = setup(missingEvaluation);
    await expect(first.service.close(request())).rejects.toThrow(
      'Every Active Sprint Story must be evaluated.',
    );
    expect(first.writer.apply).not.toHaveBeenCalled();

    const second = setup();
    await expect(
      second.service.close({ ...request(), taskDecisions: [] }),
    ).rejects.toThrow('Every unfinished Task needs a close decision.');
    expect(second.writer.apply).not.toHaveBeenCalled();
  });

  it('never carries a not-achieved Story over without explicit Month reinsertion', async () => {
    const { service, writer } = setup();

    await expect(
      service.close({ ...request(), storyReinsertions: [] }),
    ).rejects.toThrow('Every continuing Story needs a Month position.');
    expect(writer.apply).not.toHaveBeenCalled();
  });

  it('resumes exactly the frozen pending_close plan after reload', async () => {
    const initial = setup();
    await initial.service.close(request());
    const frozen = initial.writer.apply.mock.calls[0]![0];
    const interrupted = fixture().map((entity) =>
      entity.type === 'sprint' && entity.lifecycle === 'active'
        ? { ...entity, pendingClose: frozen }
        : entity,
    );
    const resumed = setup(interrupted);

    await resumed.service.resume();

    expect(resumed.writer.apply).toHaveBeenCalledWith(frozen);
    expect(resumed.index.refresh).toHaveBeenCalledTimes(2);
    await expect(resumed.service.close(request())).rejects.toThrow(
      'Sprint close is pending; resume it instead.',
    );
  });

  it('resumes a frozen Close after the Sprint reached Closed state', async () => {
    const initial = setup();
    await initial.service.close(request());
    const frozen = initial.writer.apply.mock.calls[0]![0];
    const interrupted = fixture().map((entity) =>
      entity.type === 'sprint' && entity.lifecycle === 'active'
        ? {
            ...entity,
            lifecycle: 'closed' as const,
            closedAt: frozen.capturedAt,
            closeSnapshot: frozen.closeSnapshot,
            pendingClose: frozen,
            path: 'Focus Flow/Sprints/Archive/2026/08/SPR-014.md',
          }
        : entity,
    );
    const resumed = setup(interrupted);

    await resumed.service.resume();

    expect(resumed.writer.apply).toHaveBeenCalledWith(frozen);
    expect(resumed.index.refresh).toHaveBeenCalledTimes(2);
  });

  it('revalidates externally edited criteria and refreshes after an interrupted write', async () => {
    const invalid = fixture().map((entity) =>
      entity.type === 'sprint' && entity.lifecycle === 'active'
        ? {
            ...entity,
            provisionalStoryOutcomes: entity.provisionalStoryOutcomes.map(
              (outcome) =>
                outcome.storyId === ids.exception
                  ? { ...outcome, acceptanceExceptionReason: null }
                  : outcome,
            ),
          }
        : entity,
    );
    const rejected = setup(invalid);
    await expect(rejected.service.close(request())).rejects.toThrow(
      'Unchecked Acceptance Criteria need an exception.',
    );
    expect(rejected.writer.apply).not.toHaveBeenCalled();

    const interrupted = setup();
    interrupted.writer.apply.mockRejectedValueOnce(new Error('interrupted'));
    await expect(interrupted.service.close(request())).rejects.toThrow(
      'interrupted',
    );
    expect(interrupted.index.refresh).toHaveBeenCalledTimes(2);
  });
});
