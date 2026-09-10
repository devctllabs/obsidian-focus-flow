import { describe, expect, it } from 'vitest';
import { noteFilename } from './note-filename';

describe('noteFilename', () => {
  it('normalizes a title into the managed filename contract', () => {
    expect(noteFilename('FF-42', '  Calm / weekly\tfocus.  ')).toBe(
      'FF-42 Calm - weekly-focus.md',
    );
    expect(noteFilename('FF-42', 'Cafe\u0301')).toBe('FF-42 Café.md');
  });

  it('replaces reserved characters and falls back for an empty title', () => {
    expect(noteFilename('FF-42', '<>:"|?*')).toBe('FF-42 -------.md');
    expect(noteFilename('FF-42', ' / ')).toBe('FF-42 -.md');
    expect(noteFilename('FF-42', ' ... ')).toBe('FF-42 Untitled.md');
  });
});
