import {
  TFile,
  TFolder,
  type FileManager,
  type MetadataCache,
  type Vault,
} from 'obsidian';
import { describe, expect, it, vi } from 'vitest';
import { ObsidianRootWorkspaceStorage } from './ObsidianRootWorkspaceStorage';

describe('ObsidianRootWorkspaceStorage', () => {
  it('renames the whole root through FileManager after creating missing parents', async () => {
    const root = Object.assign(new TFolder(), { path: 'Focus Flow' });
    const entries = new Map<string, unknown>([['Focus Flow', root]]);
    const vault = {
      getAbstractFileByPath: vi.fn((path: string) => entries.get(path) ?? null),
      getMarkdownFiles: vi.fn().mockReturnValue([]),
      read: vi.fn(),
      create: vi.fn(),
      createFolder: vi.fn(async (path: string) => {
        entries.set(path, Object.assign(new TFolder(), { path }));
      }),
    } as unknown as Pick<
      Vault,
      'getAbstractFileByPath' | 'getMarkdownFiles' | 'read' | 'create' | 'createFolder'
    >;
    const fileManager = {
      renameFile: vi.fn().mockResolvedValue(undefined),
    } as unknown as Pick<FileManager, 'renameFile'>;
    const storage = new ObsidianRootWorkspaceStorage(
      vault,
      fileManager,
      { getFileCache: vi.fn() } as unknown as MetadataCache,
    );

    await storage.renameRoot('Focus Flow', 'Areas/Systems/Focus');

    expect(vault.createFolder).toHaveBeenNthCalledWith(1, 'Areas');
    expect(vault.createFolder).toHaveBeenNthCalledWith(2, 'Areas/Systems');
    expect(fileManager.renameFile).toHaveBeenCalledWith(
      root,
      'Areas/Systems/Focus',
    );
  });

  it('validates an existing empty root without writing and reports Mission as a warning', async () => {
    const root = Object.assign(new TFolder(), { path: 'Focus Flow' });
    const vault = {
      getAbstractFileByPath: vi.fn((path: string) =>
        path === 'Focus Flow' ? root : null,
      ),
      getMarkdownFiles: vi.fn().mockReturnValue([]),
      read: vi.fn(),
      create: vi.fn(),
      createFolder: vi.fn(),
    } as unknown as Pick<
      Vault,
      'getAbstractFileByPath' | 'getMarkdownFiles' | 'read' | 'create' | 'createFolder'
    >;
    const fileManager = {
      renameFile: vi.fn(),
    } as unknown as Pick<FileManager, 'renameFile'>;
    const storage = new ObsidianRootWorkspaceStorage(
      vault,
      fileManager,
      { getFileCache: vi.fn() } as unknown as MetadataCache,
    );

    await expect(storage.validate('Focus Flow')).resolves.toEqual({
      warnings: [
        'Mission is missing or empty. Capture and triage remain available.',
      ],
      errors: [],
    });
    expect(vault.create).not.toHaveBeenCalled();
    expect(vault.createFolder).not.toHaveBeenCalled();
    expect(fileManager.renameFile).not.toHaveBeenCalled();
  });

  it('classifies projected warning diagnostics as warnings', async () => {
    const root = Object.assign(new TFolder(), { path: 'Focus Flow' });
    const mission = Object.assign(new TFile(), { path: 'Focus Flow/MISSION.md' });
    const task = Object.assign(new TFile(), {
      path: 'Focus Flow/Tasks/FF-8 Task.md',
    });
    const entries = new Map<string, TFile | TFolder>([
      [root.path, root],
      [mission.path, mission],
      [task.path, task],
    ]);
    const vault = {
      getAbstractFileByPath: vi.fn((path: string) => entries.get(path) ?? null),
      getMarkdownFiles: vi.fn().mockReturnValue([task]),
      read: vi.fn(async (file: TFile) =>
        file === mission ? '# Mission' : '# Task'),
      create: vi.fn(),
      createFolder: vi.fn(),
    } as unknown as Pick<
      Vault,
      'getAbstractFileByPath' | 'getMarkdownFiles' | 'read' | 'create' | 'createFolder'
    >;
    const metadataCache = {
      getFileCache: vi.fn(() => ({
        frontmatter: {
          focus_flow: {
            schema_version: 1,
            id: '01990000-0000-7000-8000-000000000004',
            key: 'FF-8',
            type: 'task',
            lifecycle: 'active',
            story_id: '01990000-0000-7000-8000-000000000002',
            story_link: '[[Focus Flow/Stories/FF-7 Story]]',
            task_rank: 'a0',
            status: 'in_progress',
            created_at: '2026-09-01T10:00:00+04:00',
          },
        },
      })),
    } as unknown as MetadataCache;
    const storage = new ObsidianRootWorkspaceStorage(
      vault,
      { renameFile: vi.fn() },
      metadataCache,
    );

    const result = await storage.validate('Focus Flow');

    expect(result.warnings).toContain('In Progress Task is missing started_at.');
    expect(result.errors).not.toContain('In Progress Task is missing started_at.');
  });
});
