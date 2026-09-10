import type { FocusFlowSettings } from '../../settings';
import {
  STANDARD_BODY_TEMPLATES,
  type StandardTemplateKind,
} from '../work/standard-templates';

const ROOT_FOLDERS = [
  '',
  'Inbox',
  'Distractions',
  'Epics',
  'Stories',
  'Tasks',
  'Sprints',
  'Templates',
] as const;

const TEMPLATE_FILES: ReadonlyArray<
  readonly [StandardTemplateKind, string]
> = [
  ['candidate', 'Candidate.md'],
  ['epic', 'Epic.md'],
  ['story', 'Story.md'],
  ['task', 'Task.md'],
  ['retrospective', 'Retrospective.md'],
];

export interface PendingRootMove {
  sourceRoot: string;
  targetRoot: string;
  templates: FocusFlowSettings['templates'];
}

export interface RootWorkspaceState {
  settings: FocusFlowSettings;
  pendingRootMove: PendingRootMove | null;
}

export interface RootWorkspaceStorage {
  kind(path: string): Promise<'missing' | 'file' | 'folder'>;
  validate(root: string): Promise<{ warnings: string[]; errors: string[] }>;
  createFolder(path: string): Promise<void>;
  createFile(path: string, body: string): Promise<void>;
  renameRoot(source: string, target: string): Promise<void>;
}

export interface RootSetupPreview {
  root: string;
  missingFolders: readonly string[];
  missingTemplates: readonly string[];
  warnings: readonly string[];
  errors: readonly string[];
}

export function parsePendingRootMove(input: unknown): PendingRootMove | null {
  if (!isRecord(input) || !isRecord(input.pendingRootMove)) return null;
  const plan = input.pendingRootMove;
  if (
    typeof plan.sourceRoot !== 'string' ||
    typeof plan.targetRoot !== 'string' ||
    !isRecord(plan.templates) ||
    typeof plan.templates.candidate !== 'string' ||
    typeof plan.templates.task !== 'string' ||
    typeof plan.templates.retrospective !== 'string'
  ) {
    return null;
  }
  return {
    sourceRoot: plan.sourceRoot,
    targetRoot: plan.targetRoot,
    templates: {
      candidate: plan.templates.candidate,
      task: plan.templates.task,
      retrospective: plan.templates.retrospective,
    },
  };
}

export class RootWorkspaceService {
  constructor(
    private readonly storage: RootWorkspaceStorage,
    private readonly getState: () => RootWorkspaceState,
    private readonly saveState: (state: RootWorkspaceState) => Promise<void>,
  ) {}

  async previewSetup(input: string, templates?: FocusFlowSettings['templates']): Promise<RootSetupPreview> {
    const root = normalizeRoot(input);
    const missingFolders: string[] = [];
    const missingTemplates: string[] = [];
    const errors: string[] = [];
    await inspectRootFolders(this.storage, root, missingFolders, errors);
    await inspectStandardTemplates(this.storage, root, missingTemplates, errors);
    if (templates) await inspectSelectedTemplates(this.storage, root, templates, errors);

    const validation = await this.storage.validate(root);
    return {
      root,
      missingFolders,
      missingTemplates,
      warnings: validation.warnings,
      errors: [...errors, ...validation.errors],
    };
  }

  async confirmSetup(input: string, templates?: FocusFlowSettings['templates']): Promise<void> {
    const preview = await this.previewSetup(input, templates);
    assertNoErrors(preview.errors);
    for (const path of preview.missingFolders) {
      await this.storage.createFolder(path);
    }
    for (const [kind, filename] of TEMPLATE_FILES) {
      const path = join(preview.root, `Templates/${filename}`);
      if (preview.missingTemplates.includes(path)) {
        await this.storage.createFile(path, STANDARD_BODY_TEMPLATES[kind]);
      }
    }
    const state = this.getState();
    await this.saveState({
      settings: { ...settingsForRoot(state.settings, preview.root), ...(templates ? { templates: { candidate: normalizeRoot(templates.candidate), task: normalizeRoot(templates.task), retrospective: normalizeRoot(templates.retrospective) } } : {}) },
      pendingRootMove: null,
    });
  }

  async selectExistingRoot(input: string): Promise<void> {
    const root = normalizeRoot(input);
    if ((await this.storage.kind(root)) !== 'folder') {
      throw new Error('The selected Focus Flow root must be an existing folder.');
    }
    const validation = await this.storage.validate(root);
    assertNoErrors(validation.errors);
    const state = this.getState();
    await this.saveState({
      settings: settingsForRoot(state.settings, root),
      pendingRootMove: null,
    });
  }

