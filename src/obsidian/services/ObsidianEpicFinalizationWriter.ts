import { normalizePath, TFile, type FileManager, type Vault } from 'obsidian';
import type {
  EpicFinalizationPlan,
  EpicFinalizationWriter,
} from '../../application/planning/finalize-epic';

export class ObsidianEpicFinalizationWriter implements EpicFinalizationWriter {
  constructor(
    private readonly vault: Pick<Vault, 'getAbstractFileByPath'>,
    private readonly fileManager: Pick<FileManager, 'processFrontMatter'>,
  ) {}

  async apply(plan: EpicFinalizationPlan): Promise<void> {
    for (const child of plan.children) {
      await this.process(child.path, (managed) => {
        if (
          managed.id !== child.id ||
          managed.type !== 'story' ||
          managed.lifecycle !== child.lifecycle ||
          (managed.lifecycle !== 'done' && managed.lifecycle !== 'closed')
        ) {
          throw new Error('Focus Flow child Story changed before Epic finalization.');
        }
      });
    }
    await this.process(plan.epic.path, (managed) => {
      if (managed.id !== plan.epic.id || managed.type !== 'epic') {
        throw new Error('Focus Flow Epic identity changed.');
      }
      if (matchesEndState(managed, plan)) return;
      if (
        managed.lifecycle !== 'backlog' ||
        managed.backlog_rank !== plan.epic.expectedBacklogRank
      ) {
        throw new Error('Focus Flow Epic changed before finalization.');
      }
      delete managed.backlog_rank;
      if (plan.kind === 'complete-epic') {
        managed.lifecycle = 'done';
        managed.completed_at = plan.finalizedAt;
        delete managed.closed_at;
        delete managed.close_reason;
      } else {
        managed.lifecycle = 'closed';
        managed.closed_at = plan.finalizedAt;
        delete managed.completed_at;
        if (plan.closeReason === null) delete managed.close_reason;
        else managed.close_reason = plan.closeReason;
      }
    });
  }

  private async process(
    path: string,
    mutate: (managed: Record<string, unknown>) => void,
  ): Promise<void> {
    const file = this.vault.getAbstractFileByPath(normalizePath(path));
    if (!(file instanceof TFile)) throw new Error('Focus Flow note was not found.');
    await this.fileManager.processFrontMatter(
      file,
      (frontmatter: Record<string, unknown>) => mutate(managedRecord(frontmatter)),
    );
  }
}

function matchesEndState(
  managed: Record<string, unknown>,
  plan: EpicFinalizationPlan,
): boolean {
  return plan.kind === 'complete-epic'
    ? managed.lifecycle === 'done' && managed.completed_at === plan.finalizedAt
    : managed.lifecycle === 'closed' &&
        managed.closed_at === plan.finalizedAt &&
        (managed.close_reason ?? null) === plan.closeReason;
}

function managedRecord(frontmatter: Record<string, unknown>) {
  const managed = frontmatter.focus_flow;
  if (!isRecord(managed)) throw new Error('Focus Flow managed frontmatter is missing.');
  return managed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
