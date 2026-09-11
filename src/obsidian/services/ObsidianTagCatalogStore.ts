import { TFile, type Vault } from 'obsidian';
import type { TagCatalogStore } from '../../application/tags/tag-catalog';

export class ObsidianTagCatalogStore implements TagCatalogStore {
  constructor(private readonly vault: Pick<Vault, 'getAbstractFileByPath' | 'read' | 'process' | 'create'>, private readonly root: () => string) {}
  async read() {
    const file = this.vault.getAbstractFileByPath(`${this.root()}/TAGS.md`);
    if (file === null) return null;
    if (!(file instanceof TFile)) throw new Error('TAGS.md is a folder. Rename that folder before editing the Tag Catalog.');
    return this.vault.read(file);
  }
  async update(transform: (markdown: string | null) => string) {
    const path = `${this.root()}/TAGS.md`;
    const file = this.vault.getAbstractFileByPath(path);
    if (file instanceof TFile) await this.vault.process(file, transform);
    else if (file === null) await this.vault.create(path, transform(null));
    else throw new Error('TAGS.md is a folder. Rename that folder before editing the Tag Catalog.');
  }
}
