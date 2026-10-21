import { generateKeyBetween } from 'fractional-indexing';
import { describe, expect, it, vi } from 'vitest';
import type { WorkIndexSnapshot } from '../indexing/work-index';
import { PlanningReorderService } from './reorder-work';
import { compareOrdinal } from '../../domain/ordering';
import { inboxCandidates } from '../../domain/inbox-order';
import type { RankRepairPlan } from '../../domain/work-note';

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
  it('reorders Distractions by their own ranks while preserving the unranked rejection-date order', async () => {
    const current: WorkIndexSnapshot = { phase: 'ready', diagnostics: [], entities: [
      entity({ type: 'candidate', lifecycle: 'inbox', id: 'inbox', key: 'FF-1', inboxRank: 'a0' }),
      entity({ type: 'candidate', lifecycle: 'rejected', id: 'old', key: 'FF-2', rejectedAt: '2026-08-30T10:00:00Z', rejectionReason: null, distractionRank: null }),
      entity({ type: 'candidate', lifecycle: 'rejected', id: 'new', key: 'FF-3', rejectedAt: '2026-09-01T10:00:00Z', rejectionReason: null, distractionRank: null }),
      entity({ type: 'candidate', lifecycle: 'rejected', id: 'ranked', key: 'FF-4', rejectedAt: '2026-08-29T10:00:00Z', rejectionReason: null, distractionRank: 'a0' }),
    ] };
    const writer = { rebalanceRanks: vi.fn(async (plan: RankRepairPlan) => {
      for (const entry of plan.entries) {
        expect(entry.field).toBe('distraction_rank');
        current.entities = current.entities.map((item) => item.id === entry.id ? { ...item, distractionRank: entry.replacementValue } as typeof item : item);
      }
    }) };
    const { service } = setup(current);
    const actual = new PlanningReorderService(writer, { refresh: async () => undefined, getSnapshot: () => current });
    await actual.execute('old', 0);
    expect(writer.rebalanceRanks.mock.calls[0]![0]).toMatchObject({ collectionLabel: 'Distractions', entries: [{ id: 'old', expectedValue: null, replacementValue: 'Zz' }] });
    await actual.execute('old', 2);
    const rejected = current.entities.filter((item) => item.type === 'candidate' && item.lifecycle === 'rejected');
    expect(rejected.sort((a, b) => compareOrdinal(a.distractionRank!, b.distractionRank!)).map((item) => item.id)).toEqual(['ranked', 'new', 'old']);
    expect(current.entities[0]).toMatchObject({ inboxRank: 'a0' });
    await expect(service.execute('old', 3)).rejects.toThrow('outside the collection');
  });

  function inboxSetup() {
    const current: WorkIndexSnapshot = {
      phase: 'ready', diagnostics: [], entities: [
        entity({ type: 'candidate', lifecycle: 'inbox', id: 'legacy-2', key: 'FF-2', inboxRank: null }),
        entity({ type: 'candidate', lifecycle: 'inbox', id: 'ranked', key: 'FF-3', inboxRank: 'a0' }),
        entity({ type: 'candidate', lifecycle: 'inbox', id: 'legacy-1', key: 'FF-1', inboxRank: null }),
        entity({ type: 'candidate', lifecycle: 'rejected', distractionRank: null, id: 'rejected', key: 'FF-4', rejectedAt: '2026-09-01T10:00:00Z', rejectionReason: null }),
      ],
    };
    const index = { refresh: vi.fn(), getSnapshot: () => current };
    const applyEntry = (entry: RankRepairPlan['entries'][number]) => {
      current.entities = current.entities.map((item) => item.id === entry.id ? { ...item, inboxRank: entry.replacementValue } as typeof item : item);
    };
    const writer = { rebalanceRanks: vi.fn(async (plan: RankRepairPlan) => { plan.entries.forEach(applyEntry); }) };
    const service = new PlanningReorderService(writer, index);
    const order = () => inboxCandidates(current.entities).map((item) => item.id);
    return { current, index, writer, service, order, applyEntry };
  }

  it('moves a legacy Candidate to top with one note write and preserves the legacy suffix', async () => {
    const { service, writer, order } = inboxSetup();
    await service.execute('legacy-2', 0);
    expect(order()).toEqual(['legacy-2', 'ranked', 'legacy-1']);
    expect(writer.rebalanceRanks).toHaveBeenCalledOnce();
    expect(writer.rebalanceRanks.mock.calls[0]![0].entries).toEqual([
      expect.objectContaining({ id: 'legacy-2', field: 'inbox_rank', expectedValue: null, replacementValue: 'Zz' }),
    ]);
  });

  it('materializes the legacy suffix in order before moving within the complete Inbox', async () => {
    const { service, writer, order, current } = inboxSetup();
    await service.execute('legacy-2', 1);
    expect(order()).toEqual(['ranked', 'legacy-2', 'legacy-1']);
    expect(current.entities.find((item) => item.id === 'rejected')).not.toHaveProperty('inboxRank');
    writer.rebalanceRanks.mockClear();
    await service.execute('ranked', 2);
    expect(order()).toEqual(['legacy-2', 'legacy-1', 'ranked']);
    expect(writer.rebalanceRanks.mock.calls[0]![0].entries).toHaveLength(1);
  });

  it('keeps order after interrupted legacy initialization and completes on retry', async () => {
    const { service, writer, order, applyEntry } = inboxSetup();
    writer.rebalanceRanks.mockImplementationOnce(async (plan) => {
      applyEntry(plan.entries[0]!);
      throw new Error('Write interrupted');
    });
    await expect(service.execute('ranked', 2)).rejects.toThrow('Write interrupted');
    expect(order()).toEqual(['ranked', 'legacy-1', 'legacy-2']);
    await service.execute('ranked', 2);
    expect(order()).toEqual(['legacy-1', 'legacy-2', 'ranked']);
  });

  it('does not initialize legacy notes for a no-op and rejects invalid targets', async () => {
    const { service, writer } = inboxSetup();
    await service.execute('ranked', 0);
    await expect(service.execute('legacy-1', 3)).rejects.toThrow('outside the collection');
    expect(writer.rebalanceRanks).not.toHaveBeenCalled();
  });

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
