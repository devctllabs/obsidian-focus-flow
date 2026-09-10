import { describe, expect, it } from 'vitest';
import { evaluateWip, sprintScopeCount } from './wip-policy';

describe('WIP policy', () => {
  it('allows counts at the limit and ignores disabled limits', () => {
    expect(evaluateWip({ mode: 'soft', limit: 7 }, 7)).toEqual({
      kind: 'allow',
    });
    expect(evaluateWip({ mode: 'off', limit: 1 }, 99)).toEqual({
      kind: 'allow',
    });
  });

  it('requires confirmation for a soft violation', () => {
    expect(evaluateWip({ mode: 'soft', limit: 7 }, 9)).toEqual({
      kind: 'confirm',
      excess: 2,
    });
  });

  it('rejects a hard violation', () => {
    expect(evaluateWip({ mode: 'hard', limit: 1 }, 2)).toEqual({
      kind: 'reject',
      excess: 1,
    });
  });

  it('counts Sprint Scope without releasing completed Tasks', () => {
    expect(sprintScopeCount(20, 4, 3)).toBe(21);
  });
});
