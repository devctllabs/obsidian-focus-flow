import type { ReviewHistory, SprintReview } from '../../application/history/review-history';

export type ReportLevel = 'sprint' | 'month' | 'quarter' | 'year';
export interface HistoryReport {
  id: string;
  label: string;
  target: number;
  reviews: readonly SprintReview[];
}

export function historyReports(history: ReviewHistory, level: ReportLevel): HistoryReport[] {
  return history.years.flatMap((year) => {
    const quarters = year.quarters;
    if (level === 'year') return [{ id: `year-${year.number}`, label: `Year ${year.number}`, target: 48, reviews: quarters.flatMap((quarter) => quarter.months.flatMap((month) => month.sprints)) }];
    return quarters.flatMap((quarter) => {
      if (level === 'quarter') return [{ id: `quarter-${quarter.globalNumber}`, label: `Quarter ${quarter.number} · Year ${year.number}`, target: 12, reviews: quarter.months.flatMap((month) => month.sprints) }];
      return quarter.months.flatMap((month) => level === 'month'
        ? [{ id: `month-${month.globalNumber}`, label: `Month ${month.number} · Year ${year.number}`, target: 4, reviews: month.sprints }]
        : month.sprints.map((review) => ({ id: review.sprint.id, label: review.sprint.code, target: 1, reviews: [review] })));
    });
  });
}

export function reportTotals(reviews: readonly SprintReview[]) {
  const latest = [...reviews].sort((left, right) => Date.parse(right.sprint.closedAt) - Date.parse(left.sprint.closedAt))[0];
  return {
    achieved: reviews.reduce((sum, review) => sum + review.sprint.closeSnapshot.summary.achievedStories, 0),
    attempted: reviews.reduce((sum, review) => sum + review.sprint.closeSnapshot.summary.attemptedStories, 0),
    notAchieved: reviews.reduce((sum, review) => sum + review.sprint.closeSnapshot.summary.notAchievedStories, 0),
    closed: reviews.reduce((sum, review) => sum + review.sprint.closeSnapshot.summary.closedStories, 0),
    completed: reviews.reduce((sum, review) => sum + review.sprint.closeSnapshot.summary.completedDuringSprint, 0),
    open: latest?.sprint.closeSnapshot.summary.openAtClose ?? 0,
  };
}
