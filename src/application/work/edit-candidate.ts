import type { ProjectedManagedEntity, WorkIndex } from '../indexing/work-index';
import { sameBodyFields, type WorkBodyFields } from './work-body-fields';

export interface EditCandidateRequest {
  candidateId: string;
  title: string;
  tags: readonly string[];
  expectedTitle: string;
  expectedTags: readonly string[];
  bodyFields?: WorkBodyFields;
  expectedBodyFields?: WorkBodyFields;
}

export interface CandidateEditPlan {
  note: Extract<ProjectedManagedEntity, { type: 'candidate' }>;
  title: string;
  tags: readonly string[];
  bodyFields?: WorkBodyFields;
}

export async function editCandidate(index: Pick<WorkIndex, 'refresh' | 'getSnapshot'>, write: (plan: CandidateEditPlan) => Promise<void>, request: EditCandidateRequest): Promise<void> {
  const title = request.title.trim();
  const tags = normalizeTags(request.tags);
  if (!title) throw new Error('Candidate title is required.');
  await index.refresh();
  const snapshot = index.getSnapshot();
  const note = uniqueCandidate(snapshot.entities, request.candidateId);
  if (snapshot.phase !== 'ready' || note === undefined) throw new Error('Candidate is no longer available.');
  if (candidateChanged(note, request, title, tags)) {
    throw new Error('This Candidate changed. Reopen the editor to load its latest title and tags.');
  }
  await write({ note, title, tags, ...(request.bodyFields === undefined ? {} : { bodyFields: request.bodyFields }) });
  await index.refresh();
}

function normalizeTags(tags: readonly string[]): string[] {
  return [...new Set(tags.map((tag) => tag.trim().replace(/^#+/, '')).filter(Boolean))];
}

function uniqueCandidate(entities: readonly ProjectedManagedEntity[], id: string): Extract<ProjectedManagedEntity, { type: 'candidate' }> | undefined {
  const matches = entities.filter((entity) => entity.id === id);
  const note = matches.length === 1 ? matches[0] : undefined;
  return note?.type === 'candidate' ? note : undefined;
}

function candidateChanged(note: Extract<ProjectedManagedEntity, { type: 'candidate' }>, request: EditCandidateRequest, title: string, tags: readonly string[]): boolean {
  if (note.title !== request.expectedTitle && note.title !== title) return true;
  if (!sameTags(note.tags, request.expectedTags) && !sameTags(note.tags, tags)) return true;
  return request.bodyFields !== undefined && !sameBodyFields(note.bodyFields, request.expectedBodyFields) && !sameBodyFields(note.bodyFields, request.bodyFields);
}

function sameTags(left: readonly string[], right: readonly string[]): boolean {
  const a = new Set(left);
  const b = new Set(right);
  return a.size === b.size && [...a].every((tag) => b.has(tag));
}
