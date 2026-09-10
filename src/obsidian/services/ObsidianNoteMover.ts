import { normalizePath, TFile, type FileManager, type Vault } from 'obsidian';
import type { NoteMover } from '../../application/repairs/repair-note-placement';
import type { MoveNoteRepairPlan } from '../../domain/work-note';

export class ObsidianNoteMover implements NoteMover {
  constructor(
    private readonly vault: Pick<Vault, 'getAbstractFileByPath'>,
    private readonly fileManager: Pick<
      FileManager,
      'processFrontMatter' | 'renameFile'
    >,
    private readonly rootFolder: () => string,
  ) {}

  async moveNote(plan: MoveNoteRepairPlan): Promise<void> {
    const sourcePath = normalizePath(plan.path);
    const filename = sourcePath.split('/').at(-1);
    if (!filename) throw new Error('Focus Flow note path is invalid.');

    const destinationPath = normalizePath(
      `${this.rootFolder()}/${plan.targetFolder}/${filename}`,
    );
    const source = this.vault.getAbstractFileByPath(sourcePath);
    const destination = this.vault.getAbstractFileByPath(destinationPath);

    if (!(source instanceof TFile)) {
      if (destination instanceof TFile) {
        await this.validateIdentity(destination, plan.id);
        return;
      }
      if (destination !== null) {
        throw new Error('Focus Flow destination already exists.');
      }
      throw new Error('Focus Flow note was not found.');
    }
    if (destination !== null) {
      throw new Error('Focus Flow destination already exists.');
    }

    await this.validateIdentity(source, plan.id);
    await this.fileManager.renameFile(source, destinationPath);
  }

  private async validateIdentity(file: TFile, id: string): Promise<void> {
    await this.fileManager.processFrontMatter(
      file,
      (frontmatter: Record<string, unknown>) => {
        const managed: unknown = frontmatter.focus_flow;
        if (!isRecord(managed) || managed.id !== id) {
          throw new Error('Focus Flow note changed before move repair.');
        }
      },
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
