import type { WorkIndex } from '../indexing/work-index';
import type { ParentLinkRepairPlan } from '../../domain/work-note';

export interface ParentLinkWriter {
  replaceParentLink(plan: ParentLinkRepairPlan): Promise<void>;
}

export class ParentLinkRepairService {
  constructor(
    private readonly writer: ParentLinkWriter,
    private readonly index: Pick<WorkIndex, 'refresh'>,
  ) {}

  async execute(plan: ParentLinkRepairPlan): Promise<void> {
    await this.writer.replaceParentLink(plan);
    await this.index.refresh();
  }
}
