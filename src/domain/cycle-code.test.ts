import { describe, expect, it } from 'vitest';
import { reviewCycleCodes, sprintCode } from './cycle-code';

describe('cycle codes', () => {
  it('formats Sprint sequences with a minimum width of three', () => {
    expect(sprintCode(1)).toBe('SPR-001');
    expect(sprintCode(14)).toBe('SPR-014');
    expect(sprintCode(1000)).toBe('SPR-1000');
  });

  it.each([
    [1, { month: 'MON-001', quarter: 'QTR-01', year: 'YR-01' }],
    [4, { month: 'MON-001', quarter: 'QTR-01', year: 'YR-01' }],
    [5, { month: 'MON-002', quarter: 'QTR-01', year: 'YR-01' }],
    [13, { month: 'MON-004', quarter: 'QTR-02', year: 'YR-01' }],
    [49, { month: 'MON-013', quarter: 'QTR-05', year: 'YR-02' }],
  ])('derives review groups for Sprint %i', (sequence, expected) => {
    expect(reviewCycleCodes(sequence)).toEqual(expected);
  });

  it.each([0, -1, 1.5])('rejects invalid one-based sequence %s', (sequence) => {
    expect(() => sprintCode(sequence)).toThrow('positive integer');
    expect(() => reviewCycleCodes(sequence)).toThrow('positive integer');
  });
});
