import { describe, expect, it } from 'vitest';
import type { ProjectedManagedEntity } from '../indexing/work-index';
import { buildReviewHistory } from './review-history';

describe('buildReviewHistory', () => {
  it('excludes a Closed Sprint while its Close operation is still pending', () => {
    const pending = {
      ...sprint(1),
      pendingClose: { operationId: '01994a8a-0371-7a2d-a3e9-247990391600' },
    } as unknown as ProjectedManagedEntity;

    expect(buildReviewHistory([pending]).years).toEqual([]);
  });

  it('derives completed and partial Month, Quarter, and Year progress from Sprint sequences', () => {
    const history = buildReviewHistory(
      Array.from({ length: 49 }, (_, index) => sprint(index + 1)),
    );

    expect(history.years.map((year) => year.progress)).toEqual([
      { closed: 1, target: 48 },
      { closed: 48, target: 48 },
    ]);
    expect(history.years[1]?.quarters.map((quarter) => quarter.progress))
      .toEqual([
        { closed: 12, target: 12 },
        { closed: 12, target: 12 },
        { closed: 12, target: 12 },
        { closed: 12, target: 12 },
      ]);
    expect(
      history.years[1]?.quarters[0]?.months.map((month) => month.progress),
    ).toEqual([
      { closed: 4, target: 4 },
      { closed: 4, target: 4 },
      { closed: 4, target: 4 },
    ]);
  });

  it('assigns terminal Epics to the next Sprint close boundary', () => {
    const evidence = [
      sprint(1, '2026-01-01T18:00:00Z'),
      sprint(2, '2026-01-08T18:00:00Z'),
      epic('FF-50', 'done', '2026-01-02T10:00:00Z'),
      epic('FF-51', 'closed', '2026-01-09T10:00:00Z'),
    ];
    const history = buildReviewHistory(evidence);
    const reviews = history.years[0]!.quarters[0]!.months[0]!.sprints;

    expect(reviews.find(({ sequence }) => sequence === 1)!.finalizedEpics)
      .toEqual([]);
    expect(reviews.find(({ sequence }) => sequence === 2)!.finalizedEpics)
      .toMatchObject([{ key: 'FF-50', lifecycle: 'done' }]);
    expect(history.sinceLastSprint).toMatchObject([
      { key: 'FF-51', lifecycle: 'closed' },
    ]);

    const filtered = buildReviewHistory(evidence, new Set([evidence[0]!.id]));
    expect(filtered.years[0]!.quarters[0]!.months[0]!.sprints)
      .toHaveLength(1);
    expect(filtered.sinceLastSprint).toMatchObject([{ key: 'FF-51' }]);
    expect(filtered.sinceLastSprint).not.toContainEqual(
      expect.objectContaining({ key: 'FF-50' }),
    );

    const afterNextClose = buildReviewHistory([
      ...evidence,
      sprint(3, '2026-01-15T18:00:00Z'),
    ]);
    expect(afterNextClose.sinceLastSprint).toEqual([]);
    expect(
      afterNextClose.years[0]!.quarters[0]!.months[0]!.sprints
        .find(({ sequence }) => sequence === 3)!.finalizedEpics,
    ).toMatchObject([{ key: 'FF-51', lifecycle: 'closed' }]);
  });

  it('aggregates Story Outcomes and frozen Effective Tags without current tags', () => {
    const closed = sprint(1);
    closed.closeSnapshot.stories = [
      {
        id: '019946f1-8d2a-7f05-87b1-1eebbb476300',
        key: 'FF-42',
        title: 'Outcome',
        epicId: '019946c9-5f97-7196-8483-73469275ff90',
        outcome: 'achieved',
        evidence: 'Verified.',
        acceptanceExceptionReason: null,
        acceptanceCriteria: [],
        effectiveTags: ['area/frozen'],
      },
    ];
    closed.closeSnapshot.effectiveTagSummary = [
      { tag: 'area/frozen', completedTasks: 2 },
    ];
    const currentStory: ProjectedManagedEntity = {
      id: '019946f1-8d2a-7f05-87b1-1eebbb476300',
      key: 'FF-42',
      title: 'Outcome',
      type: 'story',
      lifecycle: 'done',
      epicId: '019946c9-5f97-7196-8483-73469275ff90',
      epicLink: '[[Epic]]',
      backlogRank: null,
      sprintId: null,
      sprintRank: null,
      acceptanceCriteria: [],
      completedAt: '2026-01-01T18:00:00Z',
      outcome: 'achieved',
      createdAt: '2025-12-01T10:00:00Z',
      tags: ['area/current'],
      effectiveTags: ['area/current'],
      path: 'Focus Flow/Stories/FF-42 Outcome.md',
    };

    const history = buildReviewHistory([closed, currentStory]);
    const month = history.years[0]?.quarters[0]?.months[0];

    expect(month?.summary.storyOutcomes).toEqual({
      achieved: 1,
      notAchieved: 0,
      closed: 0,
    });
    expect(month?.summary.completedTasksByEffectiveTag).toEqual([
      { tag: 'area/frozen', completedTasks: 2 },
    ]);
    expect(month?.summary.completedTasksByEffectiveTag).not.toContainEqual(
      expect.objectContaining({ tag: 'area/current' }),
    );
    expect(month?.sprints[0]?.stories[0]?.path).toBe(currentStory.path);
  });
});

