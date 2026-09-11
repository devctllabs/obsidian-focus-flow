import type { CloseSnapshotStory } from '../../domain/sprint-close';
import type { StoryOutcome } from '../../domain/sprint-note';
import type { ProjectedManagedEntity } from '../indexing/work-index';

type ClosedSprint = Extract<
  ProjectedManagedEntity,
  { type: 'sprint'; lifecycle: 'closed' }
>;
type TerminalEpic = Extract<
  ProjectedManagedEntity,
  { type: 'epic'; lifecycle: 'done' | 'closed' }
>;

interface ReviewProgress {
  closed: number;
  target: number;
}

export interface FinalizedEpicReview {
  id: string;
  key: string;
  title: string;
  lifecycle: 'done' | 'closed';
  finalizedAt: string;
  path: string;
  tags: readonly string[];
}

interface ReviewStory extends CloseSnapshotStory {
  path: string | null;
}

interface ReviewSummary {
  finalizedEpics: { done: number; closed: number };
  storyOutcomes: { achieved: number; notAchieved: number; closed: number };
  completedTasksByEffectiveTag: readonly {
    tag: string;
    completedTasks: number;
  }[];
}

export interface SprintReview {
  sequence: number;
  sprint: ClosedSprint;
  finalizedEpics: readonly FinalizedEpicReview[];
  stories: readonly ReviewStory[];
}

interface MonthReview {
  number: number;
  globalNumber: number;
  progress: ReviewProgress;
  complete: boolean;
  summary: ReviewSummary;
  sprints: readonly SprintReview[];
}

interface QuarterReview {
  number: number;
  globalNumber: number;
  progress: ReviewProgress;
  complete: boolean;
  summary: ReviewSummary;
  months: readonly MonthReview[];
}

interface YearReview {
  number: number;
  progress: ReviewProgress;
  complete: boolean;
  summary: ReviewSummary;
  quarters: readonly QuarterReview[];
}

export interface ReviewHistory {
  years: readonly YearReview[];
  sinceLastSprint: readonly FinalizedEpicReview[];
}

export function buildReviewHistory(
  entities: readonly ProjectedManagedEntity[],
  includedSprintIds?: ReadonlySet<string>,
): ReviewHistory {
  const closedSprints = entities
    .filter((entity): entity is ClosedSprint =>
      entity.type === 'sprint' &&
      entity.lifecycle === 'closed' &&
      entity.pendingClose == null)
    .sort((left, right) => left.sequence - right.sequence);
  const storyPaths = new Map(
    entities.flatMap((entity) =>
      entity.type === 'story' ? [[entity.id, entity.path] as const] : []),
  );
  const epics = entities
    .filter((entity): entity is TerminalEpic =>
      entity.type === 'epic' &&
      (entity.lifecycle === 'done' || entity.lifecycle === 'closed'))
    .map(projectEpic)
    .sort((left, right) =>
      compareTimestamp(left.finalizedAt, right.finalizedAt) ||
      left.key.localeCompare(right.key));
  const epicsBySprint = new Map<number, FinalizedEpicReview[]>();
  const sinceLastSprint: FinalizedEpicReview[] = [];
  const closeBoundaries = [...closedSprints].sort((left, right) =>
    compareTimestamp(left.closedAt, right.closedAt) ||
    left.sequence - right.sequence);

  for (const epic of epics) {
    const boundary = closeBoundaries.find(
      (sprint) => compareTimestamp(sprint.closedAt, epic.finalizedAt) >= 0,
    );
    if (boundary === undefined) {
      sinceLastSprint.push(epic);
      continue;
    }
    const assigned = epicsBySprint.get(boundary.sequence) ?? [];
    assigned.push(epic);
    epicsBySprint.set(boundary.sequence, assigned);
  }

  const sprintReviews = closedSprints.map((sprint): SprintReview => ({
    sequence: sprint.sequence,
    sprint,
    finalizedEpics: epicsBySprint.get(sprint.sequence) ?? [],
    stories: sprint.closeSnapshot.stories.map((story) => ({
      ...story,
      path: storyPaths.get(story.id) ?? null,
    })),
  }));
  const includedReviews = includedSprintIds === undefined
    ? sprintReviews
    : sprintReviews.filter((review) => includedSprintIds.has(review.sprint.id));
  const years = groupByNumber(includedReviews, 48)
    .map(([yearNumber, yearSprints]): YearReview => ({
      number: yearNumber,
      progress: progress(yearSprints, 48),
      complete: yearSprints.length === 48,
      summary: summarize(yearSprints),
      quarters: groupByNumber(yearSprints, 12)
        .map(([globalNumber, quarterSprints]): QuarterReview => ({
          number: ((globalNumber - 1) % 4) + 1,
          globalNumber,
          progress: progress(quarterSprints, 12),
          complete: quarterSprints.length === 12,
          summary: summarize(quarterSprints),
          months: groupByNumber(quarterSprints, 4)
            .map(([monthNumber, monthSprints]): MonthReview => ({
              number: ((monthNumber - 1) % 12) + 1,
              globalNumber: monthNumber,
              progress: progress(monthSprints, 4),
              complete: monthSprints.length === 4,
              summary: summarize(monthSprints),
              sprints: [...monthSprints].sort(
                (left, right) => right.sequence - left.sequence,
              ),
            }))
            .reverse(),
        }))
        .reverse(),
    }))
    .reverse();

  return { years, sinceLastSprint };
}

