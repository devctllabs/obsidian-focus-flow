import { expect, it } from 'vitest';
import { applyReplacements, validateReplacements, type ManagedReplacementStore } from './apply-replacements';
import type { ManagedReplacement } from '../../domain/managed-replacement';

function fixture() {
  const entries: ManagedReplacement[] = [
    { id: 'parent', before: { path: 'Stories/story.md', managed: { id: 'parent', lifecycle: 'active_sprint' } }, after: { path: 'Stories/Archive/2026/09/story.md', managed: { id: 'parent', lifecycle: 'done' } } },
    { id: 'child', before: { path: 'Tasks/task.md', managed: { id: 'child', story_link: 'old' } }, after: { path: 'Tasks/task.md', managed: { id: 'child', story_link: 'new' } } },
  ];
  const notes = new Map(entries.map((entry) => [entry.before.path, entry.before.managed]));
  const writes: string[] = [];
  let failMove = false;
  const store: ManagedReplacementStore = {
    read: async (path) => notes.get(path) ?? null,
    replace: async (path, expected, replacement) => { expect(notes.get(path)).toEqual(expected); writes.push(`replace:${path}`); notes.set(path, replacement); },
    move: async (path, destination, expected) => { if (failMove) throw new Error('Interrupted'); expect(notes.get(path)).toEqual(expected); expect(notes.has(destination)).toBe(false); writes.push(`move:${path}`); notes.delete(path); notes.set(destination, expected); },
  };
  return { entries, notes, writes, store, interrupt: () => { failMove = true; }, resume: () => { failMove = false; } };
}
it('preflights every source and destination before writing', async () => {
  const f = fixture();
  f.notes.set(f.entries[0]!.after.path, { id: 'unrelated' });
  await expect(validateReplacements(f.store, f.entries)).rejects.toThrow();
  expect(f.writes).toEqual([]);
});
it('writes child links before moving parents and resumes after an interrupted rename', async () => {
  const f = fixture();
  await validateReplacements(f.store, f.entries);
  f.interrupt();
  await expect(applyReplacements(f.store, f.entries)).rejects.toThrow('Interrupted');
  expect(f.notes.get('Tasks/task.md')).toEqual({ id: 'child', story_link: 'new' });
  f.resume();
  await applyReplacements(f.store, f.entries);
  expect(f.notes.has('Stories/story.md')).toBe(false);
  const count = f.writes.length;
  await applyReplacements(f.store, f.entries);
  expect(f.writes).toHaveLength(count);
});
it('never accepts a third managed state, even during recovery', async () => {
  const f = fixture();
  f.notes.set('Tasks/task.md', { id: 'child', story_link: 'manual change' });
  await expect(applyReplacements(f.store, f.entries)).rejects.toThrow('changed');
  expect(f.writes).toEqual([]);
});
