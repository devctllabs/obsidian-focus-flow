import { generateKeyBetween } from 'fractional-indexing';
import { describe, expect, it, vi } from 'vitest';
import type { WorkIndexSnapshot } from '../indexing/work-index';
import {
  FocusBoardService,
  type TaskMovementWriter,
} from './focus-board';

const sprintId = '01994744-a401-759a-b582-4418f2f2405f';
const storyId = '019946f1-8d2a-7f05-87b1-1eebbb476300';
const movingTaskId = '01994706-857c-76f1-8006-85cd9bd80890';
const fixedNow = '2026-08-31T10:00:00.000Z';

function task(
  id: string,
  status:
    | 'todo'
    | 'tomorrow'
    | 'today'
    | 'in_progress'
    | 'external_in_progress'
    | 'done',
  taskRank: string,
  startedAt: string | null = null,
) {
  return {
    id,
    key: `FF-${id.at(-1)}`,
    title: `Task ${id.at(-1)}`,
    type: 'task' as const,
    lifecycle: status === 'done' ? ('done' as const) : ('active' as const),
    storyId,
    storyLink: '[[Focus Flow/Stories/FF-42 Improve weekly focus]]',
    taskRank,
    status,
    startedAt,
    completedAt: null,
    createdAt: '2026-08-30T09:15:00.000Z',
    tags: [],
    effectiveTags: [],
    path: `Focus Flow/Tasks/FF-${id.at(-1)} Task ${id.at(-1)}.md`,
  };
}

function snapshot(
  tasks: ReturnType<typeof task>[],
): WorkIndexSnapshot {
  return {
    phase: 'ready',
    diagnostics: [],
    entities: [
      {
        id: sprintId,
        type: 'sprint',
        lifecycle: 'active',
        code: 'SPR-001',
        sequence: 1,
        startsOn: '2026-08-31',
        dueOn: '2026-09-06',
        startedAt: '2026-08-31T08:00:00.000Z',
        provisionalStoryOutcomes: [],
        startSnapshot: { capturedAt: fixedNow, stories: [] },
        closedAt: null,
        closeSnapshot: null,
        path: 'Focus Flow/Sprints/SPR-001.md',
      },
      {
        id: storyId,
        key: 'FF-42',
        title: 'Improve weekly focus',
        type: 'story',
        lifecycle: 'active_sprint',
        epicId: '019946c9-5f97-7196-8483-73469275ff90',
        epicLink: '[[Focus Flow/Epics/FF-40 Build a calmer system]]',
        backlogRank: 'a0',
        sprintId,
        sprintRank: 'a0',
        acceptanceCriteria: [{ text: 'Focus is visible', checked: false }],
        createdAt: '2026-08-30T09:00:00.000Z',
        tags: [],
        effectiveTags: [],
        path: 'Focus Flow/Stories/FF-42 Improve weekly focus.md',
      },
      ...tasks,
    ],
  };
}

function setup(current: WorkIndexSnapshot) {
  const writer: TaskMovementWriter = { move: vi.fn().mockResolvedValue(undefined) };
  const index = {
    refresh: vi.fn().mockResolvedValue(undefined),
    getSnapshot: vi.fn(() => current),
  };
  const service = new FocusBoardService(
    writer,
    index,
    () => fixedNow,
    () => ({
      tomorrow: { mode: 'soft', limit: 7 },
      today: { mode: 'soft', limit: 7 },
      inProgress: { mode: 'soft', limit: 1 },
    }),
  );
  return { service, writer, index };
}

