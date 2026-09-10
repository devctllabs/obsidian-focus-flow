import { describe, expect, it, vi } from 'vitest';
import type { WorkIndexSnapshot } from '../indexing/work-index';
import {
  ActiveStoryMembershipService,
  type ActiveStoryMembershipWriter,
} from './active-story-membership';

const sprintId = '01994770-0000-7000-8000-000000000099';
const epicId = '019946c9-5f97-7196-8483-73469275ff90';
const storyA = '019946f1-8d2a-7f05-87b1-1eebbb476300';
const storyB = '019946f1-8d2a-7f05-87b1-1eebbb476301';
const storyC = '019946f1-8d2a-7f05-87b1-1eebbb476302';

describe('ActiveStoryMembershipService', () => {
  it('requires soft Scope confirmation and writes the explicit Sprint position', async () => {
    const snapshot = fixture();
    const writer = { apply: vi.fn().mockResolvedValue(undefined) };
    const service = serviceFor(snapshot, writer, { mode: 'soft', limit: 1 });

    await expect(service.add(storyB, { beforeStoryId: storyA, afterStoryId: storyC }))
      .resolves.toEqual({
        kind: 'confirmation-required',
        excess: 1,
        message: 'Sprint scope exceeds its WIP limit by 1.',
      });
    expect(writer.apply).not.toHaveBeenCalled();

    await expect(service.add(
      storyB,
      { beforeStoryId: storyA, afterStoryId: storyC },
      true,
    )).resolves.toEqual({ kind: 'changed' });
    expect(writer.apply).toHaveBeenCalledOnce();
    expect(writer.apply.mock.calls[0]?.[0]).toMatchObject({
      kind: 'add-active-story',
      sprintId,
      story: { id: storyB },
    });
  });

  it('returns an Active Story to an explicit Month position', async () => {
    const snapshot = fixture();
    const writer = { apply: vi.fn().mockResolvedValue(undefined) };
    const service = serviceFor(snapshot, writer, { mode: 'off', limit: 1 });

    await service.remove(storyA, { beforeStoryId: null, afterStoryId: storyB });

    expect(writer.apply).toHaveBeenCalledOnce();
    expect(writer.apply.mock.calls[0]?.[0]).toMatchObject({
      kind: 'remove-active-story',
      sprint: { id: sprintId, path: 'Focus Flow/Sprints/SPR-1.md' },
      story: { id: storyA, expectedSprintRank: 'a0' },
    });
  });

  it('rejects removal of focused work and permits repair away from a terminal Epic', async () => {
    const snapshot = fixture('today');
    const terminalEpic = snapshot.entities.find(
      (entity) => entity.type === 'epic' && entity.id === epicId,
    )!;
    const modified = {
      ...snapshot,
      entities: snapshot.entities.map((entity) =>
        entity.id === epicId ? { ...terminalEpic, lifecycle: 'done' as const } : entity,
      ),
    } as WorkIndexSnapshot;
    const writer: ActiveStoryMembershipWriter = {
      apply: vi.fn().mockResolvedValue(undefined),
    };
    const service = serviceFor(modified, writer, { mode: 'off', limit: 1 });

    await expect(service.remove(storyA, { beforeStoryId: null, afterStoryId: storyB }))
      .rejects.toThrow('active Epic parent');
    await expect(service.reparent(storyA, '019946c9-5f97-7196-8483-73469275ff91'))
      .resolves.toBeUndefined();
  });

  it('rejects hard Scope excess without writing', async () => {
    const writer = { apply: vi.fn().mockResolvedValue(undefined) };
    const service = serviceFor(fixture(), writer, { mode: 'hard', limit: 1 });

    await expect(service.add(
      storyB,
      { beforeStoryId: storyA, afterStoryId: storyC },
    )).resolves.toEqual({
      kind: 'rejected',
      message: 'Sprint scope has a hard WIP limit of 1.',
    });
    expect(writer.apply).not.toHaveBeenCalled();
  });

  it('rejects missing Acceptance Criteria and stale explicit neighbours', async () => {
    const base = fixture();
    const missingCriteria: WorkIndexSnapshot = {
      ...base,
      entities: base.entities.map((entity) =>
        entity.id === storyB && entity.type === 'story'
          ? { ...entity, acceptanceCriteria: [] }
          : entity,
      ),
    };
    const writer = { apply: vi.fn().mockResolvedValue(undefined) };
    await expect(
      serviceFor(missingCriteria, writer, { mode: 'off', limit: 1 }).add(
        storyB,
        { beforeStoryId: storyA, afterStoryId: storyC },
      ),
    ).rejects.toThrow('needs Acceptance Criteria');
    await expect(
      serviceFor(base, writer, { mode: 'off', limit: 1 }).add(storyB, {
        beforeStoryId: 'stale-story',
        afterStoryId: storyC,
      }),
    ).rejects.toThrow('destination changed');
    expect(writer.apply).not.toHaveBeenCalled();
  });

  it('rejects removal while a Story has a focused Task', async () => {
    const writer = { apply: vi.fn().mockResolvedValue(undefined) };
    const service = serviceFor(fixture('today'), writer, {
      mode: 'off',
      limit: 1,
    });

    await expect(service.remove(storyA, {
      beforeStoryId: null,
      afterStoryId: storyB,
    })).rejects.toThrow('Move focused Tasks out');
    expect(writer.apply).not.toHaveBeenCalled();
  });

  it('accepts an already-applied Month end state on removal retry', async () => {
    const base = fixture();
    const alreadyRemoved: WorkIndexSnapshot = {
      ...base,
      entities: base.entities.map((entity) =>
        entity.id === storyA && entity.type === 'story'
          ? {
              ...entity,
              lifecycle: 'backlog',
              backlogRank: 'a2',
              sprintId: null,
              sprintRank: null,
            }
          : entity,
      ),
    };
    const writer = { apply: vi.fn().mockResolvedValue(undefined) };
    const service = serviceFor(alreadyRemoved, writer, {
      mode: 'off',
      limit: 1,
    });

    await expect(service.remove(storyA, {
      beforeStoryId: storyB,
      afterStoryId: null,
    })).resolves.toBeUndefined();
    expect(writer.apply).not.toHaveBeenCalled();
  });
});

