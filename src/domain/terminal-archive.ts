import type { WorkEntity } from './work-note';

export function workFolder(entity: Pick<WorkEntity, 'type' | 'lifecycle'> & { completedAt?: string | null; closedAt?: string | null }): string {
  if (entity.type === 'candidate') return entity.lifecycle === 'inbox' ? 'Inbox' : 'Distractions';
  const folder = entity.type === 'epic' ? 'Epics' : entity.type === 'story' ? 'Stories' : 'Tasks';
  if (entity.lifecycle !== 'done' && entity.lifecycle !== 'closed') return folder;
  const timestamp = entity.lifecycle === 'done' ? entity.completedAt : entity.closedAt;
  return archiveFolder(folder, timestamp);
}

export function sprintFolder(entity: { lifecycle: 'draft' | 'active' | 'closed'; closedAt?: string | null }): string {
  return entity.lifecycle === 'closed'
    ? archiveFolder('Sprints', entity.closedAt)
    : 'Sprints';
}

function archiveFolder(folder: string, timestamp?: string | null): string {
  if (!timestamp || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(timestamp) || Number.isNaN(Date.parse(timestamp))) {
    throw new Error('A valid terminal timestamp is required before organizing this note. Fix completed_at or closed_at first.');
  }
  const date = timestamp.slice(0, 10);
  if (new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date) throw new Error('The terminal timestamp contains an invalid calendar date.');
  return `${folder}/Archive/${timestamp.slice(0, 4)}/${timestamp.slice(5, 7)}`;
}
