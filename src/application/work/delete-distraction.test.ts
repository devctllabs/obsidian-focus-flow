import { describe, expect, it, vi } from 'vitest';
import type { WorkIndexSnapshot } from '../indexing/work-index';
import { distraction, candidate } from '../../test/storybook/fixtures';
import { deleteDistraction } from './delete-distraction';

describe('deleteDistraction', () => {
  it('refreshes and trashes only the requested rejected Candidate', async () => {
    const snapshot: WorkIndexSnapshot = { phase: 'ready', entities: [{ ...candidate, id: 'another-candidate' }, distraction], diagnostics: [] };
    const index = { refresh: vi.fn().mockResolvedValue(undefined), getSnapshot: () => snapshot };
    const trash = vi.fn().mockResolvedValue(undefined);
    await deleteDistraction(index, trash, distraction.id);
    expect(trash).toHaveBeenCalledWith(distraction);
    expect(index.refresh).toHaveBeenCalledTimes(2);
  });
  it('refuses active Candidates and duplicate identities without trashing anything', async () => {
    const snapshot: WorkIndexSnapshot = { phase: 'ready', entities: [candidate, distraction, distraction], diagnostics: [] };
    const index = { refresh: vi.fn().mockResolvedValue(undefined), getSnapshot: () => snapshot };
    const trash = vi.fn();
    await expect(deleteDistraction(index, trash, candidate.id)).rejects.toThrow();
    await expect(deleteDistraction(index, trash, distraction.id)).rejects.toThrow();
    expect(trash).not.toHaveBeenCalled();
  });
});
