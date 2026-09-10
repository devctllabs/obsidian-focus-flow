import type {
  ProjectedManagedEntity,
  WorkIndex,
} from '../indexing/work-index';

export interface EpicFinalizationWriter {
  apply(plan: EpicFinalizationPlan): Promise<void>;
}

export interface EpicFinalizationPlan {
  kind: 'complete-epic' | 'close-epic';
  epic: { id: string; path: string; expectedBacklogRank: string };
  children: readonly {
    id: string;
    path: string;
    lifecycle: 'done' | 'closed';
  }[];
  finalizedAt: string;
  closeReason: string | null;
}

export class EpicFinalizationService {
  private tail: Promise<void> = Promise.resolve();

  constructor(
    private readonly writer: EpicFinalizationWriter,
    private readonly index: Pick<WorkIndex, 'refresh' | 'getSnapshot'>,
    private readonly now: () => string,
  ) {}

  complete(epicId: string): Promise<void> {
    return this.enqueue(() => this.finalize(epicId, 'complete-epic', null));
  }

  close(epicId: string, reason: string | null): Promise<void> {
    const normalized = reason?.trim() || null;
    return this.enqueue(() => this.finalize(epicId, 'close-epic', normalized));
  }

  private async finalize(
    epicId: string,
    kind: EpicFinalizationPlan['kind'],
    closeReason: string | null,
  ): Promise<void> {
    await this.index.refresh();
    const snapshot = this.index.getSnapshot();
    if (snapshot.phase !== 'ready') {
      throw new Error('Focus Flow index must be ready before finalizing an Epic.');
    }
    const matches = snapshot.entities.filter(
      (entity): entity is Extract<
        ProjectedManagedEntity,
        { type: 'epic'; lifecycle: 'backlog' }
      > => entity.type === 'epic' && entity.lifecycle === 'backlog' && entity.id === epicId,
    );
    if (matches.length !== 1) throw new Error('Active Epic was not found.');
    const epic = matches[0]!;
    const children = snapshot.entities.filter(
      (entity): entity is Extract<ProjectedManagedEntity, { type: 'story' }> =>
        entity.type === 'story' && entity.epicId === epic.id,
    );
    const terminalChildren = children.filter(
      (story): story is typeof story & { lifecycle: 'done' | 'closed' } =>
        isTerminal(story.lifecycle),
    );
    if (terminalChildren.length !== children.length) {
      throw new Error('Every child Story must be Done or Closed.');
    }
    if (kind === 'complete-epic') {
      if (children.length === 0) {
        throw new Error('Complete requires at least one child Story.');
      }
      const criteria = epic.acceptanceCriteria ?? [];
      if (criteria.length === 0 || criteria.some((criterion) => !criterion.checked)) {
        throw new Error('Complete requires all Epic Acceptance Criteria checked.');
      }
    }
    await this.writer.apply({
      kind,
      epic: {
        id: epic.id,
        path: epic.path,
        expectedBacklogRank: epic.backlogRank,
      },
      children: terminalChildren.map((story) => ({
        id: story.id,
        path: story.path,
        lifecycle: story.lifecycle,
      })),
      finalizedAt: this.now(),
      closeReason,
    });
    await this.index.refresh();
  }

  private enqueue(operation: () => Promise<void>): Promise<void> {
    const result = this.tail.then(operation);
    this.tail = result.catch(() => undefined);
    return result;
  }
}

function isTerminal(lifecycle: string): lifecycle is 'done' | 'closed' {
  return lifecycle === 'done' || lifecycle === 'closed';
}
