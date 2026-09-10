import type { ProjectedManagedEntity, WorkIndex, WorkIndexSnapshot } from '../indexing/work-index';
import type { ActiveSprintEntity, ClosedSprintEntity } from '../../domain/sprint-note';

export type DeletableWork = Extract<ProjectedManagedEntity, { type: 'candidate' | 'epic' | 'story' | 'task' }>;

export interface WorkDeletionPreview {
  note: DeletableWork;
  content: string;
  warnings: string[];
  blockers: string[];
}
export interface WorkTrashStorage {
  read(note: DeletableWork): Promise<string>;
  trash(note: DeletableWork, expectedContent: string): Promise<void>;
}
export class WorkDeletionService {
  constructor(private readonly index: Pick<WorkIndex, 'refresh' | 'getSnapshot'>, private readonly storage: WorkTrashStorage) {}
  async preview(id: string): Promise<WorkDeletionPreview> {
    await this.index.refresh();
    const snapshot = this.index.getSnapshot();
    if (snapshot.phase !== 'ready') throw new Error('Could not check note relationships. Refresh notes and try again.');
    const note = uniqueDeletable(snapshot, id);
    const blockers = deletionBlockers(snapshot, note);
    const content = await this.storage.read(note);
    const warnings = deletionWarnings(note, content);
    return { note, content, warnings, blockers: [...new Set(blockers)] };
  }

  async confirm(preview: WorkDeletionPreview): Promise<void> {
    const current = await this.preview(preview.note.id);
    if (current.blockers.length) throw new Error(current.blockers.join(' '));
    if (current.note.path !== preview.note.path || current.content !== preview.content) throw new Error('This note changed after the deletion preview. Cancel and reopen Delete to review its latest content.');
    await this.storage.trash(current.note, current.content);
    await this.index.refresh();
  }
}

function uniqueDeletable(snapshot: WorkIndexSnapshot, id: string): DeletableWork {
  const matches = snapshot.entities.filter((entity) => entity.id === id);
  const note = matches.length === 1 ? matches[0] : undefined;
  if (!note || note.type === 'sprint') throw new Error('This item is missing or has a duplicate ID. Open the Attention center, fix the note, then try again.');
  return note;
}

function deletionBlockers(snapshot: WorkIndexSnapshot, note: DeletableWork): string[] {
  const blockers: string[] = [];
  if (hasUnsafeDiagnostics(snapshot)) blockers.push('Some notes cannot be checked for relationships. Fix invalid notes and duplicate IDs in the Attention center first.');
  blockers.push(...relationshipBlockers(snapshot, note));
  blockers.push(...historyBlockers(snapshot, note.id));
  return blockers;
}

function hasUnsafeDiagnostics(snapshot: WorkIndexSnapshot): boolean {
  return snapshot.diagnostics.some((diagnostic) => diagnostic.code === 'invalid-managed-data' || diagnostic.code === 'duplicate-id');
}

function relationshipBlockers(snapshot: WorkIndexSnapshot, note: DeletableWork): string[] {
  const blockers: string[] = [];
  const children = childNotes(snapshot, note);
  if (children.length) blockers.push(`${note.key} contains ${children.length} ${note.type === 'epic' ? 'Stories' : 'Tasks'}. Move or delete those notes first; children are never deleted automatically.`);
  if (note.type === 'story' && note.sprintId) blockers.push('This Story belongs to a Sprint. Return it to the backlog before deleting it.');
  if (note.type === 'task' && taskStoryIsInSprint(snapshot, note)) blockers.push('This Task belongs to a Story in a Sprint. Return the Story to the backlog or resolve the Task during Sprint review.');
  return blockers;
}

function childNotes(snapshot: WorkIndexSnapshot, note: DeletableWork): readonly ProjectedManagedEntity[] {
  if (note.type === 'epic') return snapshot.entities.filter((entity) => entity.type === 'story' && entity.epicId === note.id);
  if (note.type === 'story') return snapshot.entities.filter((entity) => entity.type === 'task' && entity.storyId === note.id);
  return [];
}

function taskStoryIsInSprint(snapshot: WorkIndexSnapshot, note: Extract<DeletableWork, { type: 'task' }>): boolean {
  return snapshot.entities.some((entity) => entity.type === 'story' && entity.id === note.storyId && Boolean(entity.sprintId));
}

function historyBlockers(snapshot: WorkIndexSnapshot, id: string): string[] {
  const blockers: string[] = [];
  for (const entity of snapshot.entities) {
    if (entity.type !== 'sprint' || entity.lifecycle === 'draft') continue;
    if (entity.lifecycle === 'active' && entity.pendingClose) blockers.push('Resume the pending Sprint close before deleting work.');
    if (sprintReferences(entity, id)) blockers.push(`${entity.code} records this item in Sprint history. Keep the note to preserve that history; close or resolve the work instead.`);
  }
  return blockers;
}

function sprintReferences(sprint: (ActiveSprintEntity | ClosedSprintEntity) & { path: string }, id: string): boolean {
  const startReference = sprint.startSnapshot.stories.some((story) => story.id === id || story.epicId === id || story.tasks.some((task) => task.id === id));
  if (startReference || sprint.provisionalStoryOutcomes.some((outcome) => outcome.storyId === id)) return true;
  if (sprint.lifecycle !== 'closed') return false;
  return sprint.closeSnapshot.stories.some((story) => story.id === id || story.epicId === id) || sprint.closeSnapshot.tasks.some((task) => [task.id, task.storyId, task.targetStoryId, task.targetEpicId].includes(id));
}

function deletionWarnings(note: DeletableWork, content: string): string[] {
  const warnings: string[] = [];
  const body = content.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '').replace(/^#{1,6}\s+.*$/gm, '').trim();
  const hasCriteria = (note.type === 'story' || note.type === 'epic') && Boolean(note.acceptanceCriteria?.length);
  if (body || note.tags.length || hasCriteria) warnings.push('This note contains content, criteria, or tags. Moving it to trash removes the entire note, including your own sections and properties.');
  if (hasRecordedProgress(note)) warnings.push('This item has recorded progress. Review its note before moving it to trash.');
  return warnings;
}

function hasRecordedProgress(note: DeletableWork): boolean {
  if (note.lifecycle === 'done' || note.lifecycle === 'closed') return true;
  return note.type === 'task' && Boolean(note.startedAt || note.completedAt || note.status !== 'todo');
}
