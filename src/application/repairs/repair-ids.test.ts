import { describe, expect, it, vi } from 'vitest';
import type { IdRepairPlan } from '../../domain/work-note';
import { IdRepairService } from './repair-ids';

const oldId = '019946c9-5f97-7196-8483-73469275ff90';
const newId = '01994770-0000-7000-8000-000000000001';
const epicPath = 'Focus Flow/Epics/FF-41 Make reviews repeatable.md';
const storyPath = 'Focus Flow/Stories/FF-42 Improve personal reviews.md';
const plan: IdRepairPlan = {
  kind: 'repair-duplicate-ids',
  entries: [{ path: epicPath, expectedId: oldId }],
  references: [
    {
      path: storyPath,
      field: 'epic_id',
      expectedId: oldId,
      replacementForPath: epicPath,
    },
  ],
};

describe('IdRepairService', () => {
  it('assigns fresh UUIDs at execution time and refreshes the index', async () => {
    const writer = { repairIds: vi.fn().mockResolvedValue(undefined) };
    const index = { refresh: vi.fn().mockResolvedValue(undefined) };
    const nextId = vi.fn(() => newId);
    const service = new IdRepairService(writer, index, nextId);

    await service.execute(plan);

    expect(writer.repairIds).toHaveBeenCalledWith({
      entries: [{ ...plan.entries[0], replacementId: newId }],
      references: [{ ...plan.references[0], replacementId: newId }],
    });
    expect(index.refresh).toHaveBeenCalledOnce();
  });

  it('serializes repairs and continues the queue after a failure', async () => {
    const failure = new Error('The UUID plan changed.');
    const writer = {
      repairIds: vi
        .fn()
        .mockRejectedValueOnce(failure)
        .mockResolvedValueOnce(undefined),
    };
    const index = { refresh: vi.fn().mockResolvedValue(undefined) };
    const service = new IdRepairService(writer, index, () => newId);

    const failed = service.execute(plan);
    const succeeded = service.execute(plan);

    await expect(failed).rejects.toBe(failure);
    await expect(succeeded).resolves.toBeUndefined();
    expect(writer.repairIds).toHaveBeenCalledTimes(2);
    expect(index.refresh).toHaveBeenCalledOnce();
  });
});
