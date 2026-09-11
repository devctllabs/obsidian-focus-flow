import { normalizePath, TFile, type Vault } from 'obsidian';
import type { ObsidianNoteOpener } from './ObsidianNoteOpener';

export class ObsidianMissionCreator {
  constructor(
    private readonly vault: Pick<Vault, 'getAbstractFileByPath' | 'create'>,
    private readonly opener: Pick<ObsidianNoteOpener, 'open'>,
    private readonly getRootFolder: () => string,
  ) {}

  async createAndOpen(): Promise<void> {
    const path = normalizePath(`${this.getRootFolder()}/MISSION.md`);
    const existing = this.vault.getAbstractFileByPath(path);
    if (existing === null) {
      await this.vault.create(path, '# Mission\n\n');
    } else if (!(existing instanceof TFile)) {
      throw new Error('MISSION.md is not an ordinary Markdown file.');
    }
    await this.opener.open(path);
  }
}
