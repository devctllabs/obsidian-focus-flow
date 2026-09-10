import { TFile, normalizePath, type FileManager, type Vault } from 'obsidian';
import type { DeletableWork, WorkTrashStorage } from '../../application/work/delete-work';

export class ObsidianWorkTrash implements WorkTrashStorage {
  constructor(private readonly vault: Pick<Vault, 'getAbstractFileByPath' | 'read'>, private readonly fileManager: Pick<FileManager, 'trashFile'>, private readonly getRoot: () => string) {}

  private file(note: DeletableWork): TFile {
    const folder = note.type === 'candidate' ? (note.lifecycle === 'rejected' ? 'Distractions' : 'Inbox') : { epic: 'Epics', story: 'Stories', task: 'Tasks' }[note.type];
    const path = normalizePath(note.path);
    if (!path.startsWith(`${normalizePath(this.getRoot())}/${folder}/`)) throw new Error('This note is outside the current workspace. Refresh notes and try again.');
    const file = this.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) throw new Error('This note no longer exists. Refresh notes to update the view.');
    return file;
  }

  read(note: DeletableWork): Promise<string> { return this.vault.read(this.file(note)); }

  async trash(note: DeletableWork, expectedContent: string): Promise<void> {
    const file = this.file(note);
    if (await this.vault.read(file) !== expectedContent) throw new Error('This note changed. Cancel and reopen Delete to review it again.');
    await this.fileManager.trashFile(file);
  }
}
