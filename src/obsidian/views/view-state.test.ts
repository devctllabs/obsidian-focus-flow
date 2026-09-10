import { describe, expect, it } from 'vitest';
import { normalizeViewMode, normalizeViewState } from './view-state';

describe('normalizeViewMode', () => {
  it('keeps a supported mode and falls back to Focus for stale state', () => {
    expect(normalizeViewMode({ mode: 'history' })).toBe('history');
    expect(normalizeViewMode({ mode: 'calendar' })).toBe('focus');
    expect(normalizeViewMode(null)).toBe('focus');
  });

  it('maps the retired Distractions mode into the Inbox section', () => {
    expect(normalizeViewState({ mode: 'distractions' })).toEqual({
      mode: 'inbox',
      inboxSection: 'distractions',
    });
  });
});
