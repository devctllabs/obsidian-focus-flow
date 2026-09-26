import type { TaskStatus } from './work-note';

export const TASK_STATUS_ORDER = [
  'todo',
  'tomorrow',
  'today',
  'in_progress',
  'external_in_progress',
  'on_hold',
  'done',
] as const satisfies readonly TaskStatus[];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'TODO',
  tomorrow: 'Tomorrow',
  today: 'Today',
  in_progress: 'In Progress',
  external_in_progress: 'External In Progress',
  on_hold: 'On Hold',
  done: 'Done',
};

const TASK_FLOW: Record<TaskStatus, readonly TaskStatus[]> = {
  todo: ['tomorrow', 'today'],
  tomorrow: ['todo', 'today'],
  today: ['todo', 'tomorrow', 'in_progress', 'on_hold', 'done'],
  in_progress: ['todo', 'tomorrow', 'today', 'external_in_progress', 'on_hold', 'done'],
  external_in_progress: ['todo', 'tomorrow', 'today', 'in_progress', 'on_hold', 'done'],
  on_hold: ['todo', 'tomorrow', 'today', 'in_progress', 'external_in_progress'],
  done: ['todo', 'tomorrow', 'today', 'in_progress', 'external_in_progress', 'on_hold'],
};

export function allowedTaskDestinations(
  from: TaskStatus,
): readonly TaskStatus[] {
  return TASK_FLOW[from];
}

export function canMoveTask(from: TaskStatus, to: TaskStatus): boolean {
  return allowedTaskDestinations(from).includes(to);
}
