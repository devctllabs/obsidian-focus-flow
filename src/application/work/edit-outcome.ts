import type { ProjectedManagedEntity, WorkIndex } from '../indexing/work-index';
import type { AcceptanceCriterion } from '../../domain/work-note';
import { sameBodyFields, type WorkBodyFields } from './work-body-fields';
import { readAcceptanceCriteria } from '../../domain/acceptance-criteria';

export type EditableOutcome = Extract<ProjectedManagedEntity, { type: 'story' | 'epic' | 'task' }>;
export function editableCriteria(note: EditableOutcome): readonly AcceptanceCriterion[] {
  return note.type === 'task' ? readAcceptanceCriteria(`## Acceptance Criteria\n\n${note.bodyFields?.['Acceptance Criteria'] ?? ''}`) : note.acceptanceCriteria ?? [];
}
export function editableNarrative(note: EditableOutcome): WorkBodyFields {
  const fields = { ...note.bodyFields };
  delete fields['Acceptance Criteria'];
  return fields;
}
interface OutcomeFields {
  title: string;
  tags: readonly string[];
  acceptanceCriteria: readonly AcceptanceCriterion[];
  bodyFields?: WorkBodyFields;
}
export interface EditOutcomeRequest extends OutcomeFields {
  id: string;
  type: EditableOutcome['type'];
  expected: OutcomeFields;
}
export interface OutcomeEditPlan extends OutcomeFields { note: EditableOutcome }

export async function editOutcome(index: Pick<WorkIndex, 'refresh' | 'getSnapshot'>, write: (plan: OutcomeEditPlan) => Promise<void>, request: EditOutcomeRequest): Promise<void> {
  const title = request.title.trim();
  const tags = normalizeTags(request.tags);
  const acceptanceCriteria = normalizeCriteria(request.acceptanceCriteria);
  if (!title) throw new Error('Title is required.');
  if (acceptanceCriteria.some((criterion) => !criterion.text)) throw new Error('Each criterion needs a description.');
  await index.refresh();
  const snapshot = index.getSnapshot();
  if (hasPendingClose(snapshot.entities)) throw new Error('Resume the pending Sprint close before editing.');
  const note = editableNote(snapshot.entities, request);
  if (snapshot.phase !== 'ready' || note === undefined) throw new Error('This item is no longer editable.');
  if (outcomeChanged({ note, request, title, tags, criteria: acceptanceCriteria })) {
    throw new Error('This item changed. Reopen the editor to load its latest fields.');
  }
  await write({ note, title, tags, acceptanceCriteria, ...(request.bodyFields === undefined ? {} : { bodyFields: request.bodyFields }) });
  await index.refresh();
}

function normalizeTags(tags: readonly string[]): string[] {
  return [...new Set(tags.map((tag) => tag.trim().replace(/^#+/, '')).filter(Boolean))];
}

function normalizeCriteria(criteria: readonly AcceptanceCriterion[]): AcceptanceCriterion[] {
  return criteria.map((criterion) => ({ text: criterion.text.trim(), checked: criterion.checked }));
}

function hasPendingClose(entities: readonly ProjectedManagedEntity[]): boolean {
  return entities.some((entity) => entity.type === 'sprint' && entity.lifecycle === 'active' && entity.pendingClose != null);
}

function editableNote(entities: readonly ProjectedManagedEntity[], request: EditOutcomeRequest): EditableOutcome | undefined {
  const matches = entities.filter((entity) => entity.id === request.id);
  const note = matches.length === 1 ? matches[0] : undefined;
  if (!note || !['story', 'epic', 'task'].includes(note.type)) return undefined;
  const editable = note as EditableOutcome;
  if (editable.type !== request.type || editable.lifecycle === 'closed') return undefined;
  if (editable.lifecycle === 'done' && editable.type !== 'task') return undefined;
  return editable;
}

function outcomeChanged({ note, request, title, tags, criteria }: { note: EditableOutcome; request: EditOutcomeRequest; title: string; tags: readonly string[]; criteria: readonly AcceptanceCriterion[] }): boolean {
  if (note.title !== request.expected.title && note.title !== title) return true;
  if (narrativeChanged(note, request)) return true;
  if (!sameTags(note.tags, request.expected.tags) && !sameTags(note.tags, tags)) return true;
  return !sameCriteria(editableCriteria(note), request.expected.acceptanceCriteria) && !sameCriteria(editableCriteria(note), criteria);
}

function narrativeChanged(note: EditableOutcome, request: EditOutcomeRequest): boolean {
  if (request.bodyFields === undefined) return false;
  const narrative = editableNarrative(note);
  return !sameBodyFields(narrative, request.expected.bodyFields) && !sameBodyFields(narrative, request.bodyFields);
}

function sameTags(left: readonly string[], right: readonly string[]): boolean {
  const a = new Set(left);
  const b = new Set(right);
  return a.size === b.size && [...a].every((tag) => b.has(tag));
}

export function sameCriteria(left: readonly AcceptanceCriterion[], right: readonly AcceptanceCriterion[]): boolean {
  return left.length === right.length && left.every((criterion, index) => criterion.text === right[index]?.text && criterion.checked === right[index]?.checked);
}
