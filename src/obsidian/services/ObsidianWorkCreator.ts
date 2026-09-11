import { normalizePath, type Vault } from 'obsidian';
import type {
  WorkCreator,
} from '../../application/work/create-work';
import {
  serializeWorkCreationPlan,
  type WorkCreationPlan,
} from '../../application/work/serialize-work-note';
import { noteFilename } from '../../domain/note-filename';

export class ObsidianWorkCreator implements WorkCreator {
  constructor(
    private readonly vault: Pick<
      Vault,
      'getAbstractFileByPath' | 'createFolder' | 'create'
    >,
    private readonly getRootFolder: () => string,
  ) {}

  async create(plan: WorkCreationPlan): Promise<string> {
    const folder = normalizePath(
      `${this.getRootFolder()}/${plan.kind === 'candidate' ? 'Inbox' : 'Tasks'}`,
    );
    await this.ensureFolder(folder);
    const path = normalizePath(`${folder}/${noteFilename(plan.key, plan.title)}`);
    if (this.vault.getAbstractFileByPath(path) !== null) {
      throw new Error('Focus Flow note already exists.');
    }

    const file = await this.vault.create(path, serializeWorkCreationPlan(plan));
    return file.path;
  }

  private async ensureFolder(path: string): Promise<void> {
    const segments = path.split('/');
    for (let length = 1; length <= segments.length; length += 1) {
      const current = segments.slice(0, length).join('/');
      if (this.vault.getAbstractFileByPath(current) === null) {
        await this.vault.createFolder(current);
      }
    }
  }
}
