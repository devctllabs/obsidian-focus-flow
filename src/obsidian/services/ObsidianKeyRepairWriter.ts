import { normalizePath, TFile, type FileManager, type Vault } from 'obsidian';
import type { KeyRepairWriter } from '../../application/repairs/repair-keys';
import type {
  KeyRepairEntry,
  KeyRepairLink,
  KeyRepairPlan,
} from '../../domain/work-note';

export class ObsidianKeyRepairWriter implements KeyRepairWriter {
  constructor(
    private readonly vault: Pick<Vault, 'getAbstractFileByPath'>,
    private readonly fileManager: Pick<
      FileManager,
      'processFrontMatter' | 'renameFile'
    >,
  ) {}

  async repairKeys(plan: KeyRepairPlan): Promise<void> {
    this.preflightDestinations(plan.entries);
    const replacementsByPath = new Map(
      plan.entries.map((entry) => [entry.path, entry.replacementPath]),
    );
    for (const link of plan.links) {
      await this.repairLink(link, replacementsByPath.get(link.path));
    }

    for (const entry of plan.entries) {
      await this.repairEntry(entry);
    }
  }

  private preflightDestinations(entries: readonly KeyRepairEntry[]): void {
    for (const entry of entries) {
      const source = this.vault.getAbstractFileByPath(normalizePath(entry.path));
      const destination = this.vault.getAbstractFileByPath(
        normalizePath(entry.replacementPath),
      );

      if (source instanceof TFile) {
        if (destination !== null) {
          throw new Error('Focus Flow key repair destination already exists.');
        }
        continue;
      }
      if (destination instanceof TFile) continue;
      if (destination !== null) {
        throw new Error('Focus Flow key repair destination already exists.');
      }
      throw new Error('Focus Flow note was not found.');
    }
  }

  private async repairEntry(entry: KeyRepairEntry): Promise<void> {
    const source = this.vault.getAbstractFileByPath(normalizePath(entry.path));
    const destination = this.vault.getAbstractFileByPath(
      normalizePath(entry.replacementPath),
    );
    const file = source instanceof TFile ? source : destination;
    if (!(file instanceof TFile)) {
      throw new Error('Focus Flow note was not found.');
    }

    await this.fileManager.processFrontMatter(
      file,
      (frontmatter: Record<string, unknown>) => {
        const managed: unknown = frontmatter.focus_flow;
        if (!isRecord(managed) || managed.id !== entry.id) {
          throw new Error('Focus Flow note changed before key repair.');
        }

        const currentKey = managed.key;
        if (currentKey === entry.replacementKey) return;
        if (currentKey !== entry.expectedKey || !(source instanceof TFile)) {
          throw new Error('Focus Flow note changed before key repair.');
        }
        managed.key = entry.replacementKey;
      },
    );

    if (source instanceof TFile) {
      await this.fileManager.renameFile(
        source,
        normalizePath(entry.replacementPath),
      );
    }
  }

  private async repairLink(
    link: KeyRepairLink,
    replacementPath: string | undefined,
  ): Promise<void> {
    const source = this.vault.getAbstractFileByPath(normalizePath(link.path));
    const moved = replacementPath
      ? this.vault.getAbstractFileByPath(normalizePath(replacementPath))
      : null;
    const file = source instanceof TFile ? source : moved;
    if (!(file instanceof TFile)) {
      throw new Error('Focus Flow note was not found.');
    }

    await this.fileManager.processFrontMatter(
      file,
      (frontmatter: Record<string, unknown>) => {
        const managed: unknown = frontmatter.focus_flow;
        const parentIdField =
          link.field === 'epic_link' ? 'epic_id' : 'story_id';
        if (!isRecord(managed) || managed[parentIdField] !== link.parentId) {
          throw new Error('Focus Flow note changed before key repair.');
        }

        const currentLink = managed[link.field];
        if (
          typeof currentLink === 'string' &&
          linksTargetSameNote(currentLink, link.replacementValue)
        ) {
          return;
        }
        if (currentLink !== link.expectedValue) {
          throw new Error('Focus Flow note changed before key repair.');
        }
        managed[link.field] = link.replacementValue;
      },
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function linksTargetSameNote(left: string, right: string): boolean {
  const leftTarget = linkTarget(left);
  const rightTarget = linkTarget(right);
  if (leftTarget === null || rightTarget === null) return false;

  return (
    leftTarget === rightTarget ||
    leftTarget.endsWith(`/${rightTarget}`) ||
    rightTarget.endsWith(`/${leftTarget}`)
  );
}

function linkTarget(link: string): string | null {
  const match = link
    .trim()
    .match(/^\[\[([^#|\]]+)(?:#[^|\]]*)?(?:\|[^\]]*)?\]\]$/);
  return match?.[1]?.trim().replace(/\.md$/, '') ?? null;
}