function sprint(
  sequence: number,
  closedAt = `2026-01-${String(sequence).padStart(2, '0')}T18:00:00Z`,
): Extract<ProjectedManagedEntity, { type: 'sprint'; lifecycle: 'closed' }> {
  const code = `SPR-${String(sequence).padStart(3, '0')}`;
  return {
    id: `01994744-a401-759a-b582-${String(sequence).padStart(12, '0')}`,
    type: 'sprint',
    lifecycle: 'closed',
    code,
    sequence,
    startsOn: '2026-01-01',
    dueOn: '2026-01-01',
    startedAt: '2026-01-01T08:00:00Z',
    closedAt,
    provisionalStoryOutcomes: [],
    startSnapshot: { capturedAt: '2026-01-01T08:00:00Z', stories: [] },
    closeSnapshot: {
      operationId: `01994a8a-0371-7a2d-a3e9-${String(sequence).padStart(12, '0')}`,
      capturedAt: closedAt,
      stories: [],
      tasks: [],
      summary: {
        attemptedStories: 0,
        storiesAtStart: 0,
        storiesAtClose: 0,
        storiesAdded: 0,
        storiesRemoved: 0,
        achievedStories: 0,
        notAchievedStories: 0,
        closedStories: 0,
        committedOpenTasks: 0,
        tasksAtStart: 0,
        tasksAtClose: 0,
        tasksAdded: 0,
        tasksRemoved: 0,
        completedDuringSprint: 0,
        openAtClose: 0,
        exceptionCount: 0,
      },
      effectiveTagSummary: [],
    },
    retrospectiveItems: [],
    path: `Focus Flow/Sprints/${code}.md`,
  };
}

function epic(
  key: string,
  lifecycle: 'done' | 'closed',
  finalizedAt: string,
): Extract<ProjectedManagedEntity, { type: 'epic' }> {
  const common = {
    id: `019946c9-5f97-7196-8483-73469275ff${key.slice(-2)}`,
    key,
    title: key,
    type: 'epic' as const,
    backlogRank: null,
    acceptanceCriteria: [],
    createdAt: '2025-12-01T10:00:00Z',
    tags: [],
    effectiveTags: [],
    path: `Focus Flow/Epics/${key} Epic.md`,
  };
  return lifecycle === 'done'
    ? {
        ...common,
        lifecycle,
        completedAt: finalizedAt,
        closedAt: null,
        closeReason: null,
      }
    : {
        ...common,
        lifecycle,
        completedAt: null,
        closedAt: finalizedAt,
        closeReason: null,
      };
}
