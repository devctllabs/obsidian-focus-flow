import { describe, expect, it } from 'vitest';
import type { TaskStatus } from './work-note';
import { allowedTaskDestinations, canMoveTask } from './task-flow';

describe('Task flow', () => {
  it.each<[TaskStatus, TaskStatus[]]>([
    ['todo', ['tomorrow', 'today']],
    ['tomorrow', ['today']],
    ['today', ['in_progress', 'on_hold', 'done']],
    ['in_progress', ['done', 'external_in_progress', 'on_hold']],
    ['external_in_progress', ['in_progress', 'on_hold', 'done']],
    ['on_hold', ['todo', 'tomorrow']],
    ['done', []],
  ])('allows only documented destinations from %s', (from, destinations) => {
    expect(allowedTaskDestinations(from)).toEqual(destinations);

    const everyStatus: TaskStatus[] = [
      'todo',
      'tomorrow',
      'today',
      'in_progress',
      'external_in_progress',
      'on_hold',
      'done',
    ];
    for (const to of everyStatus) {
      expect(canMoveTask(from, to)).toBe(destinations.includes(to));
    }
  });
});
