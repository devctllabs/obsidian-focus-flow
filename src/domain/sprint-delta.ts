import type { AcceptanceCriterion } from './work-note';

interface SprintDeltaBoundaryStory {
  id: string;
  key: string;
  title: string;
  acceptanceCriteria: readonly AcceptanceCriterion[];
}

interface SprintDeltaBoundaryTask {
  id: string;
  key: string;
  title: string;
}

export interface SprintDeltaBoundary {
  stories: readonly SprintDeltaBoundaryStory[];
  tasks: readonly SprintDeltaBoundaryTask[];
}

export interface SprintDelta {
  addedStories: readonly SprintDeltaBoundaryStory[];
  removedStories: readonly SprintDeltaBoundaryStory[];
  addedTasks: readonly SprintDeltaBoundaryTask[];
  removedTasks: readonly SprintDeltaBoundaryTask[];
  changedAcceptanceCriteriaStories: readonly SprintDeltaBoundaryStory[];
}

export function deriveSprintDelta(
  start: SprintDeltaBoundary,
  close: SprintDeltaBoundary,
): SprintDelta {
  const startStories = new Map(start.stories.map((story) => [story.id, story]));
  const closeStories = new Map(close.stories.map((story) => [story.id, story]));
  const startTasks = new Map(start.tasks.map((task) => [task.id, task]));
  const closeTasks = new Map(close.tasks.map((task) => [task.id, task]));

  return {
    addedStories: difference(closeStories, startStories),
    removedStories: difference(startStories, closeStories),
    addedTasks: difference(closeTasks, startTasks),
    removedTasks: difference(startTasks, closeTasks),
    changedAcceptanceCriteriaStories: [...closeStories.values()]
      .filter((story) => {
        const initial = startStories.get(story.id);
        return (
          initial !== undefined &&
          criterionTexts(initial.acceptanceCriteria) !==
            criterionTexts(story.acceptanceCriteria)
        );
      }),
  };
}

export function isEmptySprintDelta(delta: SprintDelta): boolean {
  return (
    delta.addedStories.length === 0 &&
    delta.removedStories.length === 0 &&
    delta.addedTasks.length === 0 &&
    delta.removedTasks.length === 0 &&
    delta.changedAcceptanceCriteriaStories.length === 0
  );
}

function difference<T extends { id: string }>(
  values: ReadonlyMap<string, T>,
  excluded: ReadonlyMap<string, unknown>,
): T[] {
  return [...values.values()].filter((value) => !excluded.has(value.id));
}

function criterionTexts(criteria: readonly AcceptanceCriterion[]): string {
  return JSON.stringify(criteria.map((criterion) => criterion.text));
}
