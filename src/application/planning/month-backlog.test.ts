import { expect, it, vi } from 'vitest';
import type { WorkIndexSnapshot } from '../indexing/work-index';
import { activeStory, epic } from '../../test/storybook/fixtures';
import { MonthBacklogService } from './month-backlog';

it('selects an Epic Story into Month and returns it without touching its Tasks or parent', async () => {
  const deferred = { ...activeStory, lifecycle: 'epic_backlog' as const, backlogRank: null, sprintId: null, sprintRank: null };
  const snapshot: WorkIndexSnapshot = { phase: 'ready', entities: [epic, deferred], diagnostics: [] };
  const write = vi.fn();
  const service = new MonthBacklogService({ refresh: vi.fn(), getSnapshot: () => snapshot }, write);
  await service.setSelected(deferred.id, true);
  expect(write).toHaveBeenCalledWith({ note: deferred, selected: true, backlogRank: 'a0' });
  const selected = { ...deferred, lifecycle: 'backlog' as const, backlogRank: 'a0' };
  snapshot.entities = [epic, selected];
  await service.setSelected(selected.id, false);
  expect(write).toHaveBeenLastCalledWith({ note: selected, selected: false, backlogRank: null });
  snapshot.entities = [epic, activeStory];
  await expect(service.setSelected(activeStory.id, false)).rejects.toThrow('Sprint');
  expect(write).toHaveBeenCalledTimes(2);
});
