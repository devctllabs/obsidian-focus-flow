import { normalizePath, TFile, type FileManager, type Vault } from 'obsidian';
import type { RankWriter } from '../../application/repairs/repair-ranks';
import type { RankRepairPlan } from '../../domain/work-note';

export class ObsidianRankWriter implements RankWriter {
  constructor(
    private readonly vault: Pick<Vault, 'getAbstractFileByPath'>,
    private readonly fileManager: Pick<FileManager, 'processFrontMatter'>,
  ) {}

  async rebalanceRanks(plan: RankRepairPlan): Promise<void> {
    for (const entry of plan.entries) {
      const file = this.vault.getAbstractFileByPath(normalizePath(entry.path));
      if (!(file instanceof TFile)) {
        throw new Error('Focus Flow note was not found.');
      }

      await this.fileManager.processFrontMatter(
        file,
        (frontmatter: Record<string, unknown>) => {
          const managed: unknown = frontmatter.focus_flow;
          if (!isRecord(managed) || managed.id !== entry.id) {
            throw new Error('Focus Flow note changed before rank repair.');
          }

          const currentRank = managed[entry.field];
          if (currentRank === entry.replacementValue) return;
          if (currentRank !== entry.expectedValue) {
            throw new Error('Focus Flow note changed before rank repair.');
          }

          managed[entry.field] = entry.replacementValue;
        },
      );
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
