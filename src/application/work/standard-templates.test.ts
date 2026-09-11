import { describe, expect, it } from 'vitest';
import { STANDARD_BODY_TEMPLATES } from './standard-templates';

describe('standard body templates', () => {
  it('keeps every built-in user-owned, LF-terminated, and readiness-neutral', () => {
    for (const template of Object.values(STANDARD_BODY_TEMPLATES)) {
      expect(template.endsWith('\n')).toBe(true);
      expect(template).not.toContain('\r');
      expect(template).not.toMatch(/^\s*[-*+]\s+\[[ xX]\]/m);
      expect(template).not.toMatch(
        /schema_version|lifecycle|epic_id|story_id|sprint_id|status|_rank/,
      );
    }
  });

  it('provides exactly the five documented section conventions', () => {
    expect(STANDARD_BODY_TEMPLATES).toEqual({
      candidate: '## Description\n\n## Entry Review\n\n## Acceptance Criteria\n',
      epic: '## Intent\n\n## Acceptance Criteria\n',
      story: '## Description\n\n## Acceptance Criteria\n',
      task: '## Description\n\n## Acceptance Criteria\n',
      retrospective: '## Wins\n\n## Friction\n\n## Improvements\n',
    });
  });
});
