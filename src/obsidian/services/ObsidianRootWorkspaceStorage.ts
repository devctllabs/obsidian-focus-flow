import {
  normalizePath,
  TFile,
  TFolder,
  type FileManager,
  type MetadataCache,
  type Vault,
} from 'obsidian';
import { WorkIndex } from '../../application/indexing/work-index';
import type { RootWorkspaceStorage } from '../../application/root/root-workspace';
import { ObsidianWorkNoteSourceRepository } from './ObsidianWorkNoteSourceRepository';

type RootVault = Pick<
  Vault,
  | 'getAbstractFileByPath'
  | 'getMarkdownFiles'
  | 'read'
  | 'createFolder'
  | 'create'
>;

export class ObsidianRootWorkspaceStorage implements RootWorkspaceStorage {
  constructor(
    private readonly vault: RootVault,
    private readonly fileManager: Pick<FileManager, 'renameFile'>,
    private readonly metadataCache: MetadataCache,
  ) {}

  async kind(path: string): Promise<'missing' | 'file' | 'folder'> {
    const entry = this.vault.getAbstractFileByPath(normalizePath(path));
    if (entry instanceof TFile) return 'file';
    if (entry instanceof TFolder) return 'folder';
    return 'missing';
  }

  async validate(root: string): Promise<{ warnings: string[]; errors: string[] }> {
    if ((await this.kind(root)) === 'missing') return { warnings: [], errors: [] };
    const index = new WorkIndex(
      new ObsidianWorkNoteSourceRepository(
        this.vault,
        this.metadataCache,
        () => root,
      ),
    );
    await index.refresh();
    const snapshot = index.getSnapshot();
    if (snapshot.phase === 'error') {
      return {
        warnings: [],
        errors: [snapshot.errorMessage ?? 'Focus Flow could not validate the root.'],
      };
    }
    const warnings: string[] = [];
    const errors: string[] = [];
    for (const diagnostic of snapshot.diagnostics) {
      const warning = diagnostic.severity === 'warning' ||
        diagnostic.code === 'missing-mission';
      (warning ? warnings : errors).push(diagnostic.message);
    }
    return { warnings, errors };
  }

  async createFolder(path: string): Promise<void> {
    if ((await this.kind(path)) === 'missing') {
      await this.vault.createFolder(normalizePath(path));
    }
  }

  async createFile(path: string, body: string): Promise<void> {
    if ((await this.kind(path)) === 'missing') {
      await this.vault.create(normalizePath(path), body);
    }
  }

  async renameRoot(source: string, target: string): Promise<void> {
    const root = this.vault.getAbstractFileByPath(normalizePath(source));
    if (!(root instanceof TFolder)) throw new Error('Focus Flow root was not found.');
    await this.ensureParent(target);
    await this.fileManager.renameFile(root, normalizePath(target));
  }

  private async ensureParent(path: string): Promise<void> {
    const segments = normalizePath(path).split('/').slice(0, -1);
    for (let length = 1; length <= segments.length; length += 1) {
      await this.createFolder(segments.slice(0, length).join('/'));
    }
  }
}
