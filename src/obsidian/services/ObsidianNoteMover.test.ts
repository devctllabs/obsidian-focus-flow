import type { FileManager, Vault } from 'obsidian';
import { TFile } from 'obsidian';
import { describe, expect, it, vi } from 'vitest';
import type { MoveNoteRepairPlan } from '../../domain/work-note';
import { ObsidianNoteMover } from './ObsidianNoteMover';

const plan: MoveNoteRepairPlan = {
  kind: 'move-note',
  path: 'Personal System/Tasks/FF-41 Explore weekly focus.md',
  id: '019946e9-0ef0-7ca3-af0c-ec423d76efed',
  targetFolder: 'Inbox',
};
const destinationPath =
  'Personal System/Inbox/FF-41 Explore weekly focus.md';

function fileManagerFor(frontmatter: Record<string, unknown>) {
  return {
    processFrontMatter: vi.fn(
      async (
        _file: TFile,
        update: (value: Record<string, unknown>) => void,
      ) => update(frontmatter),
    ),
    renameFile: vi.fn().mockResolvedValue(undefined),
  } as unknown as Pick<FileManager, 'processFrontMatter' | 'renameFile'>;
}

describe('ObsidianNoteMover', () => {
  it('revalidates identity and moves the note into the configured typed folder', async () => {
    const note = Object.assign(new TFile(), { path: plan.path });
    const vault = {
      getAbstractFileByPath: vi.fn((path: string) =>
        path === plan.path ? note : null,
      ),
    } as unknown as Pick<Vault, 'getAbstractFileByPath'>;
    const fileManager = fileManagerFor({
      cssclasses: ['wide-page'],
      focus_flow: { id: plan.id, custom_managed_extension: 'preserve me' },
    });
    const mover = new ObsidianNoteMover(
      vault,
      fileManager,
      () => 'Personal System',
    );

    await mover.moveNote(plan);

    expect(fileManager.processFrontMatter).toHaveBeenCalledWith(
      note,
      expect.any(Function),
    );
    expect(fileManager.renameFile).toHaveBeenCalledWith(note, destinationPath);
  });

  it('rejects a stale identity without moving the note', async () => {
    const note = Object.assign(new TFile(), { path: plan.path });
    const vault = {
      getAbstractFileByPath: vi.fn((path: string) =>
        path === plan.path ? note : null,
      ),
    } as unknown as Pick<Vault, 'getAbstractFileByPath'>;
    const fileManager = fileManagerFor({ focus_flow: { id: 'changed' } });
    const mover = new ObsidianNoteMover(
      vault,
      fileManager,
      () => 'Personal System',
    );

    await expect(mover.moveNote(plan)).rejects.toThrow(
      'Focus Flow note changed before move repair.',
    );
    expect(fileManager.renameFile).not.toHaveBeenCalled();
  });

  it('rejects a destination collision before touching the note', async () => {
    const note = Object.assign(new TFile(), { path: plan.path });
    const existing = Object.assign(new TFile(), { path: destinationPath });
    const vault = {
      getAbstractFileByPath: vi.fn((path: string) =>
        path === plan.path ? note : existing,
      ),
    } as unknown as Pick<Vault, 'getAbstractFileByPath'>;
    const fileManager = fileManagerFor({ focus_flow: { id: plan.id } });
    const mover = new ObsidianNoteMover(
      vault,
      fileManager,
      () => 'Personal System',
    );

    await expect(mover.moveNote(plan)).rejects.toThrow(
      'Focus Flow destination already exists.',
    );
    expect(fileManager.processFrontMatter).not.toHaveBeenCalled();
    expect(fileManager.renameFile).not.toHaveBeenCalled();
  });

  it('treats an already-moved note with the planned identity as complete', async () => {
    const movedNote = Object.assign(new TFile(), { path: destinationPath });
    const vault = {
      getAbstractFileByPath: vi.fn((path: string) =>
        path === destinationPath ? movedNote : null,
      ),
    } as unknown as Pick<Vault, 'getAbstractFileByPath'>;
    const fileManager = fileManagerFor({ focus_flow: { id: plan.id } });
    const mover = new ObsidianNoteMover(
      vault,
      fileManager,
      () => 'Personal System',
    );

    await mover.moveNote(plan);

    expect(fileManager.processFrontMatter).toHaveBeenCalledWith(
      movedNote,
      expect.any(Function),
    );
    expect(fileManager.renameFile).not.toHaveBeenCalled();
  });
});
