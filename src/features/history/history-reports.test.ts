import { describe, expect, it } from 'vitest';
import { buildReviewHistory } from '../../application/history/review-history';
import { closedSprint } from '../../test/storybook/fixtures';
import { historyReports, reportTotals } from './history-reports';

describe('History reports', () => {
  const entities = [1, 4, 5, 13, 49].map((sequence) => ({
    ...closedSprint, id: `sprint-${sequence}`, sequence, code: `SPR-${sequence}`,
    closedAt: new Date(Date.UTC(2026, 0, sequence)).toISOString(),
    closeSnapshot: { ...closedSprint.closeSnapshot, summary: { ...closedSprint.closeSnapshot.summary, openAtClose: sequence } },
  }));
  const history = buildReviewHistory(entities);
  it('uses actual 4/12/48 Sprint boundaries, preserving partial cycles', () => {
    expect(historyReports(history, 'month').map((report) => [report.id, report.reviews.length, report.target]))
      .toEqual([['month-13', 1, 4], ['month-4', 1, 4], ['month-2', 1, 4], ['month-1', 2, 4]]);
    expect(historyReports(history, 'quarter')).toHaveLength(3);
    expect(historyReports(history, 'year')).toHaveLength(2);
  });
  it('sums completions but takes open work only from the latest close boundary', () => {
    const report = historyReports(history, 'year')[1]!;
    const totals = reportTotals(report.reviews);
    expect(totals.completed).toBe(closedSprint.closeSnapshot.summary.completedDuringSprint * 4);
    expect(totals.open).toBe(13);
  });
  it('does not fabricate empty periods', () => {
    expect(historyReports(buildReviewHistory([]), 'month')).toEqual([]);
  });
});
