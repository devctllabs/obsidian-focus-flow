import { generateKeyBetween } from 'fractional-indexing';
import type {
  ProjectedManagedEntity,
  WorkIndex,
  WorkIndexSnapshot,
} from '../indexing/work-index';
import type { RankWriter } from '../repairs/repair-ranks';
import type { RankField, RankRepairPlan } from '../../domain/work-note';
import { compareRank } from '../../domain/ordering';

interface RankedItem {
  id: string;
  path: string;
  rank: string;
}

interface ReorderCollection {
  label: string;
  field: RankField;
  items: RankedItem[];
}

export class PlanningReorderService {
  private tail: Promise<void> = Promise.resolve();

  constructor(
    private readonly writer: RankWriter,
    private readonly index: Pick<WorkIndex, 'refresh' | 'getSnapshot'>,
  ) {}

  execute(entityId: string, targetIndex: number): Promise<void> {
    const operation = this.tail.then(() => this.executeNow(entityId, targetIndex));
    this.tail = operation.catch(() => undefined);
    return operation;
  }

  private async executeNow(entityId: string, targetIndex: number): Promise<void> {
    await this.index.refresh();
    const snapshot = this.index.getSnapshot();
    if (snapshot.phase !== 'ready') throw new Error('Focus Flow index must be ready before reordering.');
    const entity = uniqueEntity(snapshot.entities, entityId);
    const collection = collectionFor(snapshot, entity);
    const sourceIndex = collection.items.findIndex((item) => item.id === entityId);
    assertReorderTarget(sourceIndex, targetIndex, collection.items.length);
    if (sourceIndex === targetIndex) return;
    const plan = reorderPlan(collection, sourceIndex, targetIndex);
    await this.writer.rebalanceRanks(plan);
    await this.index.refresh();
  }
}

function assertReorderTarget(sourceIndex: number, targetIndex: number, length: number): void {
  if (sourceIndex === -1 || !Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= length) throw new Error('Reorder target is outside the collection.');
}

function reorderPlan(collection: ReorderCollection, sourceIndex: number, targetIndex: number): RankRepairPlan {
  const [moving] = collection.items.splice(sourceIndex, 1);
  if (!moving) throw new Error('Work item cannot be reordered in Plan.');
  const before = collection.items[targetIndex - 1];
  const after = collection.items[targetIndex];
  return { kind: 'rebalance-ranks', collectionLabel: collection.label, entries: [{ path: moving.path, id: moving.id, field: collection.field, expectedValue: moving.rank, replacementValue: generateKeyBetween(before?.rank ?? null, after?.rank ?? null) }] };
}

function uniqueEntity(
  entities: readonly ProjectedManagedEntity[],
  entityId: string,
): ProjectedManagedEntity {
  const matches = entities.filter((entity) => entity.id === entityId);
  if (matches.length !== 1) {
    throw new Error('Work item cannot be reordered in Plan.');
  }
  return matches[0]!;
}

function collectionFor(
  snapshot: WorkIndexSnapshot,
  entity: ProjectedManagedEntity,
): ReorderCollection {
  if (entity.type === 'epic' && entity.lifecycle === 'backlog') return epicCollection(snapshot);
  if (entity.type === 'story' && entity.lifecycle === 'backlog' && entity.backlogRank !== null) return monthCollection(snapshot);
  if (entity.type === 'story' && sprintStoryIsRanked(entity)) return sprintCollection(snapshot, entity);
  if (entity.type === 'task') return taskCollection(snapshot, entity);
  throw new Error('Work item cannot be reordered in Plan.');
}

function epicCollection(snapshot: WorkIndexSnapshot): ReorderCollection {
  const items = snapshot.entities.filter((item): item is Extract<ProjectedManagedEntity, { type: 'epic'; lifecycle: 'backlog' }> => item.type === 'epic' && item.lifecycle === 'backlog').map((item) => rankedItem(item, item.backlogRank)).sort(compareRankedItems);
  return { label: 'the Epic Backlog', field: 'backlog_rank', items };
}

function monthCollection(snapshot: WorkIndexSnapshot): ReorderCollection {
  const items = snapshot.entities.filter((item): item is Extract<ProjectedManagedEntity, { type: 'story' }> & { backlogRank: string } => item.type === 'story' && item.lifecycle === 'backlog' && item.backlogRank !== null).map((item) => rankedItem(item, item.backlogRank)).sort(compareRankedItems);
  return { label: 'the Month Backlog', field: 'backlog_rank', items };
}

function sprintStoryIsRanked(entity: Extract<ProjectedManagedEntity, { type: 'story' }>): boolean {
  return (entity.lifecycle === 'draft_sprint' || entity.lifecycle === 'active_sprint') && entity.sprintId !== null && entity.sprintRank !== null;
}

function sprintCollection(snapshot: WorkIndexSnapshot, entity: Extract<ProjectedManagedEntity, { type: 'story' }>): ReorderCollection {
  const sprint = snapshot.entities.find((item) => item.type === 'sprint' && item.id === entity.sprintId);
  if (!sprintMatchesStory(sprint, entity)) throw new Error('Work item cannot be reordered in Plan.');
  const items = snapshot.entities.filter((item): item is Extract<ProjectedManagedEntity, { type: 'story' }> & { sprintRank: string } => item.type === 'story' && item.lifecycle === entity.lifecycle && item.sprintId === entity.sprintId && item.sprintRank !== null).map((item) => rankedItem(item, item.sprintRank)).sort(compareRankedItems);
  const label = sprint.lifecycle === 'draft' ? 'Stories for Draft Sprint' : `Stories for ${sprint.code}`;
  return { label, field: 'sprint_rank', items };
}

function sprintMatchesStory(sprint: ProjectedManagedEntity | undefined, entity: Extract<ProjectedManagedEntity, { type: 'story' }>): sprint is Extract<ProjectedManagedEntity, { type: 'sprint' }> {
  if (sprint?.type !== 'sprint') return false;
  if (entity.lifecycle === 'draft_sprint') return sprint.lifecycle === 'draft';
  return entity.lifecycle === 'active_sprint' && sprint.lifecycle === 'active';
}

function taskCollection(snapshot: WorkIndexSnapshot, entity: Extract<ProjectedManagedEntity, { type: 'task' }>): ReorderCollection {
  const parents = snapshot.entities.filter((item) => item.type === 'story' && item.id === entity.storyId);
  const parent = parents.length === 1 ? parents[0] : undefined;
  if (parent?.type !== 'story') throw new Error('Work item cannot be reordered in Plan.');
  const items = snapshot.entities.filter((item): item is Extract<ProjectedManagedEntity, { type: 'task' }> => item.type === 'task' && item.storyId === entity.storyId).map((item) => rankedItem(item, item.taskRank)).sort(compareRankedItems);
  return { label: `Tasks for ${parent.key}`, field: 'task_rank', items };
}

function rankedItem(
  item: Pick<ProjectedManagedEntity, 'id' | 'path'>,
  rank: string,
): RankedItem {
  return { id: item.id, path: item.path, rank };
}

function compareRankedItems(left: RankedItem, right: RankedItem): number {
  return compareRank(left.rank, right.rank, left.id, right.id);
}
