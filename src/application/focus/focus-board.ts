import { generateKeyBetween } from 'fractional-indexing';
import type {
  ProjectedManagedEntity,
  WorkIndex,
  WorkIndexSnapshot,
} from '../indexing/work-index';
import { compareRank } from '../../domain/ordering';
import {
  allowedTaskDestinations,
  canMoveTask,
  TASK_STATUS_LABELS,
} from '../../domain/task-flow';
import type { TaskStatus } from '../../domain/work-note';
import { evaluateWip, type WipPolicy } from '../../domain/wip-policy';

type Task = Extract<ProjectedManagedEntity, { type: 'task' }>;
type TaskLifecycle = Task['lifecycle'];

export interface FocusWipPolicies {
  tomorrow: WipPolicy;
  today: WipPolicy;
  inProgress: WipPolicy;
}

export interface MoveTaskRequest {
  taskId: string;
  targetStatus: TaskStatus;
  beforeTaskId: string | null;
  afterTaskId: string | null;
  confirmWipExcess: boolean;
}

export type MoveTaskResult =
  | { kind: 'moved' }
  | { kind: 'confirmation-required'; excess: number; message: string }
  | { kind: 'rejected'; message: string };

export interface TaskMovementPlan {
  path: string;
  id: string;
  expectedLifecycle: TaskLifecycle;
  replacementLifecycle: TaskLifecycle;
  expectedStatus: TaskStatus;
  replacementStatus: TaskStatus;
  expectedTaskRank: string;
  replacementTaskRank: string;
  expectedStartedAt: string | null;
  replacementStartedAt: string | null;
  expectedCompletedAt: string | null;
  replacementCompletedAt: string | null;
}

export interface TaskMovementWriter {
  move: (plan: TaskMovementPlan) => Promise<void>;
}

export class FocusBoardService {
  private tail: Promise<void> = Promise.resolve();

  constructor(
    private readonly writer: TaskMovementWriter,
    private readonly index: Pick<WorkIndex, 'refresh' | 'getSnapshot'>,
    private readonly now: () => string,
    private readonly getWipPolicies: () => FocusWipPolicies,
  ) {}

