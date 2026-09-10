import type { ProjectedManagedEntity, WorkIndex } from '../indexing/work-index';
import { generateKeyBetween } from 'fractional-indexing';
import { compareRank } from '../../domain/ordering';
export interface MonthMembershipPlan { note: Extract<ProjectedManagedEntity, { type: 'story' }>; selected: boolean; backlogRank: string | null }
export class MonthBacklogService {
  private tail: Promise<void> = Promise.resolve();
  constructor(private readonly index: Pick<WorkIndex, 'refresh' | 'getSnapshot'>, private readonly write: (plan: MonthMembershipPlan) => Promise<void>) {}
  setSelected(storyId: string, selected: boolean): Promise<void> {
    const operation = this.tail.then(() => this.setSelectedNow(storyId, selected));
    this.tail = operation.catch(() => undefined);
    return operation;
  }

  private async setSelectedNow(storyId: string, selected: boolean): Promise<void> {
    await this.index.refresh();
    const snapshot = this.index.getSnapshot();
    if (snapshot.phase !== 'ready') throw new Error('Refresh the workspace before planning.');
    const note = uniqueStory(snapshot.entities, storyId);
    if (note.lifecycle !== 'epic_backlog' && note.lifecycle !== 'backlog') throw new Error('Return this Story from its Sprint before changing its Month selection.');
    if (selected === (note.lifecycle === 'backlog')) return;
    assertActiveEpic(snapshot.entities, note.epicId);
    await this.write({ note, selected, backlogRank: selected ? nextMonthRank(snapshot.entities) : null });
    await this.index.refresh();
  }
}

function uniqueStory(entities: readonly ProjectedManagedEntity[], storyId: string): Extract<ProjectedManagedEntity, { type: 'story' }> {
  const matches = entities.filter((entity) => entity.id === storyId);
  const note = matches.length === 1 ? matches[0] : undefined;
  if (note?.type !== 'story') throw new Error('This Story is no longer available.');
  return note;
}

function assertActiveEpic(entities: readonly ProjectedManagedEntity[], epicId: string): void {
  const parents = entities.filter((entity) => entity.id === epicId && entity.type === 'epic' && entity.lifecycle === 'backlog');
  if (parents.length !== 1) throw new Error('The parent Epic is no longer active.');
}

function nextMonthRank(entities: readonly ProjectedManagedEntity[]): string {
  const month = entities.filter((entity): entity is Extract<ProjectedManagedEntity, { type: 'story' }> => entity.type === 'story' && entity.lifecycle === 'backlog').sort((a, b) => compareRank(a.backlogRank!, b.backlogRank!, a.id, b.id));
  return generateKeyBetween(month.at(-1)?.backlogRank ?? null, null);
}
