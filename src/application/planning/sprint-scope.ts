import type {
  ProjectedManagedEntity,
  WorkIndexSnapshot,
} from '../indexing/work-index';
import type { TaskEntity } from '../../domain/work-note';

type ProjectedActiveSprint = Extract<
  ProjectedManagedEntity,
  { type: 'sprint'; lifecycle: 'active' }
>;

export interface SprintScope {
  sprintId: string;
  sprintPath: string;
  taskIds: ReadonlySet<string>;
  count: number;
}

export function startingSprintScopeCount(
  tasks: readonly Pick<TaskEntity, 'lifecycle' | 'status'>[],
): number {
  return tasks.filter(
    (task) => task.lifecycle === 'active' && task.status !== 'done',
  ).length;
}

export function isCurrentPriorDone(
  task: Pick<TaskEntity, 'status' | 'completedAt'>,
  completedBeforeSprint: boolean,
  sprintStartedAt: string,
): boolean {
  if (task.status !== 'done') return false;
  const startedAt = Date.parse(sprintStartedAt);
  const completedAt = task.completedAt === null ? Number.NaN : Date.parse(task.completedAt);
  return (
    (Number.isFinite(startedAt) && Number.isFinite(completedAt) && completedAt <= startedAt) ||
    (completedBeforeSprint && !Number.isFinite(completedAt))
  );
}

export function activeSprintScope(
  snapshot: WorkIndexSnapshot,
  expectedSprintId?: string,
): SprintScope | null {
  const sprints = snapshot.entities.filter(
    (entity): entity is ProjectedActiveSprint =>
      entity.type === 'sprint' &&
      entity.lifecycle === 'active' &&
      (expectedSprintId === undefined || entity.id === expectedSprintId),
  );
  if (sprints.length !== 1) return null;
  const sprint = sprints[0]!;
  const storyIds = new Set(
    snapshot.entities
      .filter(
        (entity) =>
          entity.type === 'story' &&
          entity.lifecycle === 'active_sprint' &&
          entity.sprintId === sprint.id,
      )
      .map((story) => story.id),
  );
  const currentTaskIds = new Set(
    snapshot.entities
      .filter(
        (entity) => entity.type === 'task' && storyIds.has(entity.storyId),
      )
      .map((task) => task.id),
  );
  const initialTasks = sprint.startSnapshot.stories
    .filter((story) => storyIds.has(story.id))
    .flatMap((story) => story.tasks)
    .filter((task) => currentTaskIds.has(task.id));
  const completedBeforeSprint = new Set(
    initialTasks
      .filter((task) => task.completedBeforeSprint)
      .map((task) => task.id),
  );
  const taskIds = new Set(
    initialTasks
      .filter((task) => !task.completedBeforeSprint)
      .map((task) => task.id),
  );
  for (const entity of snapshot.entities) {
    if (entity.type !== 'task' || !storyIds.has(entity.storyId)) continue;
    if (isCurrentPriorDone(entity, completedBeforeSprint.has(entity.id), sprint.startedAt)) {
      continue;
    }
    taskIds.add(entity.id);
  }
  return {
    sprintId: sprint.id,
    sprintPath: sprint.path,
    taskIds,
    count: taskIds.size,
  };
}