  moveTask(request: MoveTaskRequest): Promise<MoveTaskResult> {
    const operation = this.tail.then(() => this.moveTaskNow(request));
    this.tail = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  private async moveTaskNow(
    request: MoveTaskRequest,
  ): Promise<MoveTaskResult> {
    await this.index.refresh();
    const snapshot = this.index.getSnapshot();
    if (snapshot.phase !== 'ready') {
      throw new Error('Focus Flow index must be ready before moving a Task.');
    }

    const activeTasks = activeSprintTasks(snapshot);
    const moving = uniqueTask(activeTasks, request.taskId);
    const changesStatus = moving.status !== request.targetStatus;
    const transitionError = rejectedTransition(moving, request.targetStatus, changesStatus);
    if (transitionError) return transitionError;

    const wipDecision = evaluateDestinationWip(
      activeTasks,
      moving,
      request.targetStatus,
      this.getWipPolicies(),
    );
    const wipResult = moveWipResult(wipDecision, request);
    if (wipResult) return wipResult;

    const { before, after } = destinationNeighbors(
      activeTasks,
      moving,
      request,
    );
    const rankBounds = canonicalRankBounds(
      activeTasks,
      moving,
      before,
      after,
    );
    await this.writer.move(taskMovementPlan({ moving, request, bounds: rankBounds, changesStatus, movedAt: this.now() }));
    await this.index.refresh();
    return { kind: 'moved' };
  }
}

function rejectedTransition(moving: Task, target: TaskStatus, changesStatus: boolean): MoveTaskResult | null {
  if (!changesStatus || canMoveTask(moving.status, target)) return null;
  return { kind: 'rejected', message: invalidTransitionMessage(moving) };
}

function moveWipResult(decision: ReturnType<typeof evaluateDestinationWip>, request: MoveTaskRequest): MoveTaskResult | null {
  if (decision?.kind === 'reject') return { kind: 'rejected', message: `${TASK_STATUS_LABELS[request.targetStatus]} has a hard WIP limit of ${decision.limit}.` };
  if (decision?.kind === 'confirm' && !request.confirmWipExcess) return { kind: 'confirmation-required', excess: decision.excess, message: `Moving to ${TASK_STATUS_LABELS[request.targetStatus]} exceeds its WIP limit by ${decision.excess}.` };
  return null;
}

function taskMovementPlan({ moving, request, bounds, changesStatus, movedAt }: { moving: Task; request: MoveTaskRequest; bounds: { before: Task | undefined; after: Task | undefined }; changesStatus: boolean; movedAt: string }): TaskMovementPlan {
  return {
    path: moving.path,
    id: moving.id,
    expectedLifecycle: moving.lifecycle,
    replacementLifecycle: replacementLifecycle(moving, request.targetStatus, changesStatus),
    expectedStatus: moving.status,
    replacementStatus: request.targetStatus,
    expectedTaskRank: moving.taskRank,
    replacementTaskRank: replacementRank(moving, bounds),
    expectedStartedAt: moving.startedAt,
    replacementStartedAt: replacementStartedAt(moving, request.targetStatus, changesStatus, movedAt),
    expectedCompletedAt: moving.completedAt,
    replacementCompletedAt: changesStatus && request.targetStatus === 'done' ? movedAt : moving.completedAt,
  };
}

function replacementLifecycle(moving: Task, target: TaskStatus, changesStatus: boolean): TaskLifecycle {
  if (!changesStatus) return moving.lifecycle;
  return target === 'done' ? 'done' : 'active';
}

function replacementRank(moving: Task, bounds: { before: Task | undefined; after: Task | undefined }): string {
  if (bounds.before === undefined && bounds.after === undefined) return moving.taskRank;
  return generateKeyBetween(bounds.before?.taskRank ?? null, bounds.after?.taskRank ?? null);
}

function replacementStartedAt(moving: Task, target: TaskStatus, changesStatus: boolean, movedAt: string): string | null {
  return changesStatus && target === 'in_progress' && moving.startedAt === null ? movedAt : moving.startedAt;
}

function canonicalRankBounds(
  activeTasks: readonly Task[],
  moving: Task,
  before: Task | undefined,
  after: Task | undefined,
): { before: Task | undefined; after: Task | undefined } {
  const ordered = activeTasks
    .filter(
      (task) => task.storyId === moving.storyId && task.id !== moving.id,
    )
    .sort((left, right) =>
      compareRank(left.taskRank, right.taskRank, left.id, right.id),
    );
  if (before !== undefined) {
    const index = ordered.indexOf(before);
    return { before, after: ordered[index + 1] };
  }
  if (after !== undefined) {
    const index = ordered.indexOf(after);
    return { before: ordered[index - 1], after };
  }
  return { before: undefined, after: undefined };
}

function activeSprintTasks(snapshot: WorkIndexSnapshot): Task[] {
  const activeSprints = snapshot.entities.filter(
    (entity) => entity.type === 'sprint' && entity.lifecycle === 'active',
  );
  if (activeSprints.length !== 1) {
    throw new Error('Focus Board requires one Active Sprint.');
  }
  const activeSprint = activeSprints[0]!;
  const storyIds = new Set(
    snapshot.entities
      .filter(
        (entity) =>
          entity.type === 'story' &&
          entity.lifecycle === 'active_sprint' &&
          entity.sprintId === activeSprint.id,
      )
      .map((story) => story.id),
  );

  return snapshot.entities.filter(
    (entity): entity is Task =>
      entity.type === 'task' && storyIds.has(entity.storyId),
  );
}

function uniqueTask(tasks: readonly Task[], taskId: string): Task {
  const matches = tasks.filter((task) => task.id === taskId);
  if (matches.length !== 1) {
    throw new Error('Task does not belong to the Active Sprint.');
  }
  return matches[0]!;
}

function evaluateDestinationWip(
  activeTasks: readonly Task[],
  moving: Task,
  targetStatus: TaskStatus,
  policies: FocusWipPolicies,
):
  | { kind: 'confirm'; excess: number; limit: number }
  | { kind: 'reject'; excess: number; limit: number }
  | null {
  if (moving.status === targetStatus) return null;
  const policy = policyForStatus(targetStatus, policies);
  if (policy === null) return null;

  const proposedCount =
    activeTasks.filter((task) => task.status === targetStatus).length + 1;
  const decision = evaluateWip(policy, proposedCount);
  return decision.kind === 'allow' ? null : { ...decision, limit: policy.limit };
}

function policyForStatus(
  status: TaskStatus,
  policies: FocusWipPolicies,
): WipPolicy | null {
  if (status === 'tomorrow') return policies.tomorrow;
  if (status === 'today') return policies.today;
  if (status === 'in_progress') return policies.inProgress;
  return null;
}

function destinationNeighbors(
  activeTasks: readonly Task[],
  moving: Task,
  request: MoveTaskRequest,
): { before: Task | undefined; after: Task | undefined } {
  const destination = activeTasks
    .filter(
      (task) =>
        task.id !== moving.id &&
        task.storyId === moving.storyId &&
        task.status === request.targetStatus,
    )
    .sort((left, right) =>
      compareRank(left.taskRank, right.taskRank, left.id, right.id),
    );
  const before = referencedTask(destination, request.beforeTaskId);
  const after = referencedTask(destination, request.afterTaskId);
  if (!validNeighbors(destination, before, after, request)) throw new Error('Task move target changed before the operation.');
  return { before, after };
}

function referencedTask(tasks: readonly Task[], id: string | null): Task | undefined {
  return id === null ? undefined : tasks.find((task) => task.id === id);
}

function validNeighbors(destination: readonly Task[], before: Task | undefined, after: Task | undefined, request: MoveTaskRequest): boolean {
  if (!neighborReferencesExist(request, before, after)) return false;
  const beforeIndex = before === undefined ? -1 : destination.indexOf(before);
  const afterIndex = after === undefined ? -1 : destination.indexOf(after);
  return neighborIndexesAreAdjacent(destination.length, beforeIndex, afterIndex);
}

function neighborReferencesExist(request: MoveTaskRequest, before: Task | undefined, after: Task | undefined): boolean {
  return (request.beforeTaskId === null || before !== undefined) && (request.afterTaskId === null || after !== undefined);
}

function neighborIndexesAreAdjacent(length: number, beforeIndex: number, afterIndex: number): boolean {
  if (length === 0) return beforeIndex === -1 && afterIndex === -1;
  if (beforeIndex === -1) return afterIndex === 0;
  if (afterIndex === -1) return beforeIndex === length - 1;
  return beforeIndex >= 0 && afterIndex === beforeIndex + 1;
}

function invalidTransitionMessage(task: Task): string {
  const destinations = allowedTaskDestinations(task.status).map(
    (status) => TASK_STATUS_LABELS[status],
  );
  return `${task.key} can move from ${TASK_STATUS_LABELS[task.status]} only to ${formatList(destinations)}.`;
}

function formatList(values: readonly string[]): string {
  if (values.length <= 1) return values[0] ?? 'no other status';
  if (values.length === 2) return `${values[0]} or ${values[1]}`;
  return `${values.slice(0, -1).join(', ')}, or ${values.at(-1)}`;
}
