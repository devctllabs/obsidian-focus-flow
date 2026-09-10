import {
  mkdir,
  readFile,
  readdir,
  writeFile,
} from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { isManagedWorkNotePath } from '../application/indexing/managed-path';
import type { WorkNoteSourceRepository } from '../application/indexing/work-index';
import type {
  WorkCreator,
  WorkTemplateRenderer,
} from '../application/work/create-work';
import { renderWorkTemplate } from '../application/work/render-template';
import { STANDARD_BODY_TEMPLATES } from '../application/work/standard-templates';
import {
  serializeWorkCreationPlan,
  type WorkCreationPlan,
} from '../application/work/serialize-work-note';
import { noteFilename } from '../domain/note-filename';
import type { WorkNoteSource } from '../domain/work-note';
import type { FocusFlowSettings } from '../settings';

export class FilesystemWorkNoteRepository implements WorkNoteSourceRepository {
  constructor(
    private readonly vaultPath: string,
    private readonly rootFolder: string,
  ) {}

  async readMission(): Promise<{ path: string; body: string | null }> {
    const path = `${normalizeVaultPath(this.rootFolder)}/MISSION.md`;
    return { path, body: await readOptional(resolveVaultPath(this.vaultPath, path)) };
  }

  async readTagCatalog(): Promise<{ path: string; body: string | null }> {
    const path = `${normalizeVaultPath(this.rootFolder)}/TAGS.md`;
    return { path, body: await readOptional(resolveVaultPath(this.vaultPath, path)) };
  }

  async list(): Promise<readonly WorkNoteSource[]> {
    const root = resolveVaultPath(this.vaultPath, this.rootFolder);
    const paths = await listMarkdownFiles(root);
    const sources = await Promise.all(
      paths.map(async (absolutePath): Promise<WorkNoteSource | null> => {
        const path = toVaultPath(this.vaultPath, absolutePath);
        if (!isManagedWorkNotePath(path, this.rootFolder)) return null;
        const body = await readFile(absolutePath, 'utf8');
        return { path, frontmatter: parseFrontmatter(body), body };
      }),
    );
    return sources.filter((source): source is WorkNoteSource => source !== null);
  }

  async read(path: string): Promise<WorkNoteSource | null> {
    const body = await readOptional(resolveVaultPath(this.vaultPath, path));
    return body === null ? null : { path, frontmatter: parseFrontmatter(body), body };
  }
}

export class FilesystemTemplateRenderer implements WorkTemplateRenderer {
  constructor(
    private readonly vaultPath: string,
    private readonly settings: FocusFlowSettings,
  ) {}

  async render(
    kind: 'candidate' | 'task',
    variables: Parameters<WorkTemplateRenderer['render']>[1],
  ): Promise<string> {
    const template =
      (await readOptional(
        resolveVaultPath(this.vaultPath, this.settings.templates[kind]),
      )) ?? STANDARD_BODY_TEMPLATES[kind];
    return renderWorkTemplate(template, variables);
  }
}

export class FilesystemWorkCreator implements WorkCreator {
  constructor(
    private readonly vaultPath: string,
    private readonly rootFolder: string,
  ) {}

  async create(plan: WorkCreationPlan): Promise<string> {
    const folder = `${normalizeVaultPath(this.rootFolder)}/${
      plan.kind === 'candidate' ? 'Inbox' : 'Tasks'
    }`;
    const path = `${folder}/${noteFilename(plan.key, plan.title)}`;
    const absolutePath = resolveVaultPath(this.vaultPath, path);
    await mkdir(dirname(absolutePath), { recursive: true });
    try {
      await writeFile(absolutePath, serializeWorkCreationPlan(plan), {
        encoding: 'utf8',
        flag: 'wx',
      });
    } catch (error) {
      if (isNodeError(error) && error.code === 'EEXIST') {
        throw new Error('Focus Flow note already exists.');
      }
      throw error;
    }
    return path;
  }
}

function parseFrontmatter(body: string): unknown {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(body);
  if (match === null) return {};
  try {
    return parseYaml(match[1] ?? '') ?? {};
  } catch {
    return {};
  }
}

async function listMarkdownFiles(root: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') return [];
    throw error;
  }
  const nested = await Promise.all(
    entries.map(async (entry): Promise<string[]> => {
      const path = resolve(root, entry.name);
      if (entry.isDirectory()) return listMarkdownFiles(path);
      return entry.isFile() && entry.name.toLowerCase().endsWith('.md')
        ? [path]
        : [];
    }),
  );
  return nested.flat().sort();
}

function resolveVaultPath(vaultPath: string, vaultRelativePath: string): string {
  const vault = resolve(vaultPath);
  const path = resolve(vault, normalizeVaultPath(vaultRelativePath));
  if (path !== vault && !path.startsWith(`${vault}${sep}`)) {
    throw new Error('Focus Flow path escapes the vault.');
  }
  return path;
}

function toVaultPath(vaultPath: string, absolutePath: string): string {
  return relative(resolve(vaultPath), absolutePath).split(sep).join('/');
}

function normalizeVaultPath(path: string): string {
  return path.replaceAll('\\', '/').replace(/^\/+|\/+$/g, '');
}

async function readOptional(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') return null;
    throw error;
  }
}

function isNodeError(error: unknown): error is Error & { code: string } {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof error.code === 'string'
  );
}
