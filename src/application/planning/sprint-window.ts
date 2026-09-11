import type { SprintEntity } from '../../domain/sprint-note';
import type { FocusFlowSettings } from '../../settings';
import { sprintDateBoundary } from './plan-sprint';

export function sprintWindow(today: string, weekday: FocusFlowSettings['firstWeekday'], sprints: readonly SprintEntity[]) {
  const boundary = sprintDateBoundary(today, weekday);
  const occupied = sprints.find((sprint) => sprint.lifecycle !== 'draft' && sprint.startsOn === boundary.startsOn);
  const next = new Date(`${boundary.dueOn}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const remaining = Math.round((Date.parse(`${boundary.dueOn}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000) + 1;
  return { ...boundary, remaining, late: today > boundary.startsOn, occupied, nextStartsOn: next.toISOString().slice(0, 10) };
}
