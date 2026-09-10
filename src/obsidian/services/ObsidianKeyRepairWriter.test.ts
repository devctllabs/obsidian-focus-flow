import type { FileManager, Vault } from 'obsidian';
import { TFile } from 'obsidian';
import { describe, expect, it, vi } from 'vitest';
import type { KeyRepairPlan } from '../../domain/work-note';
import { ObsidianKeyRepairWriter } from './ObsidianKeyRepairWriter';

const oldEpicPath = 'Focus Flow/Epics/FF-40 Make reviews repeatable.md';
const newEpicPath = 'Focus Flow/Epics/FF-43 Make reviews repeatable.md';
const storyPath = 'Focus Flow/Stories/FF-42 Improve personal reviews.md';
const epicId = '01994710-0000-7000-8000-000000000001';

const plan: KeyRepairPlan = {
  kind: 'repair-duplicate-keys',
  entries: [
    {
      path: oldEpicPath,
      id: epicId,
      expectedKey: 'FF-40',
      replacementKey: 'FF-43',
      replacementPath: newEpicPath,
    },
  ],
  links: [
    {
      path: storyPath,
      parentId: epicId,
      field: 'epic_link',
      expectedValue: '[[Focus Flow/Epics/FF-40 Make reviews repeatable]]',
      replacementValue: '[[Focus Flow/Epics/FF-43 Make reviews repeatable]]',
    },
  ],
};

function fileManagerFor(frontmatters: Map<string, Record<string, unknown>>) {
  return {
    processFrontMatter: vi.fn(
      async (
        file: TFile,
        update: (value: Record<string, unknown>) => void,
      ) => update(frontmatters.get(file.path)!),
    ),
    renameFile: vi.fn().mockResolvedValue(undefined),
  } as unknown as Pick<FileManager, 'processFrontMatter' | 'renameFile'>;
}

describe('ObsidianKeyRepairWriter', () => {
  it('changes the key, renames the note, and updates derived links', async () => {
    const epic = Object.assign(new TFile(), { path: oldEpicPath });
    const story = Object.assign(new TFile(), { path: storyPath });
    const files = new Map<string, TFile>([
      [oldEpicPath, epic],
      [storyPath, story],
    ]);
    const frontmatters = new Map<string, Record<string, unknown>>([
      [
        oldEpicPath,
        {
          cssclasses: ['wide-page'],
          focus_flow: {
            id: epicId,
            key: 'FF-40',
            custom_managed_extension: 'preserve me',
          },
        },
      ],
      [
        storyPath,
        {
          focus_flow: {
            epic_id: epicId,
            epic_link: plan.links[0]!.expectedValue,
          },
        },
      ],
    ]);
    const vault = {
      getAbstractFileByPath: vi.fn((path: string) => files.get(path) ?? null),
    } as unknown as Pick<Vault, 'getAbstractFileByPath'>;
    const fileManager = fileManagerFor(frontmatters);
    const writer = new ObsidianKeyRepairWriter(vault, fileManager);

    await writer.repairKeys(plan);

    expect(frontmatters.get(oldEpicPath)).toMatchObject({
      cssclasses: ['wide-page'],
      focus_flow: {
        key: 'FF-43',
        custom_managed_extension: 'preserve me',
      },
    });
    expect(frontmatters.get(storyPath)).toMatchObject({
      focus_flow: { epic_link: plan.links[0]!.replacementValue },
    });
    expect(fileManager.processFrontMatter).toHaveBeenNthCalledWith(
      1,
      story,
      expect.any(Function),
    );
    expect(fileManager.renameFile).toHaveBeenCalledWith(epic, newEpicPath);
  });

  it('rejects a destination collision before touching any note', async () => {
    const epic = Object.assign(new TFile(), { path: oldEpicPath });
    const existing = Object.assign(new TFile(), { path: newEpicPath });
    const vault = {
      getAbstractFileByPath: vi.fn((path: string) =>
        path === oldEpicPath ? epic : existing,
      ),
    } as unknown as Pick<Vault, 'getAbstractFileByPath'>;
    const fileManager = fileManagerFor(new Map());
    const writer = new ObsidianKeyRepairWriter(vault, fileManager);

    await expect(writer.repairKeys(plan)).rejects.toThrow(
      'Focus Flow key repair destination already exists.',
    );
    expect(fileManager.processFrontMatter).not.toHaveBeenCalled();
    expect(fileManager.renameFile).not.toHaveBeenCalled();
  });

  it('resumes after the note was renamed and its link was already updated', async () => {
    const epic = Object.assign(new TFile(), { path: newEpicPath });
    const story = Object.assign(new TFile(), { path: storyPath });
    const files = new Map<string, TFile>([
      [newEpicPath, epic],
      [storyPath, story],
    ]);
    const frontmatters = new Map<string, Record<string, unknown>>([
      [newEpicPath, { focus_flow: { id: epicId, key: 'FF-43' } }],
      [
        storyPath,
        {
          focus_flow: {
            epic_id: epicId,
            epic_link: '[[FF-43 Make reviews repeatable]]',
          },
        },
      ],
    ]);
    const vault = {
      getAbstractFileByPath: vi.fn((path: string) => files.get(path) ?? null),
    } as unknown as Pick<Vault, 'getAbstractFileByPath'>;
    const fileManager = fileManagerFor(frontmatters);
    const writer = new ObsidianKeyRepairWriter(vault, fileManager);

    await writer.repairKeys(plan);

    expect(fileManager.renameFile).not.toHaveBeenCalled();
    expect(fileManager.processFrontMatter).toHaveBeenCalledTimes(2);
  });

  it('rejects a stale managed key without renaming the note', async () => {
    const epic = Object.assign(new TFile(), { path: oldEpicPath });
    const vault = {
      getAbstractFileByPath: vi.fn((path: string) =>
        path === oldEpicPath ? epic : null,
      ),
    } as unknown as Pick<Vault, 'getAbstractFileByPath'>;
    const fileManager = fileManagerFor(
      new Map([
        [oldEpicPath, { focus_flow: { id: epicId, key: 'FF-99' } }],
      ]),
    );
    const writer = new ObsidianKeyRepairWriter(vault, fileManager);

    await expect(writer.repairKeys({ ...plan, links: [] })).rejects.toThrow(
      'Focus Flow note changed before key repair.',
    );
    expect(fileManager.renameFile).not.toHaveBeenCalled();
  });
});