function serviceFor(
  snapshot: WorkIndexSnapshot,
  writer: ActiveStoryMembershipWriter,
  policy: { mode: 'off' | 'soft' | 'hard'; limit: number },
) {
  return new ActiveStoryMembershipService(
    writer,
    {
      refresh: vi.fn().mockResolvedValue(undefined),
      getSnapshot: vi.fn(() => snapshot),
    },
    () => policy,
  );
}

function fixture(activeTaskStatus: 'todo' | 'today' = 'todo'): WorkIndexSnapshot {
  const activeStory = story(storyA, 'active_sprint', null, 'a0');
  const backlogStory = story(storyB, 'backlog', 'a0', null);
  return {
    phase: 'ready',
    diagnostics: [],
    entities: [
      epic(epicId),
      epic('019946c9-5f97-7196-8483-73469275ff91'),
      sprint(),
      activeStory,
      story(storyC, 'active_sprint', null, 'a1'),
      backlogStory,
      task('task-active', storyA, activeTaskStatus, null),
      task('task-backlog', storyB, 'todo', null),
    ],
  };
}

function epic(id: string) {
  return {
    id,
    key: id.endsWith('90') ? 'FF-1' : 'FF-2',
    title: 'Epic',
    type: 'epic' as const,
    lifecycle: 'backlog' as const,
    backlogRank: id,
    createdAt: '2026-08-01T00:00:00Z',
    tags: [],
    effectiveTags: [],
    path: `Focus Flow/Epics/${id}.md`,
  };
}

function story(
  id: string,
  lifecycle: 'backlog' | 'active_sprint',
  backlogRank: string | null,
  sprintRank: string | null,
) {
  return {
    id,
    key: id === storyA ? 'FF-3' : id === storyB ? 'FF-4' : 'FF-7',
    title: 'Story',
    type: 'story' as const,
    lifecycle,
    epicId,
    epicLink: '[[Focus Flow/Epics/FF-1 Epic]]',
    backlogRank,
    sprintId: lifecycle === 'active_sprint' ? sprintId : null,
    sprintRank,
    acceptanceCriteria: [{ text: 'Works', checked: false }],
    createdAt: '2026-08-02T00:00:00Z',
    tags: [],
    effectiveTags: [],
    path: `Focus Flow/Stories/${id}.md`,
  };
}

function task(id: string, storyId: string, status: 'todo' | 'today', completedAt: null) {
  return {
    id,
    key: id === 'task-active' ? 'FF-5' : 'FF-6',
    title: 'Task',
    type: 'task' as const,
    lifecycle: 'active' as const,
    storyId,
    storyLink: '[[Story]]',
    taskRank: id,
    status,
    startedAt: null,
    completedAt,
    createdAt: '2026-08-03T00:00:00Z',
    tags: [],
    effectiveTags: [],
    path: `Focus Flow/Tasks/${id}.md`,
  };
}

function sprint() {
  return {
    id: sprintId,
    type: 'sprint' as const,
    lifecycle: 'active' as const,
    code: 'SPR-1',
    sequence: 1,
    startsOn: '2026-08-01',
    dueOn: '2026-08-07',
    startedAt: '2026-08-01T08:00:00Z',
    closedAt: null,
    provisionalStoryOutcomes: [],
    startSnapshot: {
      capturedAt: '2026-08-01T08:00:00Z',
      stories: [{
        id: storyA,
        key: 'FF-3',
        title: 'Story',
        epicId,
        sprintRank: 'a0',
        acceptanceCriteriaHash: `sha256:${'a'.repeat(64)}`,
        acceptanceCriteria: [],
        effectiveTags: [],
        tasks: [],
      }],
    },
    closeSnapshot: null,
    path: 'Focus Flow/Sprints/SPR-1.md',
  };
}
