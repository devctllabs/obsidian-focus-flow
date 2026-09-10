import type { ProjectedManagedEntity, WorkIndex } from '../indexing/work-index';

export type DistractionToTrash = Extract<ProjectedManagedEntity, { type: 'candidate'; lifecycle: 'rejected' }>;

export async function deleteDistraction(index: Pick<WorkIndex, 'refresh' | 'getSnapshot'>, trash: (note: DistractionToTrash) => Promise<void>, id: string): Promise<void> {
  await index.refresh();
  const snapshot = index.getSnapshot();
  const matches = snapshot.entities.filter((entity) => entity.id === id);
  const note = matches.length === 1 ? matches[0] : undefined;
  if (snapshot.phase !== 'ready' || note?.type !== 'candidate' || note.lifecycle !== 'rejected') {
    throw new Error('Exactly one current Distraction is required.');
  }
  await trash(note);
  await index.refresh();
}
