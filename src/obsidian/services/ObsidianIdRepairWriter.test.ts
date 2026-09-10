import type { FileManager, Vault } from 'obsidian';
import { TFile } from 'obsidian';
import { describe, expect, it, vi } from 'vitest';
import type { ResolvedIdRepairPlan } from '../../application/repairs/repair-ids';
import { ObsidianIdRepairWriter } from './ObsidianIdRepairWriter';

const oldId = '019946c9-5f97-7196-8483-73469275ff90';
const newId = '01994770-0000-7000-8000-000000000001';
const epicPath = 'Focus Flow/Epics/FF-41 Make reviews repeatable.md';
const storyPath = 'Focus Flow/Stories/FF-42 Improve personal reviews.md';
const plan: ResolvedIdRepairPlan = {
  entries: [{ path: epicPath, expectedId: oldId, replacementId: newId }],
  references: [
    {
      path: storyPath,
      field: 'epic_id',
      expectedId: oldId,
      replacementForPath: epicPath,
      replacementId: newId,
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
  } as unknown as Pick<FileManager, 'processFrontMatter'>;
}

function vaultFor(paths: readonly string[]) {
  const files = new Map(
    paths.map((path) => [path, Object.assign(new TFile(), { path })]),
  );
  return {
    getAbstractFileByPath: vi.fn((path: string) => files.get(path) ?? null),
  } as unknown as Pick<Vault, 'getAbstractFileByPath'>;
}

describe('ObsidianIdRepairWriter', () => {
  it('changes duplicate UUIDs and their derived references without touching other fields', async () => {
    const frontmatters = new Map<string, Record<string, unknown>>([
      [
        epicPath,
        {
          aliases: ['Review epic'],
          focus_flow: { id: oldId, key: 'FF-41', extension: 'preserve me' },
        },
      ],
      [
        storyPath,
        {
          cssclasses: ['wide-page'],
          focus_flow: { id: 'child-id', epic_id: oldId },
        },
      ],
    ]);
    const fileManager = fileManagerFor(frontmatters);
    const writer = new ObsidianIdRepairWriter(
      vaultFor([epicPath, storyPath]),
      fileManager,
    );

    await writer.repairIds(plan);

    expect(frontmatters.get(epicPath)).toEqual({
      aliases: ['Review epic'],
      focus_flow: { id: newId, key: 'FF-41', extension: 'preserve me' },
    });
    expect(frontmatters.get(storyPath)).toEqual({
      cssclasses: ['wide-page'],
      focus_flow: { id: 'child-id', epic_id: newId },
    });
    expect(fileManager.processFrontMatter).toHaveBeenCalledTimes(2);
  });

  it('resumes when a prior attempt already changed the UUID and reference', async () => {
    const frontmatters = new Map<string, Record<string, unknown>>([
      [epicPath, { focus_flow: { id: newId } }],
      [storyPath, { focus_flow: { epic_id: newId } }],
    ]);
    const writer = new ObsidianIdRepairWriter(
      vaultFor([epicPath, storyPath]),
      fileManagerFor(frontmatters),
    );

    await expect(writer.repairIds(plan)).resolves.toBeUndefined();
  });

  it('rejects stale managed data', async () => {
    const frontmatters = new Map<string, Record<string, unknown>>([
      [epicPath, { focus_flow: { id: 'someone-else' } }],
    ]);
    const writer = new ObsidianIdRepairWriter(
      vaultFor([epicPath]),
      fileManagerFor(frontmatters),
    );

    await expect(
      writer.repairIds({ ...plan, references: [] }),
    ).rejects.toThrow('Focus Flow note changed before UUID repair.');
  });

  it('finds every note before applying the repair', async () => {
    const frontmatters = new Map<string, Record<string, unknown>>([
      [epicPath, { focus_flow: { id: oldId } }],
    ]);
    const fileManager = fileManagerFor(frontmatters);
    const writer = new ObsidianIdRepairWriter(
      vaultFor([epicPath]),
      fileManager,
    );

    await expect(writer.repairIds(plan)).rejects.toThrow(
      'Focus Flow note was not found.',
    );
    expect(fileManager.processFrontMatter).not.toHaveBeenCalled();
  });
});
