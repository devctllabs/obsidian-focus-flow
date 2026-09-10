import { describe, expect, it, vi } from 'vitest';
import type { MoveNoteRepairPlan } from '../../domain/work-note';
import { NotePlacementRepairService } from './repair-note-placement';

const plan: MoveNoteRepairPlan = {
  kind: 'move-note',
  path: 'Focus Flow/Tasks/FF-41 Explore weekly focus.md',
  id: '019946e9-0ef0-7ca3-af0c-ec423d76efed',
  targetFolder: 'Inbox',
};

describe('NotePlacementRepairService', () => {
  it('moves the note before refreshing the index', async () => {
    const events: string[] = [];
    const mover = {
      moveNote: vi.fn(async () => {
        events.push('move');
      }),
    };
    const index = {
      refresh: vi.fn(async () => {
        events.push('refresh');
      }),
    };
    const service = new NotePlacementRepairService(mover, index);

    await service.execute(plan);

    expect(mover.moveNote).toHaveBeenCalledWith(plan);
    expect(events).toEqual(['move', 'refresh']);
  });

  it('does not refresh when the move fails', async () => {
    const mover = {
      moveNote: vi.fn().mockRejectedValue(new Error('move failed')),
    };
    const index = { refresh: vi.fn() };
    const service = new NotePlacementRepairService(mover, index);

    await expect(service.execute(plan)).rejects.toThrow('move failed');
    expect(index.refresh).not.toHaveBeenCalled();
  });
});
