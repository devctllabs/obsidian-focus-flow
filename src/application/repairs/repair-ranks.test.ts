import { describe, expect, it, vi } from 'vitest';
import type { RankRepairPlan } from '../../domain/work-note';
import { RankRepairService } from './repair-ranks';

const plan: RankRepairPlan = {
  kind: 'rebalance-ranks',
  collectionLabel: 'the Epic Backlog',
  entries: [
    {
      path: 'Focus Flow/Epics/FF-40 Build a calmer system.md',
      id: '019946c9-5f97-7196-8483-73469275ff90',
      field: 'backlog_rank',
      expectedValue: 'a0',
      replacementValue: 'a0',
    },
    {
      path: 'Focus Flow/Epics/FF-44 Improve personal reviews.md',
      id: '01994710-0000-7000-8000-000000000001',
      field: 'backlog_rank',
      expectedValue: 'a0',
      replacementValue: 'a1',
    },
  ],
};

describe('RankRepairService', () => {
  it('serializes multi-file repairs and refreshes after each success', async () => {
    let finishFirst = (): void => undefined;
    const writer = {
      rebalanceRanks: vi
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise<void>((resolve) => {
              finishFirst = resolve;
            }),
        )
        .mockResolvedValueOnce(undefined),
    };
    const index = { refresh: vi.fn().mockResolvedValue(undefined) };
    const service = new RankRepairService(writer, index);

    const first = service.execute(plan);
    const second = service.execute(plan);

    await vi.waitFor(() =>
      expect(writer.rebalanceRanks).toHaveBeenCalledTimes(1),
    );
    finishFirst();
    await first;
    await second;

    expect(writer.rebalanceRanks).toHaveBeenCalledTimes(2);
    expect(index.refresh).toHaveBeenCalledTimes(2);
  });

  it('continues the queue after a failed repair', async () => {
    const failure = new Error('The collection changed.');
    const writer = {
      rebalanceRanks: vi
        .fn()
        .mockRejectedValueOnce(failure)
        .mockResolvedValueOnce(undefined),
    };
    const index = { refresh: vi.fn().mockResolvedValue(undefined) };
    const service = new RankRepairService(writer, index);

    const failed = service.execute(plan);
    const succeeded = service.execute(plan);

    await expect(failed).rejects.toBe(failure);
    await expect(succeeded).resolves.toBeUndefined();
    expect(writer.rebalanceRanks).toHaveBeenCalledTimes(2);
    expect(index.refresh).toHaveBeenCalledOnce();
  });
});
