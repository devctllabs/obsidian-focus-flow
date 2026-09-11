import type { WorkIndex } from '../indexing/work-index';
import type { KeyRepairPlan } from '../../domain/work-note';

export interface KeyRepairWriter {
  repairKeys(plan: KeyRepairPlan): Promise<void>;
}

export class KeyRepairService {
  private tail: Promise<void> = Promise.resolve();

  constructor(
    private readonly writer: KeyRepairWriter,
    private readonly index: Pick<WorkIndex, 'refresh'>,
  ) {}

  execute(plan: KeyRepairPlan): Promise<void> {
    const operation = this.tail.then(async () => {
      await this.writer.repairKeys(plan);
      await this.index.refresh();
    });
    this.tail = operation.catch(() => undefined);
    return operation;
  }
}
