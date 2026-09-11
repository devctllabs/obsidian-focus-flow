import { TFile, type Vault } from 'obsidian';
import { parseDocument } from 'yaml';
import { managedEqual, isManagedRecord, type ManagedBlock, type ManagedState } from '../../domain/managed-replacement';
import type { ManagedReplacementStore } from '../../application/workspace/apply-replacements';

export function readManagedMarkdown(markdown: string) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) throw new Error('Managed frontmatter is missing.');
  const doc = parseDocument(match[1]!);
  if (doc.errors.length) throw new Error('Fix invalid YAML before changing this note.');
  const data: unknown = doc.toJS();
  if (!isManagedRecord(data) || !isManagedRecord(data.focus_flow)) throw new Error('Managed frontmatter is missing.');
  try { JSON.stringify(data.focus_flow); }
  catch { throw new Error('Remove cyclic YAML aliases before changing this note.'); }
  return { doc, managed: data.focus_flow, body: markdown.slice(match[0].length) };
}

export class ObsidianManagedStore implements ManagedReplacementStore {
  constructor(readonly vault: Pick<Vault, 'getAbstractFileByPath' | 'getMarkdownFiles' | 'read' | 'process' | 'createFolder' | 'create' | 'rename'>, readonly root: () => string) {}
  async read(path: string): Promise<ManagedBlock | null> {
    this.assertPath(path);
    const file = this.vault.getAbstractFileByPath(path);
    if (file === null) return null;
    if (!(file instanceof TFile)) throw new Error(`A folder occupies ${path}. Choose a free destination.`);
    return readManagedMarkdown(await this.vault.read(file)).managed;
  }
  async list(): Promise<ManagedState[]> {
    const result = await this.scan();
    if (result.diagnostics.length) throw new Error(result.diagnostics[0]);
    return result.notes;
  }
  async scan() {
    const notes: ManagedState[] = [];
    const diagnostics: string[] = [];
    for (const file of this.vault.getMarkdownFiles()) {
      if (!file.path.startsWith(`${this.root()}/`) || !/^(Epics|Stories|Tasks|Sprints)\//.test(file.path.slice(this.root().length + 1))) continue;
      try {
        const managed = await this.read(file.path);
        if (managed) notes.push({ path: file.path, managed });
      } catch (error) { diagnostics.push(`${file.path}: ${error instanceof Error ? error.message : 'Could not inspect this note.'}`); }
    }
    return { notes, diagnostics };
  }
  async replace(path: string, expected: ManagedBlock, replacement: ManagedBlock) {
    await this.transform(path, (managed) => {
      if (!managedEqual(managed, expected)) throw new Error(`Work changed at ${path}. Refresh and review it again.`);
      return replacement;
    });
  }
  async transform(path: string, change: (managed: ManagedBlock) => ManagedBlock, bodyTransform: (body: string) => string = (body) => body) {
    this.assertPath(path);
    const file = this.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) throw new Error(`Note was not found: ${path}.`);
    await this.vault.process(file, (markdown) => {
      if (file.path !== path) throw new Error('The note moved before this change. Refresh and retry.');
      const { doc, managed, body } = readManagedMarkdown(markdown);
      doc.set('focus_flow', doc.createNode(change(managed), { aliasDuplicateObjects: false }));
      return `---\n${doc.toString()}---\n${bodyTransform(body)}`;
    });
  }
  async move(path: string, destination: string, expected: ManagedBlock) {
    this.assertPath(destination);
    if (!managedEqual(await this.read(path), expected)) throw new Error(`Work changed before moving ${path}.`);
    if (this.vault.getAbstractFileByPath(destination) !== null) throw new Error(`Destination already exists: ${destination}.`);
    await this.ensureFolders(destination.split('/').slice(0, -1).join('/'));
    const file = this.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) throw new Error(`Note was not found: ${path}.`);
    // FileManager.renameFile rewrites wikilinks throughout the vault, including
    // immutable snapshots and captured recovery blocks. This plan owns its links.
    await this.vault.rename(file, destination);
  }
  private async ensureFolders(folder: string) {
    const parts = folder.split('/');
    for (let end = 1; end <= parts.length; end++) {
      const path = parts.slice(0, end).join('/');
      if (this.vault.getAbstractFileByPath(path) === null) await this.vault.createFolder(path);
    }
  }
  assertPath(path: string) {
    if (!path.startsWith(`${this.root()}/`) || path.includes('\\') || path.split('/').some((part) => part === '..' || part === '.' || !part)) throw new Error('Operation path is outside the current workspace.');
  }
}
