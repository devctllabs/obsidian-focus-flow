import { normalizePath, TFile, type FileManager, type Vault } from 'obsidian';
import type {
  IdRepairWriter,
  ResolvedIdRepairPlan,
} from '../../application/repairs/repair-ids';

export class ObsidianIdRepairWriter implements IdRepairWriter {
  constructor(
    private readonly vault: Pick<Vault, 'getAbstractFileByPath'>,
    private readonly fileManager: Pick<FileManager, 'processFrontMatter'>,
  ) {}

  async repairIds(plan: ResolvedIdRepairPlan): Promise<void> {
    this.preflight([
      ...plan.references.map(({ path }) => path),
      ...plan.entries.map(({ path }) => path),
    ]);

    for (const reference of plan.references) {
      await this.updateManagedField(
        reference.path,
        reference.field,
        reference.expectedId,
        reference.replacementId,
      );
    }
    for (const entry of plan.entries) {
      await this.updateManagedField(
        entry.path,
        'id',
        entry.expectedId,
        entry.replacementId,
      );
    }
  }

  private preflight(paths: readonly string[]): void {
    for (const path of new Set(paths)) {
      if (
        !(this.vault.getAbstractFileByPath(normalizePath(path)) instanceof TFile)
      ) {
        throw new Error('Focus Flow note was not found.');
      }
    }
  }

  private async updateManagedField(
    path: string,
    field: 'id' | 'epic_id' | 'story_id' | 'sprint_id',
    expectedId: string,
    replacementId: string,
  ): Promise<void> {
    const file = this.vault.getAbstractFileByPath(normalizePath(path));
    if (!(file instanceof TFile)) {
      throw new Error('Focus Flow note was not found.');
    }

    await this.fileManager.processFrontMatter(
      file,
      (frontmatter: Record<string, unknown>) => {
        const managed: unknown = frontmatter.focus_flow;
        if (!isRecord(managed)) {
          throw new Error('Focus Flow note changed before UUID repair.');
        }
        if (managed[field] === replacementId) return;
        if (managed[field] !== expectedId) {
          throw new Error('Focus Flow note changed before UUID repair.');
        }
        managed[field] = replacementId;
      },
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
