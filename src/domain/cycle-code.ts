export interface ReviewCycleCodes {
  month: string;
  quarter: string;
  year: string;
}

export function sprintCode(sequence: number): string {
  assertSequence(sequence);
  return code('SPR', sequence, 3);
}

export function reviewCycleCodes(sprintSequence: number): ReviewCycleCodes {
  assertSequence(sprintSequence);
  return {
    month: code('MON', Math.ceil(sprintSequence / 4), 3),
    quarter: code('QTR', Math.ceil(sprintSequence / 12), 2),
    year: code('YR', Math.ceil(sprintSequence / 48), 2),
  };
}

function code(prefix: string, sequence: number, width: number): string {
  return `${prefix}-${String(sequence).padStart(width, '0')}`;
}

function assertSequence(sequence: number): void {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new RangeError('Cycle sequence must be a positive integer.');
  }
}
