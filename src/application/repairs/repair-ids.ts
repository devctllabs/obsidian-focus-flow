import type { WorkIndex } from '../indexing/work-index';
import type { IdRepairPlan } from '../../domain/work-note';

export interface ResolvedIdRepairPlan {
  entries: ReadonlyArray<
    IdRepairPlan['entries'][number] & { replacementId: string }
  >;
  references: ReadonlyArray<
    IdRepairPlan['references'][number] & { replacementId: string }
  >;
}

export interface IdRepairWriter {
  repairIds(plan: ResolvedIdRepairPlan): Promise<void>;
}

export class IdRepairService {
  private tail: Promise<void> = Promise.resolve();

  constructor(
    private readonly writer: IdRepairWriter,
    private readonly index: Pick<WorkIndex, 'refresh'>,
    private readonly nextId: () => string,
  ) {}

  execute(plan: IdRepairPlan): Promise<void> {
    const operation = this.tail.then(async () => {
      await this.writer.repairIds(this.resolve(plan));
      await this.index.refresh();
    });
    this.tail = operation.catch(() => undefined);
    return operation;
  }

  private resolve(plan: IdRepairPlan): ResolvedIdRepairPlan {
    const replacements = new Map(
      plan.entries.map((entry) => [entry.path, this.nextId()]),
    );
    return {
      entries: plan.entries.map((entry) => ({
        ...entry,
        replacementId: replacements.get(entry.path)!,
      })),
      references: plan.references.map((reference) => {
        const replacementId = replacements.get(reference.replacementForPath);
        if (replacementId === undefined) {
          throw new Error('Focus Flow UUID repair plan is inconsistent.');
        }
        return { ...reference, replacementId };
      }),
    };
  }
}
