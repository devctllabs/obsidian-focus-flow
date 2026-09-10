import {
  normalizePath,
  parseYaml,
  TFile,
  type MetadataCache,
  type Vault,
} from 'obsidian';
import type { WorkNoteSourceRepository } from '../../application/indexing/work-index';
import { isManagedWorkNotePath } from '../../application/indexing/managed-path';
import { compareOrdinal } from '../../domain/ordering';
import type { WorkNoteSource } from '../../domain/work-note';

export class ObsidianWorkNoteSourceRepository
  implements WorkNoteSourceRepository
{
  constructor(
    private readonly vault: Pick<
      Vault,
      'getMarkdownFiles' | 'getAbstractFileByPath' | 'read'
    >,
    private readonly metadataCache: Pick<MetadataCache, 'getFileCache'>,
    private readonly getRootFolder: () => string,
    private readonly parseYamlDocument: (yaml: string) => unknown = parseYaml,
  ) {}

  async readMission(): Promise<{ path: string; body: string | null }> {
    const path = normalizePath(`${this.getRootFolder()}/MISSION.md`);
    const file = this.vault.getAbstractFileByPath(path);
    return {
      path,
      body: file instanceof TFile ? await this.vault.read(file) : null,
    };
  }

  async list(): Promise<readonly WorkNoteSource[]> {
    const root = normalizePath(this.getRootFolder());
    const files = this.vault
      .getMarkdownFiles()
      .filter((file) => isManagedWorkNotePath(file.path, root))
      .sort((left, right) => compareOrdinal(left.path, right.path));

    return Promise.all(files.map((file) => this.readFile(file)));
  }

  async read(path: string): Promise<WorkNoteSource | null> {
    const file = this.vault.getAbstractFileByPath(normalizePath(path));
    return file instanceof TFile ? this.readFile(file) : null;
  }

  private async readFile(file: TFile): Promise<WorkNoteSource> {
    const body = await this.vault.read(file);
    return {
      path: file.path,
      frontmatter:
        parseFrontmatter(body, this.parseYamlDocument) ??
        this.metadataCache.getFileCache(file)?.frontmatter ??
        {},
      body,
    };
  }
}

function parseFrontmatter(
  body: string,
  parseYamlDocument: (yaml: string) => unknown,
): unknown {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(body);
  if (match === null) return undefined;

  try {
    return parseYamlDocument(match[1] ?? '') ?? {};
  } catch {
    return {};
  }
}
export { isManagedIndexPath } from '../../application/indexing/managed-path';