function projectEpic(epic: TerminalEpic): FinalizedEpicReview {
  return {
    id: epic.id,
    key: epic.key,
    title: epic.title,
    lifecycle: epic.lifecycle,
    finalizedAt: epic.lifecycle === 'done' ? epic.completedAt : epic.closedAt,
    path: epic.path,
    tags: epic.tags,
  };
}

function groupByNumber(
  sprints: readonly SprintReview[],
  size: number,
): Array<[number, SprintReview[]]> {
  const groups = new Map<number, SprintReview[]>();
  for (const sprint of sprints) {
    const number = Math.floor((sprint.sequence - 1) / size) + 1;
    const group = groups.get(number) ?? [];
    group.push(sprint);
    groups.set(number, group);
  }
  return [...groups.entries()].sort(([left], [right]) => left - right);
}

function progress(
  sprints: readonly SprintReview[],
  target: number,
): ReviewProgress {
  return { closed: sprints.length, target };
}

function summarize(sprints: readonly SprintReview[]): ReviewSummary {
  const storyOutcomes = { achieved: 0, notAchieved: 0, closed: 0 };
  const finalizedEpics = { done: 0, closed: 0 };
  const completedTasksByTag = new Map<string, number>();

  for (const review of sprints) {
    for (const epic of review.finalizedEpics) finalizedEpics[epic.lifecycle] += 1;
    for (const story of review.stories) storyOutcomes[outcomeKey(story.outcome)] += 1;
    for (const entry of review.sprint.closeSnapshot.effectiveTagSummary) {
      completedTasksByTag.set(
        entry.tag,
        (completedTasksByTag.get(entry.tag) ?? 0) + entry.completedTasks,
      );
    }
  }

  return {
    finalizedEpics,
    storyOutcomes,
    completedTasksByEffectiveTag: [...completedTasksByTag]
      .map(([tag, completedTasks]) => ({ tag, completedTasks }))
      .sort((left, right) => left.tag.localeCompare(right.tag)),
  };
}

function outcomeKey(
  outcome: StoryOutcome,
): keyof ReviewSummary['storyOutcomes'] {
  return outcome === 'not_achieved' ? 'notAchieved' : outcome;
}

function compareTimestamp(left: string, right: string): number {
  return Date.parse(left) - Date.parse(right);
}
