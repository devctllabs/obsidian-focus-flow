import {
  normalizePath,
  TFile,
  type FileManager,
  type Vault,
} from 'obsidian';
import type {
  TaskMovementPlan,
  TaskMovementWriter,
} from '../../application/focus/focus-board';

type ManagedField =
  | 'lifecycle'
  | 'status'
  | 'task_rank'
  | 'started_at'
  | 'completed_at';

const MOVEMENT_FIELDS: readonly [
  ManagedField,
  keyof TaskMovementPlan,
  keyof TaskMovementPlan,
][] = [
  ['lifecycle', 'expectedLifecycle', 'replacementLifecycle'],
  ['status', 'expectedStatus', 'replacementStatus'],
  ['task_rank', 'expectedTaskRank', 'replacementTaskRank'],
  ['started_at', 'expectedStartedAt', 'replacementStartedAt'],
  ['completed_at', 'expectedCompletedAt', 'replacementCompletedAt'],
];

export class ObsidianTaskMovementWriter implements TaskMovementWriter {
  constructor(
    private readonly vault: Pick<Vault, 'getAbstractFileByPath'>,
    private readonly fileManager: Pick<FileManager, 'processFrontMatter'>,
  ) {}

  async move(plan: TaskMovementPlan): Promise<void> {
    const file = this.vault.getAbstractFileByPath(normalizePath(plan.path));
    if (!(file instanceof TFile)) {
      throw new Error('Task was not found.');
    }

    await this.fileManager.processFrontMatter(
      file,
      (frontmatter: Record<string, unknown>) => {
        const managed: unknown = frontmatter.focus_flow;
        if (!isRecord(managed) || managed.id !== plan.id) {
          throw new Error('Task changed before the move.');
        }

        const alreadyApplied = MOVEMENT_FIELDS.every(
          ([field, , replacement]) => managed[field] === plan[replacement],
        );
        if (alreadyApplied) return;

        const matchesExpected = MOVEMENT_FIELDS.every(
          ([field, expected]) => managed[field] === plan[expected],
        );
        if (!matchesExpected) {
          throw new Error('Task changed before the move.');
        }

        for (const [field, , replacement] of MOVEMENT_FIELDS) {
          managed[field] = plan[replacement];
        }
      },
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
