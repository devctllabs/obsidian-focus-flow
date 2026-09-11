import type { WorkIndex } from '../indexing/work-index';
import type { MoveNoteRepairPlan } from '../../domain/work-note';

export interface NoteMover {
  moveNote(plan: MoveNoteRepairPlan): Promise<void>;
}

export class NotePlacementRepairService {
  constructor(
    private readonly mover: NoteMover,
    private readonly index: Pick<WorkIndex, 'refresh'>,
  ) {}

  async execute(plan: MoveNoteRepairPlan): Promise<void> {
    await this.mover.moveNote(plan);
    await this.index.refresh();
  }
}
