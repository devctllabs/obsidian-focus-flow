import { describe, expect, it } from 'vitest';
import { formatErrorMessage } from './error-message';

describe('formatErrorMessage', () => {
  it.each([
    ['Parent Epic was not found.', 'Choose an active Epic'],
    ['Exactly one Active Sprint is required.', 'Open Plan'],
    ['Story requires Acceptance Criteria.', 'Add at least one'],
    ['Sprint scope exceeds the hard limit.', 'Settings'],
    ['Every unfinished Task needs a close decision.', 'Tasks step'],
    ['EACCES: permission denied', 'Check vault access'],
    ['ENOSPC: no space left', 'Free up storage'],
  ])('adds recovery guidance for %s', (detail, action) => {
    expect(formatErrorMessage(new Error(detail), 'Could not save.')).toContain(action);
  });
  it('uses a useful Error message when one is available', () => {
    expect(
      formatErrorMessage(
        new Error('A Sprint already started for 2026-08-31.'),
        'Focus Flow could not apply the change',
      ),
    ).toBe('A Sprint already started for 2026-08-31.');
  });

  it('redacts absolute paths and limits unusually long messages', () => {
    const detail = `/Users/ethernity/vault/Focus Flow/Stories/story.md ${'x'.repeat(400)}`;

    const message = formatErrorMessage(new Error(detail), 'Could not save');

    expect(message).toContain('[path redacted]');
    expect(message).not.toContain('/Users/ethernity/vault');
    expect(message.length).toBeLessThanOrEqual(300);
    expect(message.endsWith('…')).toBe(true);
  });

  it('redacts Windows and UNC paths', () => {
    expect(formatErrorMessage(new Error('C:\\vault\\broken.md'), 'Could not save')).toBe(
      '[path redacted]',
    );
    expect(formatErrorMessage(new Error('\\\\server\\vault\\broken.md'), 'Could not save')).toBe(
      '[path redacted]',
    );
  });

  it('uses the fallback for empty and non-Error failures', () => {
    expect(formatErrorMessage(new Error('   '), 'Could not save')).toBe(
      'Could not save',
    );
    expect(formatErrorMessage('failure', 'Could not save')).toBe(
      'Could not save',
    );
  });
});
