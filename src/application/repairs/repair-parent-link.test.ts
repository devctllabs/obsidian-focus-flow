import { describe, expect, it, vi } from 'vitest';
import type { ParentLinkRepairPlan } from '../../domain/work-note';
import { ParentLinkRepairService } from './repair-parent-link';

const plan: ParentLinkRepairPlan = {
  kind: 'replace-parent-link',
  path: 'Focus Flow/Stories/FF-42 Improve weekly focus.md',
  parentId: '019946c9-5f97-7196-8483-73469275ff90',
  field: 'epic_link',
  expectedValue: '[[FF-99 Wrong Epic]]',
  replacementValue: '[[Focus Flow/Epics/FF-40 Build a calmer system]]',
};

describe('ParentLinkRepairService', () => {
  it('writes the planned link replacement and refreshes the index', async () => {
    const writer = { replaceParentLink: vi.fn().mockResolvedValue(undefined) };
    const index = { refresh: vi.fn().mockResolvedValue(undefined) };
    const service = new ParentLinkRepairService(writer, index);

    await service.execute(plan);

    expect(writer.replaceParentLink).toHaveBeenCalledWith(plan);
    expect(index.refresh).toHaveBeenCalledOnce();
  });

  it('does not refresh the index when the write is rejected', async () => {
    const failure = new Error('The note changed.');
    const writer = { replaceParentLink: vi.fn().mockRejectedValue(failure) };
    const index = { refresh: vi.fn().mockResolvedValue(undefined) };
    const service = new ParentLinkRepairService(writer, index);

    await expect(service.execute(plan)).rejects.toBe(failure);
    expect(index.refresh).not.toHaveBeenCalled();
  });
});