  async moveRoot(input: string): Promise<void> {
    const state = this.getState();
    if (state.pendingRootMove !== null) {
      throw new Error('A Focus Flow root move is already pending.');
    }
    const sourceRoot = normalizeRoot(state.settings.rootFolder);
    const targetRoot = normalizeRoot(input);
    assertMovePaths(sourceRoot, targetRoot);
    if ((await this.storage.kind(sourceRoot)) !== 'folder') {
      throw new Error('The current Focus Flow root was not found.');
    }
    if ((await this.storage.kind(targetRoot)) !== 'missing') {
      throw new Error('The new Focus Flow root must not already exist.');
    }
    const pendingRootMove: PendingRootMove = {
      sourceRoot,
      targetRoot,
      templates: state.settings.templates,
    };
    await this.saveState({ ...state, pendingRootMove });
    await this.storage.renameRoot(sourceRoot, targetRoot);
    await this.finishMove(pendingRootMove);
  }

  async resumeMove(): Promise<void> {
    const plan = this.getState().pendingRootMove;
    if (plan === null) throw new Error('No Focus Flow root move is pending.');
    const source = await this.storage.kind(plan.sourceRoot);
    const target = await this.storage.kind(plan.targetRoot);
    if (source === 'folder' && target === 'missing') {
      await this.storage.renameRoot(plan.sourceRoot, plan.targetRoot);
    } else if (source !== 'missing' || target !== 'folder') {
      throw new Error('The pending root move conflicts with current vault paths.');
    }
    await this.finishMove(plan);
  }

  private async finishMove(plan: PendingRootMove): Promise<void> {
    const current = this.getState().settings;
    const settings = {
      ...settingsForRoot(current, plan.targetRoot),
      templates: remapTemplates(
        plan.templates,
        plan.sourceRoot,
        plan.targetRoot,
      ),
    };
    await this.saveState({ settings, pendingRootMove: plan });
    await this.saveState({ settings, pendingRootMove: null });
  }
}

function settingsForRoot(
  settings: FocusFlowSettings,
  rootFolder: string,
): FocusFlowSettings {
  return {
    ...settings,
    rootFolder,
    setupCompleted: true,
    templates: remapTemplates(
      settings.templates,
      settings.rootFolder,
      rootFolder,
    ),
  };
}

export function remapTemplates(
  templates: FocusFlowSettings['templates'],
  sourceRoot: string,
  targetRoot: string,
): FocusFlowSettings['templates'] {
  const remap = (path: string) => {
    const prefix = `${sourceRoot}/`;
    return path.startsWith(prefix)
      ? `${targetRoot}/${path.slice(prefix.length)}`
      : path;
  };
  return {
    candidate: remap(templates.candidate),
    task: remap(templates.task),
    retrospective: remap(templates.retrospective),
  };
}

function normalizeRoot(input: string): string {
  const value = input.trim().replace(/\\/g, '/').replace(/\/{2,}/g, '/');
  if (
    value === '' ||
    value.startsWith('/') ||
    value.endsWith('/') ||
    value.split('/').some((part) => part === '' || part === '.' || part === '..')
  ) {
    throw new Error('Focus Flow root must be a vault-relative folder path.');
  }
  return value;
}

async function inspectRootFolders(storage: RootWorkspaceStorage, root: string, missing: string[], errors: string[]): Promise<void> {
  for (const suffix of ROOT_FOLDERS) {
    const path = join(root, suffix);
    const kind = await storage.kind(path);
    if (kind === 'missing') missing.push(path);
    if (kind === 'file') errors.push(`${path} must be a folder.`);
  }
}

async function inspectStandardTemplates(storage: RootWorkspaceStorage, root: string, missing: string[], errors: string[]): Promise<void> {
  for (const [, filename] of TEMPLATE_FILES) {
    const path = join(root, `Templates/${filename}`);
    const kind = await storage.kind(path);
    if (kind === 'missing') missing.push(path);
    if (kind === 'folder') errors.push(`${path} must be a Markdown file.`);
  }
}

async function inspectSelectedTemplates(storage: RootWorkspaceStorage, root: string, templates: FocusFlowSettings['templates'], errors: string[]): Promise<void> {
  for (const kind of ['candidate', 'task', 'retrospective'] as const) {
    const path = normalizeRoot(templates[kind]);
    const standard = join(root, `Templates/${kind[0]!.toUpperCase()}${kind.slice(1)}.md`);
    const valid = path.toLowerCase().endsWith('.md') && (path === standard || await storage.kind(path) === 'file');
    if (!valid) errors.push(`Choose an existing Markdown file for the ${kind} template: ${path}.`);
  }
}

function assertMovePaths(source: string, target: string): void {
  if (
    source === target ||
    target.startsWith(`${source}/`) ||
    source.startsWith(`${target}/`)
  ) {
    throw new Error('Focus Flow roots must be different and non-nested.');
  }
}

function assertNoErrors(errors: readonly string[]): void {
  if (errors.length > 0) throw new Error(errors.join(' '));
}

function join(root: string, suffix: string): string {
  return suffix === '' ? root : `${root}/${suffix}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
