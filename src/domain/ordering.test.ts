import { describe, expect, it } from 'vitest';
import { compareOrdinal, compareRank } from './ordering';

describe('compareOrdinal', () => {
  it('orders strings by ordinal value', () => {
    expect(compareOrdinal('a0', 'a1')).toBeLessThan(0);
    expect(compareOrdinal('a1', 'a0')).toBeGreaterThan(0);
    expect(compareOrdinal('a0', 'a0')).toBe(0);
  });
});

describe('compareRank', () => {
  it('orders by rank before using the entity ID as a tie-breaker', () => {
    expect(compareRank('a0', 'a1', 'id-z', 'id-a')).toBeLessThan(0);
    expect(compareRank('a0', 'a0', 'id-a', 'id-z')).toBeLessThan(0);
    expect(compareRank('a0', 'a0', 'id-a', 'id-a')).toBe(0);
  });
});
