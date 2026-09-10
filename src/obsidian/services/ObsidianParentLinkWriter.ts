import { normalizePath, TFile, type FileManager, type Vault } from 'obsidian';
import type { ParentLinkWriter } from '../../application/repairs/repair-parent-link';
import type { ParentLinkRepairPlan } from '../../domain/work-note';

export class ObsidianParentLinkWriter implements ParentLinkWriter {
  constructor(
    private readonly vault: Pick<Vault, 'getAbstractFileByPath'>,
    private readonly fileManager: Pick<FileManager, 'processFrontMatter'>,
  ) {}

  async replaceParentLink(plan: ParentLinkRepairPlan): Promise<void> {
    const file = this.vault.getAbstractFileByPath(normalizePath(plan.path));
    if (!(file instanceof TFile)) {
      throw new Error('Focus Flow note was not found.');
    }

    await this.fileManager.processFrontMatter(
      file,
      (frontmatter: Record<string, unknown>) => {
        const managed: unknown = frontmatter.focus_flow;
        const parentIdField =
          plan.field === 'epic_link' ? 'epic_id' : 'story_id';
        if (
          !isRecord(managed) ||
          managed[parentIdField] !== plan.parentId ||
          managed[plan.field] !== plan.expectedValue
        ) {
          throw new Error('Focus Flow note changed before repair.');
        }

        managed[plan.field] = plan.replacementValue;
      },
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