describe('FocusBoardService', () => {
  it('reorders within one status using the same canonical task_rank', async () => {
    const moving = task(movingTaskId, 'today', 'a0');
    const before = task('01994706-857c-76f1-8006-85cd9bd80891', 'today', 'a1');
    const after = task('01994706-857c-76f1-8006-85cd9bd80892', 'today', 'a2');
    const { service, writer } = setup(snapshot([moving, before, after]));

    await service.moveTask({
      taskId: moving.id,
      targetStatus: 'today',
      beforeTaskId: before.id,
      afterTaskId: after.id,
      confirmWipExcess: false,
    });

    expect(writer.move).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedStatus: 'today',
        replacementStatus: 'today',
        replacementTaskRank: generateKeyBetween('a1', 'a2'),
      }),
    );
  });

  it('moves an Active Sprint Task and sets its first started timestamp', async () => {
    const moving = task(movingTaskId, 'today', 'a1');
    const before = task('01994706-857c-76f1-8006-85cd9bd80891', 'in_progress', 'a0');
    const after = task('01994706-857c-76f1-8006-85cd9bd80892', 'in_progress', 'a2');
    const { service, writer, index } = setup(snapshot([moving, before, after]));

    await expect(
      service.moveTask({
        taskId: moving.id,
        targetStatus: 'in_progress',
        beforeTaskId: before.id,
        afterTaskId: after.id,
        confirmWipExcess: true,
      }),
    ).resolves.toEqual({ kind: 'moved' });

    expect(writer.move).toHaveBeenCalledWith({
      path: moving.path,
      id: moving.id,
      expectedLifecycle: 'active',
      replacementLifecycle: 'active',
      expectedStatus: 'today',
      replacementStatus: 'in_progress',
      expectedTaskRank: 'a1',
      replacementTaskRank: generateKeyBetween('a0', 'a2'),
      expectedStartedAt: null,
      replacementStartedAt: fixedNow,
      expectedCompletedAt: null,
      replacementCompletedAt: null,
    });
    expect(index.refresh).toHaveBeenCalledTimes(2);
  });

  it('keeps task_rank unique when another status occupies the target interval', async () => {
    const moving = task(movingTaskId, 'today', 'a3');
    const before = task('01994706-857c-76f1-8006-85cd9bd80891', 'in_progress', 'a0');
    const interleaved = task('01994706-857c-76f1-8006-85cd9bd80892', 'todo', 'a1');
    const after = task('01994706-857c-76f1-8006-85cd9bd80893', 'in_progress', 'a2');
    const { service, writer } = setup(
      snapshot([moving, before, interleaved, after]),
    );

    await service.moveTask({
      taskId: moving.id,
      targetStatus: 'in_progress',
      beforeTaskId: before.id,
      afterTaskId: after.id,
      confirmWipExcess: true,
    });

    expect(writer.move).toHaveBeenCalledWith(
      expect.objectContaining({
        replacementTaskRank: generateKeyBetween('a0', 'a1'),
      }),
    );
  });

  it('completes directly from Today without inventing started_at', async () => {
    const moving = task(movingTaskId, 'today', 'a0');
    const { service, writer } = setup(snapshot([moving]));

    await service.moveTask({
      taskId: moving.id,
      targetStatus: 'done',
      beforeTaskId: null,
      afterTaskId: null,
      confirmWipExcess: false,
    });

    expect(writer.move).toHaveBeenCalledWith(
      expect.objectContaining({
        replacementLifecycle: 'done',
        replacementStartedAt: null,
        replacementCompletedAt: fixedNow,
      }),
    );
  });

  it('completes directly from External In Progress and records completed_at', async () => {
    const moving = task(movingTaskId, 'external_in_progress', 'a0', fixedNow);
    const { service, writer } = setup(snapshot([moving]));

    await service.moveTask({
      taskId: moving.id,
      targetStatus: 'done',
      beforeTaskId: null,
      afterTaskId: null,
      confirmWipExcess: false,
    });

    expect(writer.move).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedStatus: 'external_in_progress',
        replacementLifecycle: 'done',
        replacementStartedAt: fixedNow,
        replacementCompletedAt: fixedNow,
      }),
    );
  });

  it('requires confirmation before exceeding a soft WIP limit', async () => {
    const moving = task(movingTaskId, 'today', 'a1');
    const occupied = task('01994706-857c-76f1-8006-85cd9bd80891', 'in_progress', 'a0');
    const { service, writer } = setup(snapshot([moving, occupied]));

    await expect(
      service.moveTask({
        taskId: moving.id,
        targetStatus: 'in_progress',
        beforeTaskId: occupied.id,
        afterTaskId: null,
        confirmWipExcess: false,
      }),
    ).resolves.toEqual({
      kind: 'confirmation-required',
      excess: 1,
      message: 'Moving to In Progress exceeds its WIP limit by 1.',
    });
    expect(writer.move).not.toHaveBeenCalled();
  });

  it('rejects a hard WIP violation without writing', async () => {
    const moving = task(movingTaskId, 'today', 'a1');
    const occupied = task('01994706-857c-76f1-8006-85cd9bd80891', 'in_progress', 'a0');
    const current = snapshot([moving, occupied]);
    const writer: TaskMovementWriter = { move: vi.fn() };
    const service = new FocusBoardService(
      writer,
      {
        refresh: vi.fn().mockResolvedValue(undefined),
        getSnapshot: () => current,
      },
      () => fixedNow,
      () => ({
        tomorrow: { mode: 'soft', limit: 7 },
        today: { mode: 'soft', limit: 7 },
        inProgress: { mode: 'hard', limit: 1 },
      }),
    );

    await expect(
      service.moveTask({
        taskId: moving.id,
        targetStatus: 'in_progress',
        beforeTaskId: occupied.id,
        afterTaskId: null,
        confirmWipExcess: true,
      }),
    ).resolves.toEqual({
      kind: 'rejected',
      message: 'In Progress has a hard WIP limit of 1.',
    });
    expect(writer.move).not.toHaveBeenCalled();
  });

  it('rejects an invalid transition and lists the allowed destinations', async () => {
    const moving = task(movingTaskId, 'todo', 'a0');
    const { service, writer } = setup(snapshot([moving]));

    await expect(
      service.moveTask({
        taskId: moving.id,
        targetStatus: 'done',
        beforeTaskId: null,
        afterTaskId: null,
        confirmWipExcess: false,
      }),
    ).resolves.toEqual({
      kind: 'rejected',
      message: 'FF-0 can move from TODO only to Tomorrow or Today.',
    });
    expect(writer.move).not.toHaveBeenCalled();
  });

  it('rejects Tasks outside the Active Sprint', async () => {
    const base = snapshot([task(movingTaskId, 'today', 'a0')]);
    const current: WorkIndexSnapshot = {
      ...base,
      entities: base.entities.map((entity) =>
        entity.type === 'story'
          ? {
              ...entity,
              lifecycle: 'backlog',
              sprintId: null,
              sprintRank: null,
            }
          : entity,
      ),
    };
    const { service, writer } = setup(current);

    await expect(
      service.moveTask({
        taskId: movingTaskId,
        targetStatus: 'done',
        beforeTaskId: null,
        afterTaskId: null,
        confirmWipExcess: false,
      }),
    ).rejects.toThrow('Task does not belong to the Active Sprint.');
    expect(writer.move).not.toHaveBeenCalled();
  });

  it('rejects a stale destination neighbor instead of treating it as an edge', async () => {
    const moving = task(movingTaskId, 'today', 'a1');
    const after = task('01994706-857c-76f1-8006-85cd9bd80892', 'in_progress', 'a2');
    const { service, writer } = setup(snapshot([moving, after]));

    await expect(
      service.moveTask({
        taskId: moving.id,
        targetStatus: 'in_progress',
        beforeTaskId: 'missing-task',
        afterTaskId: after.id,
        confirmWipExcess: true,
      }),
    ).rejects.toThrow('Task move target changed before the operation.');
    expect(writer.move).not.toHaveBeenCalled();
  });
});
