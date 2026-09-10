import { describe, expect, it } from 'vitest';
import { effectiveTags } from './effective-tags';

describe('Effective Tags', () => {
  it('returns a stable deduplicated parent-to-child union', () => {
    expect(
      effectiveTags(
        ['area/work', 'product/focus-flow'],
        ['product/focus-flow', 'surface/mobile'],
        ['surface/mobile', 'next/action'],
      ),
    ).toEqual([
      'area/work',
      'product/focus-flow',
      'surface/mobile',
      'next/action',
    ]);
  });

  it('returns an empty projection when no level has tags', () => {
    expect(effectiveTags([], [], [])).toEqual([]);
  });
});
