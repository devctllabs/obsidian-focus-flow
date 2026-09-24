import { describe, expect, it, vi } from 'vitest';
import { STANDARD_BODY_TEMPLATES } from '../work/standard-templates';
import { DEFAULT_SETTINGS } from '../../settings';
import {
  RootWorkspaceService,
  type RootWorkspaceState,
  type RootWorkspaceStorage,
} from './root-workspace';

function setup(initialPaths: Record<string, 'file' | 'folder'> = {}) {
  const paths = new Map(Object.entries(initialPaths));
  let state: RootWorkspaceState = {
    settings: DEFAULT_SETTINGS,
    pendingRootMove: null,
  };
  let validation = { warnings: [] as string[], errors: [] as string[] };
  const storage = {
    kind: vi.fn(async (path: string) => paths.get(path) ?? 'missing' as const),
    validate: vi.fn(async () => validation),
    createFolder: vi.fn(async (path: string) => {
      paths.set(path, 'folder');
    }),
    createFile: vi.fn(async (path: string, _body: string) => {
      paths.set(path, 'file');
    }),
    renameRoot: vi.fn(async (source: string, target: string) => {
      if (paths.get(source) !== 'folder' || paths.has(target)) {
        throw new Error('rename failed');
      }
      paths.delete(source);
      paths.set(target, 'folder');
    }),
  } satisfies RootWorkspaceStorage;
  const saveState = vi.fn(async (replacement: RootWorkspaceState) => {
    state = replacement;
  });
  return {
    service: new RootWorkspaceService(storage, () => state, saveState),
    storage,
    saveState,
    paths,
    state: () => state,
    setValidation: (replacement: typeof validation) => {
      validation = replacement;
    },
  };
}

