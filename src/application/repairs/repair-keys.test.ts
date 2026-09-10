import { describe, expect, it, vi } from 'vitest';
import type { KeyRepairPlan } from '../../domain/work-note';
import { KeyRepairService } from './repair-keys';

const plan: KeyRepairPlan = {
  kind: 'repair-duplicate-keys',
  entries: [],
  links: [],
};

describe('KeyRepairService', () => {
  it('serializes key repairs and refreshes after each success', async () => {
    let finishFirst = (): void => undefined;
    const writer = {
      repairKeys: vi
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
    const service = new KeyRepairService(writer, index);

    const first = service.execute(plan);
    const second = service.execute(plan);

    await vi.waitFor(() => expect(writer.repairKeys).toHaveBeenCalledOnce());
    finishFirst();
    await first;
    await second;

    expect(writer.repairKeys).toHaveBeenCalledTimes(2);
    expect(index.refresh).toHaveBeenCalledTimes(2);
  });

  it('continues the queue after a failed repair', async () => {
    const failure = new Error('The key plan changed.');
    const writer = {
      repairKeys: vi
        .fn()
        .mockRejectedValueOnce(failure)
        .mockResolvedValueOnce(undefined),
    };
    const index = { refresh: vi.fn().mockResolvedValue(undefined) };
    const service = new KeyRepairService(writer, index);

    const failed = service.execute(plan);
    const succeeded = service.execute(plan);

    await expect(failed).rejects.toBe(failure);
    await expect(succeeded).resolves.toBeUndefined();
    expect(index.refresh).toHaveBeenCalledOnce();
  });
});
