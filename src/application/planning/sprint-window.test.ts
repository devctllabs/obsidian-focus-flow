import { expect, it } from 'vitest';
import { sprintWindow } from './sprint-window';
import { activeSprint } from '../../test/storybook/fixtures';

it.each([['2026-09-04', 3], ['2026-09-06', 1]] as const)('keeps a late start on %s in its calendar week', (today, days) => {
  expect(sprintWindow(today, 1, [])).toMatchObject({ startsOn: '2026-08-31', dueOn: '2026-09-06', late: true, remaining: days });
});
it('blocks the occupied window but releases Start in the next local week', () => {
  const sprints = [{ ...activeSprint, startsOn: '2026-08-31', dueOn: '2026-09-06' }];
  expect(sprintWindow('2026-09-06', 1, sprints)).toMatchObject({ occupied: sprints[0], nextStartsOn: '2026-09-07' });
  expect(sprintWindow('2026-09-07', 1, sprints).occupied).toBeUndefined();
});
