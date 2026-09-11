import { describe, expect, it } from 'vitest';
import { readAcceptanceCriteria, replaceAcceptanceCriteria } from './acceptance-criteria';

describe('Markdown acceptance items', () => {
  it('round-trips multiline criteria and preserves surrounding prose', () => {
    const body = '## Description\n\nKeep me\n\n## Acceptance Criteria\n\nGuidance stays.\n\n- [ ] Original\n  - Nested detail\n\n## Notes\n\nKeep [[reference]]\n';
    expect(readAcceptanceCriteria(body)).toEqual([{ text: 'Original\n- Nested detail', checked: false }]);
    const updated = replaceAcceptanceCriteria(body, [{ text: '**Visible**\n- On mobile\n\nSecond paragraph', checked: true }]);
    expect(updated).toContain('- [x] **Visible**\n  - On mobile\n  \n  Second paragraph');
    expect(updated).toContain('Guidance stays.');
    expect(updated).toContain('## Notes\n\nKeep [[reference]]');
    expect(readAcceptanceCriteria(updated)).toEqual([{ text: '**Visible**\n- On mobile\n\nSecond paragraph', checked: true }]);
  });
});