describe('RootWorkspaceService', () => {
  it('adopts existing custom templates and saves the explicitly selected paths', async () => {
    const context = setup({ Existing: 'folder', 'Shared/Capture.md': 'file' });
    const templates = { candidate: 'Shared/Capture.md', task: 'Existing/Templates/Task.md', retrospective: 'Existing/Templates/Retrospective.md' };
    await context.service.confirmSetup('open', 'Existing', templates);
    expect(context.state().settings.templates).toEqual(templates);
    expect(context.storage.createFile).not.toHaveBeenCalledWith('Shared/Capture.md', expect.anything());
  });

  it('rejects missing custom template paths before creating workspace files', async () => {
    const context = setup();
    await expect(context.service.confirmSetup('create', 'New', { ...DEFAULT_SETTINGS.templates, candidate: 'Missing/Custom.md' })).rejects.toThrow(/template.*Missing\/Custom.md/i);
    expect(context.storage.createFolder).not.toHaveBeenCalled();
    expect(context.saveState).not.toHaveBeenCalled();
  });
  it('previews and creates only missing typed folders and templates', async () => {
    const context = setup({
      'Focus Flow': 'folder',
      'Focus Flow/Inbox': 'folder',
      'Focus Flow/Templates/Candidate.md': 'file',
    });

    const preview = await context.service.previewSetup('open', 'Focus Flow');
    expect(preview.errors).toEqual([]);
    expect(preview.missingFolders).toContain('Focus Flow/Sprints');
    expect(preview.missingTemplates).toEqual([
      'Focus Flow/Templates/Epic.md',
      'Focus Flow/Templates/Story.md',
      'Focus Flow/Templates/Task.md',
      'Focus Flow/Templates/Retrospective.md',
    ]);

    await context.service.confirmSetup('open', 'Focus Flow');

    expect(context.storage.createFolder).toHaveBeenCalledWith(
      'Focus Flow/Sprints',
    );
    expect(context.storage.createFile).not.toHaveBeenCalledWith(
      'Focus Flow/Templates/Candidate.md',
      expect.anything(),
    );
    expect(context.storage.createFile).toHaveBeenCalledWith(
      'Focus Flow/Templates/Task.md',
      STANDARD_BODY_TEMPLATES.task,
    );
    expect(context.state().settings.setupCompleted).toBe(true);
  });

  it('creates only at a missing path and keeps the previous workspace intact', async () => {
    const context = setup({ FocusFlow: 'folder', Existing: 'folder' });

    await expect(
      context.service.previewSetup('create', 'Existing'),
    ).resolves.toMatchObject({
      errors: ['A folder already exists here. Open it as an existing workspace instead.'],
    });

    await context.service.confirmSetup('create', 'New Flow');

    expect(context.paths.get('FocusFlow')).toBe('folder');
    expect(context.paths.get('New Flow')).toBe('folder');
    expect(context.state().settings.rootFolder).toBe('New Flow');
  });

  it('opens only an existing folder, allows warnings, and blocks hard validation errors', async () => {
    const context = setup({ Existing: 'folder', Broken: 'folder' });
    context.setValidation({ warnings: ['Missing Mission'], errors: [] });
    await expect(context.service.confirmSetup('open', 'Existing')).resolves.toBeUndefined();
    expect(context.state().settings.rootFolder).toBe('Existing');

    context.setValidation({ warnings: [], errors: ['Duplicate ID'] });
    await expect(context.service.confirmSetup('open', 'Broken')).rejects.toThrow(
      'Duplicate ID',
    );

    await expect(context.service.previewSetup('open', 'Missing')).resolves.toMatchObject({
      errors: ['Choose an existing folder to open.'],
    });
  });

  it('renames the whole root, remaps in-root templates, and clears recovery state', async () => {
    const context = setup({ FocusFlow: 'folder' });

    await context.service.moveRoot('Areas/Focus');

    expect(context.storage.renameRoot).toHaveBeenCalledWith(
      'FocusFlow',
      'Areas/Focus',
    );
    expect(context.state()).toMatchObject({
      settings: {
        rootFolder: 'Areas/Focus',
        templates: {
          candidate: 'Areas/Focus/Templates/Candidate.md',
          task: 'Areas/Focus/Templates/Task.md',
          retrospective: 'Areas/Focus/Templates/Retrospective.md',
        },
      },
      pendingRootMove: null,
    });
    expect(context.saveState).toHaveBeenCalledTimes(3);
  });

  it('resumes after rename when settings persistence was interrupted', async () => {
    const context = setup({ FocusFlow: 'folder' });
    let writes = 0;
    context.saveState.mockImplementation(async (replacement) => {
      writes += 1;
      if (writes === 2) throw new Error('save interrupted');
      Object.assign(context.state(), replacement);
    });

    await expect(context.service.moveRoot('Areas/Focus')).rejects.toThrow(
      'save interrupted',
    );
    expect(context.paths.get('Areas/Focus')).toBe('folder');
    expect(context.state().pendingRootMove).not.toBeNull();

    await context.service.resumeMove();
    expect(context.state().settings.rootFolder).toBe('Areas/Focus');
    expect(context.state().pendingRootMove).toBeNull();
    expect(context.storage.renameRoot).toHaveBeenCalledOnce();
  });

  it.each<{
    label: string;
    paths: Record<string, 'file' | 'folder'>;
    renamed: number;
  }>([
    {
      label: 'source only',
      paths: { FocusFlow: 'folder' as const },
      renamed: 1,
    },
    {
      label: 'target only',
      paths: { 'Areas/Focus': 'folder' as const },
      renamed: 0,
    },
  ])('resumes a recoverable $label move state', async ({ paths, renamed }) => {
    const context = setup(paths);
    const pendingRootMove = {
      sourceRoot: 'FocusFlow',
      targetRoot: 'Areas/Focus',
      templates: DEFAULT_SETTINGS.templates,
    };
    Object.assign(context.state(), { pendingRootMove });

    await context.service.resumeMove();

    expect(context.storage.renameRoot).toHaveBeenCalledTimes(renamed);
    expect(context.state().settings.rootFolder).toBe('Areas/Focus');
    expect(context.state().pendingRootMove).toBeNull();
  });

  it.each<{
    label: string;
    paths: Record<string, 'file' | 'folder'>;
  }>([
    {
      label: 'both roots',
      paths: {
        FocusFlow: 'folder' as const,
        'Areas/Focus': 'folder' as const,
      },
    },
    { label: 'neither root', paths: {} },
  ])('refuses the conflicting $label recovery state', async ({ paths }) => {
    const context = setup(paths);
    Object.assign(context.state(), {
      pendingRootMove: {
        sourceRoot: 'FocusFlow',
        targetRoot: 'Areas/Focus',
        templates: DEFAULT_SETTINGS.templates,
      },
    });

    await expect(context.service.resumeMove()).rejects.toThrow(
      'conflicts with current vault paths',
    );
    expect(context.saveState).not.toHaveBeenCalled();
  });

  it('finishes marker cleanup when the target setting was already saved', async () => {
    const context = setup({ 'Areas/Focus': 'folder' });
    const pendingRootMove = {
      sourceRoot: 'FocusFlow',
      targetRoot: 'Areas/Focus',
      templates: DEFAULT_SETTINGS.templates,
    };
    Object.assign(context.state(), {
      settings: {
        ...DEFAULT_SETTINGS,
        rootFolder: 'Areas/Focus',
        setupCompleted: true,
      },
      pendingRootMove,
    });

    await context.service.resumeMove();

    expect(context.storage.renameRoot).not.toHaveBeenCalled();
    expect(context.state().pendingRootMove).toBeNull();
  });
});
