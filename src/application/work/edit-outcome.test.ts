import { describe, expect, it, vi } from 'vitest';
import type { WorkIndexSnapshot } from '../indexing/work-index';
import { activeStory, activeSprint, task, doneTask } from '../../test/storybook/fixtures';
import { editOutcome } from './edit-outcome';

describe('editOutcome', () => {
  it.each([task, doneTask])('edits $lifecycle Task authoring fields and rejects stale criteria', async (base) => {
    const note = { ...base, bodyFields: { Description: 'Original', 'Acceptance Criteria': '- [ ] Existing' } };
    const snapshot: WorkIndexSnapshot = { phase: 'ready', entities: [note], diagnostics: [] };
    const index = { refresh: vi.fn(), getSnapshot: () => snapshot };
    const write = vi.fn();
    const fields = { title: note.title, tags: note.tags, bodyFields: { Description: 'Original' }, acceptanceCriteria: [{ text: 'Existing', checked: false }] };
    const update = { ...fields, id: note.id, type: note.type, title: 'Clarified task', bodyFields: { Description: '**Updated**' }, acceptanceCriteria: [{ text: 'Verified\n- With touch', checked: true }], expected: fields };
    await editOutcome(index, write, update);
    expect(write).toHaveBeenCalledWith({ note, title: update.title, tags: note.tags, bodyFields: update.bodyFields, acceptanceCriteria: update.acceptanceCriteria });
    snapshot.entities = [{ ...note, bodyFields: { ...note.bodyFields, 'Acceptance Criteria': '- [ ] External edit' } }];
    await expect(editOutcome(index, write, update)).rejects.toThrow('changed');
    snapshot.entities = [{ ...note, lifecycle: 'closed', status: 'done' }];
    await expect(editOutcome(index, write, update)).rejects.toThrow('editable');
    expect(write).toHaveBeenCalledTimes(1);
  });
  const expected = { title: activeStory.title, tags: activeStory.tags, acceptanceCriteria: activeStory.acceptanceCriteria };
  const request = { id: activeStory.id, type: activeStory.type, title: 'Clearer outcome', tags: ['focus'], acceptanceCriteria: [{ text: 'Visible in Plan\n- On narrow screens', checked: true }], expected };
  it('edits typed fields of an active Story without changing its Sprint membership', async () => {
    const snapshot: WorkIndexSnapshot = { phase: 'ready', entities: [activeStory], diagnostics: [] };
    const index = { refresh: vi.fn().mockResolvedValue(undefined), getSnapshot: () => snapshot };
    const write = vi.fn().mockResolvedValue(undefined);
    await editOutcome(index, write, request);
    expect(write).toHaveBeenCalledWith({ note: activeStory, title: request.title, tags: request.tags, acceptanceCriteria: request.acceptanceCriteria });
    expect(index.refresh).toHaveBeenCalledTimes(2);
  });
  it('rejects stale criteria and completed Stories before any write', async () => {
    const snapshot: WorkIndexSnapshot = { phase: 'ready', entities: [{ ...activeStory, acceptanceCriteria: [{ text: 'External change', checked: false }] }], diagnostics: [] };
    const index = { refresh: vi.fn().mockResolvedValue(undefined), getSnapshot: () => snapshot };
    const write = vi.fn();
    await expect(editOutcome(index, write, request)).rejects.toThrow();
    snapshot.entities = [{ ...activeStory, lifecycle: 'done' }];
    await expect(editOutcome(index, write, request)).rejects.toThrow();
    expect(write).not.toHaveBeenCalled();
  });
  it('blocks editing while a Sprint close is pending', async () => {
    const snapshot = { phase: 'ready', entities: [activeStory, { ...activeSprint, pendingClose: { kind: 'close-sprint' } }], diagnostics: [] } as unknown as WorkIndexSnapshot;
    const index = { refresh: vi.fn().mockResolvedValue(undefined), getSnapshot: () => snapshot };
    const write = vi.fn();
    await expect(editOutcome(index, write, request)).rejects.toThrow('Resume');
    expect(write).not.toHaveBeenCalled();
  });
  it('saves Description and rejects concurrent body changes', async () => {
    const note = { ...activeStory, bodyFields: { Description: 'Original' } };
    const snapshot: WorkIndexSnapshot = { phase: 'ready', entities: [note], diagnostics: [] };
    const index = { refresh: vi.fn(), getSnapshot: () => snapshot };
    const write = vi.fn();
    const update = { ...request, bodyFields: { Description: '**Changed**' }, expected: { ...expected, bodyFields: note.bodyFields } };
    await editOutcome(index, write, update);
    expect(write).toHaveBeenCalledWith(expect.objectContaining({ bodyFields: update.bodyFields }));
    snapshot.entities = [{ ...note, bodyFields: { Description: 'External edit' } }];
    await expect(editOutcome(index, write, update)).rejects.toThrow('changed');
    expect(write).toHaveBeenCalledTimes(1);
  });
});
