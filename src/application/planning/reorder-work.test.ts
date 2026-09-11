import { generateKeyBetween } from 'fractional-indexing';
import { describe, expect, it, vi } from 'vitest';
import type { WorkIndexSnapshot } from '../indexing/work-index';
import { PlanningReorderService } from './reorder-work';

const epicId = '019946c9-5f97-7196-8483-73469275ff90';
const storyId = '019946f1-8d2a-7f05-87b1-1eebbb476300';

function entity(
  overrides: {
    id: string;
    key: string;
    type: WorkIndexSnapshot['entities'][number]['type'];
  } & Record<string, unknown>,
): WorkIndexSnapshot['entities'][number] {
  const base = {
    title: overrides.key,
    createdAt: '2026-08-30T09:00:00Z',
    tags: [],
    effectiveTags: [],
    path: `Focus Flow/${overrides.key}.md`,
  };
  return {
    ...base,
    ...overrides,
  } as unknown as WorkIndexSnapshot['entities'][number];
}

const snapshot: WorkIndexSnapshot = {
  phase: 'ready',
  diagnostics: [],
  entities: [
    entity({
      id: epicId,
      key: 'FF-40',
      type: 'epic',
      lifecycle: 'backlog',
      backlogRank: 'a0',
    }),
    entity({
      id: '019946c9-5f97-7196-8483-73469275ff91',
      key: 'FF-41',
      type: 'epic',
      lifecycle: 'backlog',
      backlogRank: 'a1',
    }),
    entity({
      id: storyId,
      key: 'FF-42',
      type: 'story',
      lifecycle: 'backlog',
      epicId,
      epicLink: '[[Focus Flow/Epics/FF-40]]',
      backlogRank: 'a0',
      sprintId: null,
      sprintRank: null,
      acceptanceCriteria: [],
    }),
    entity({
      id: '019946f1-8d2a-7f05-87b1-1eebbb476301',
      key: 'FF-43',
      type: 'story',
      lifecycle: 'backlog',
      epicId,
      epicLink: '[[Focus Flow/Epics/FF-40]]',
      backlogRank: 'a1',
      sprintId: null,
      sprintRank: null,
      acceptanceCriteria: [],
    }),
    entity({
      id: '01994706-857c-76f1-8006-85cd9bd80890',
      key: 'FF-44',
      type: 'task',
      lifecycle: 'active',
      storyId,
      storyLink: '[[Focus Flow/Stories/FF-42]]',
      taskRank: 'a0',
      status: 'todo',
      startedAt: null,
      completedAt: null,
    }),
    entity({
      id: '01994706-857c-76f1-8006-85cd9bd80891',
      key: 'FF-45',
      type: 'task',
      lifecycle: 'active',
      storyId,
      storyLink: '[[Focus Flow/Stories/FF-42]]',
      taskRank: 'a1',
      status: 'todo',
      startedAt: null,
      completedAt: null,
    }),
  ],
};

function setup(current: WorkIndexSnapshot = snapshot) {
  const writer = { rebalanceRanks: vi.fn().mockResolvedValue(undefined) };
  const index = {
    refresh: vi.fn().mockResolvedValue(undefined),
    getSnapshot: vi.fn(() => current),
  };
  return { writer, index, service: new PlanningReorderService(writer, index) };
}

describe('PlanningReorderService', () => {
  it('moves an Epic within the Epic Backlog and refreshes the persisted projection', async () => {
    const { service, writer, index } = setup();

    await service.execute(epicId, 1);

    expect(writer.rebalanceRanks).toHaveBeenCalledWith({
      kind: 'rebalance-ranks',
      collectionLabel: 'the Epic Backlog',
      entries: [
        {
          path: 'Focus Flow/FF-40.md',
          id: epicId,
          field: 'backlog_rank',
          expectedValue: 'a0',
          replacementValue: generateKeyBetween('a1', null),
        },
      ],
    });
    expect(index.refresh).toHaveBeenCalledTimes(2);
  });

  it('moves a Story only within the Month Backlog', async () => {
    const { service, writer } = setup();

    await service.execute(storyId, 1);

    expect(writer.rebalanceRanks).toHaveBeenCalledWith(
      expect.objectContaining({
        collectionLabel: 'the Month Backlog',
        entries: [expect.objectContaining({ field: 'backlog_rank' })],
      }),
    );
  });

  it('moves a selected Story only within its Draft Sprint', async () => {
    const sprintId = '01994770-0000-7000-8000-000000000099';
    const first = entity({
      id: storyId,
      key: 'FF-42',
      type: 'story',
      lifecycle: 'draft_sprint',
      epicId,
      epicLink: '[[Focus Flow/Epics/FF-40]]',
      backlogRank: 'a0',
      sprintId,
      sprintRank: 'a0',
      acceptanceCriteria: [{ text: 'Ready', checked: false }],
    });
    const second = entity({
      id: '019946f1-8d2a-7f05-87b1-1eebbb476301',
      key: 'FF-43',
      type: 'story',
      lifecycle: 'draft_sprint',
      epicId,
      epicLink: '[[Focus Flow/Epics/FF-40]]',
      backlogRank: 'a1',
      sprintId,
      sprintRank: 'a1',
      acceptanceCriteria: [{ text: 'Ready', checked: false }],
    });
    const draft = {
      id: sprintId,
      type: 'sprint',
      lifecycle: 'draft',
      path: 'Focus Flow/Sprints/DRAFT.md',
    } as const;
    const { service, writer } = setup({
      phase: 'ready',
      diagnostics: [],
      entities: [draft, first, second],
    });

    await service.execute(storyId, 1);

    expect(writer.rebalanceRanks).toHaveBeenCalledWith(
      expect.objectContaining({
        collectionLabel: 'Stories for Draft Sprint',
        entries: [expect.objectContaining({ field: 'sprint_rank' })],
      }),
    );
  });

  it('moves a Task only among siblings of the same Story', async () => {
    const { service, writer } = setup();
    const taskId = '01994706-857c-76f1-8006-85cd9bd80890';

    await service.execute(taskId, 1);

    expect(writer.rebalanceRanks).toHaveBeenCalledWith(
      expect.objectContaining({
        collectionLabel: 'Tasks for FF-42',
        entries: [expect.objectContaining({ id: taskId, field: 'task_rank' })],
      }),
    );
  });

  it('does not write when the item stays in the same position', async () => {
    const { service, writer, index } = setup();

    await service.execute(epicId, 0);

    expect(writer.rebalanceRanks).not.toHaveBeenCalled();
    expect(index.refresh).toHaveBeenCalledOnce();
  });

  it('rejects Stories outside planning collections', async () => {
    const activeStory = entity({
      id: storyId,
      key: 'FF-42',
      type: 'story',
      lifecycle: 'done',
      epicId,
      epicLink: '[[Focus Flow/Epics/FF-40]]',
      backlogRank: null,
      sprintId: null,
      sprintRank: null,
      acceptanceCriteria: [],
    });
    const { service, writer } = setup({
      phase: 'ready',
      diagnostics: [],
      entities: [activeStory],
    });

    await expect(service.execute(storyId, 0)).rejects.toThrow(
      'Work item cannot be reordered in Plan.',
    );
    expect(writer.rebalanceRanks).not.toHaveBeenCalled();
  });

  it('rejects an out-of-range target instead of silently changing intent', async () => {
    const { service, writer } = setup();

    await expect(service.execute(epicId, 2)).rejects.toThrow(
      'Reorder target is outside the collection.',
    );
    expect(writer.rebalanceRanks).not.toHaveBeenCalled();
  });
});
