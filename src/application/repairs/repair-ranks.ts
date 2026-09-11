import type { WorkIndex } from '../indexing/work-index';
import type { RankRepairPlan } from '../../domain/work-note';

export interface RankWriter {
  rebalanceRanks(plan: RankRepairPlan): Promise<void>;
}

export class RankRepairService {
  private tail: Promise<void> = Promise.resolve();

  constructor(
    private readonly writer: RankWriter,
    private readonly index: Pick<WorkIndex, 'refresh'>,
  ) {}

  execute(plan: RankRepairPlan): Promise<void> {
    const operation = this.tail.then(async () => {
      await this.writer.rebalanceRanks(plan);
      await this.index.refresh();
    });
    this.tail = operation.catch(() => undefined);
    return operation;
  }
}
