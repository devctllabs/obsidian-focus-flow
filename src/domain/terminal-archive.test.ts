import { expect, it } from 'vitest';
import { sprintFolder, workFolder } from './terminal-archive';

it.each(['epic', 'story', 'task'] as const)('archives %s using its timestamp local date, never UTC', (type) => {
  const folder = type === 'epic' ? 'Epics' : type === 'story' ? 'Stories' : 'Tasks';
  expect(workFolder({ type, lifecycle: 'done', completedAt: '2026-03-01T00:30:00+14:00' })).toBe(`${folder}/Archive/2026/03`);
  expect(workFolder({ type, lifecycle: 'closed', closedAt: '2026-02-28T23:30:00-12:00' })).toBe(`${folder}/Archive/2026/02`);
});
it('rejects missing or invalid terminal dates instead of guessing an archive bucket', () => {
  expect(() => workFolder({ type: 'task', lifecycle: 'done' })).toThrow('timestamp');
  expect(() => workFolder({ type: 'story', lifecycle: 'closed', closedAt: '2026-02-30T12:00:00Z' })).toThrow('timestamp');
  expect(workFolder({ type: 'task', lifecycle: 'active' })).toBe('Tasks');
});

it('keeps open Sprints at the root and archives Closed Sprints by local close month', () => {
  expect(sprintFolder({ lifecycle: 'draft' })).toBe('Sprints');
  expect(sprintFolder({ lifecycle: 'active' })).toBe('Sprints');
  expect(sprintFolder({ lifecycle: 'closed', closedAt: '2026-03-01T00:30:00+14:00' })).toBe('Sprints/Archive/2026/03');
  expect(sprintFolder({ lifecycle: 'closed', closedAt: '2026-02-28T23:30:00-12:00' })).toBe('Sprints/Archive/2026/02');
});

it('rejects a Closed Sprint without a valid calendar timestamp', () => {
  expect(() => sprintFolder({ lifecycle: 'closed' })).toThrow('timestamp');
  expect(() => sprintFolder({ lifecycle: 'closed', closedAt: '2028-02-30T12:00:00Z' })).toThrow('timestamp');
});
