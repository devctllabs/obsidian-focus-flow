import { describe, expect, it, vi } from 'vitest';
import type { WorkIndexSnapshot } from '../indexing/work-index';
import { candidate } from '../../test/storybook/fixtures';
import { editCandidate } from './edit-candidate';

describe('editCandidate', () => {
  it('passes typed body fields and protects concurrent narrative edits', async () => {
    const note = { ...candidate, bodyFields: { Description: 'Original' } };
    const snapshot: WorkIndexSnapshot = { phase: 'ready', diagnostics: [], entities: [note] };
    const index = { refresh: vi.fn(), getSnapshot: () => snapshot };
    const write = vi.fn();
    const request = { candidateId: note.id, title: note.title, tags: note.tags, expectedTitle: note.title, expectedTags: note.tags, bodyFields: { Description: '**Updated**' }, expectedBodyFields: note.bodyFields };
    await editCandidate(index, write, request);
    expect(write).toHaveBeenCalledWith(expect.objectContaining({ bodyFields: request.bodyFields }));
    snapshot.entities = [{ ...note, bodyFields: { Description: 'External' } }];
    await expect(editCandidate(index, write, request)).rejects.toThrow('changed');
    expect(write).toHaveBeenCalledTimes(1);
  });
  it('updates title and own tags while preserving the existing Candidate identity', async () => {
    const snapshot: WorkIndexSnapshot = { phase: 'ready', diagnostics: [], entities: [candidate] };
    const index = { refresh: vi.fn().mockResolvedValue(undefined), getSnapshot: () => snapshot };
    const write = vi.fn().mockResolvedValue(undefined);
    await editCandidate(index, write, { candidateId: candidate.id, title: '  Clearer intention  ', tags: ['#focus', 'focus'], expectedTitle: candidate.title, expectedTags: candidate.tags });
    expect(write).toHaveBeenCalledWith({ note: candidate, title: 'Clearer intention', tags: ['focus'] });
    expect(index.refresh).toHaveBeenCalledTimes(2);
  });
  it('rejects a stale edit without overwriting newer data', async () => {
    const snapshot: WorkIndexSnapshot = { phase: 'ready', diagnostics: [], entities: [{ ...candidate, title: 'Edited in the note' }] };
    const index = { refresh: vi.fn().mockResolvedValue(undefined), getSnapshot: () => snapshot };
    const write = vi.fn();
    await expect(editCandidate(index, write, { candidateId: candidate.id, title: 'Clearer intention', tags: [], expectedTitle: candidate.title, expectedTags: candidate.tags })).rejects.toThrow();
    expect(write).not.toHaveBeenCalled();
  });
});
