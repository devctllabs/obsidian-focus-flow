import { TFile, type Vault, type Workspace, type WorkspaceLeaf } from 'obsidian';
import { describe, expect, it, vi } from 'vitest';
import { ObsidianNoteOpener } from './ObsidianNoteOpener';

describe('ObsidianNoteOpener', () => {
  it('reuses one preview leaf for ordinary title opens', async () => {
    const openFile = vi.fn().mockResolvedValue(undefined);
    const leaf = {
      openFile,
      getViewState: vi.fn().mockReturnValue({ type: 'markdown' }),
      view: {},
    } as unknown as WorkspaceLeaf;
    const workspace = {
      getLeaf: vi.fn().mockReturnValue(leaf),
      getLeavesOfType: vi.fn().mockReturnValue([leaf]),
      setActiveLeaf: vi.fn(),
    } as unknown as Pick<Workspace, 'getLeaf' | 'getLeavesOfType' | 'setActiveLeaf'>;
    const firstFile = Object.assign(new TFile(), {
      path: 'Focus Flow/Stories/FF-42 Improve weekly focus.md',
    });
    const secondFile = Object.assign(new TFile(), {
      path: 'Focus Flow/Stories/FF-43 Review weekly focus.md',
    });
    const files = new Map([
      [firstFile.path, firstFile],
      [secondFile.path, secondFile],
    ]);
    const vault = {
      getAbstractFileByPath: vi.fn((path: string) => files.get(path) ?? null),
    } as unknown as Pick<Vault, 'getAbstractFileByPath'>;
    const opener = new ObsidianNoteOpener(workspace, vault);

    await opener.open(
      'Focus Flow/Stories/FF-42 Improve weekly focus.md',
      new MouseEvent('click'),
    );
    await opener.open(
      'Focus Flow/Stories/FF-43 Review weekly focus.md',
      new MouseEvent('click'),
    );

    expect(workspace.getLeaf).toHaveBeenCalledTimes(1);
    expect(openFile).toHaveBeenCalledTimes(2);
  });

  it('reveals an already-open note and uses new leaves for explicit opens', async () => {
    const openFile = vi.fn().mockResolvedValue(undefined);
    const openLeaf = {
      view: { file: { path: 'Focus Flow/Epics/FF-40 Direction.md' } },
      openFile: vi.fn(),
      getViewState: vi.fn().mockReturnValue({ type: 'markdown' }),
    } as unknown as WorkspaceLeaf;
    const newLeaf = {
      view: {},
      openFile,
      getViewState: vi.fn().mockReturnValue({ type: 'markdown' }),
    } as unknown as WorkspaceLeaf;
    const setActiveLeaf = vi.fn();
    const workspace = {
      getLeaf: vi.fn().mockReturnValue(newLeaf),
      getLeavesOfType: vi.fn().mockReturnValue([openLeaf]),
      setActiveLeaf,
    } as unknown as Pick<Workspace, 'getLeaf' | 'getLeavesOfType' | 'setActiveLeaf'>;
    const file = Object.assign(new TFile(), {
      path: 'Focus Flow/Epics/FF-40 Direction.md',
    });
    const vault = {
      getAbstractFileByPath: vi.fn().mockReturnValue(file),
    } as unknown as Pick<Vault, 'getAbstractFileByPath'>;
    const opener = new ObsidianNoteOpener(workspace, vault);

    await opener.open('Focus Flow/Epics/FF-40 Direction.md', new MouseEvent('click'));
    expect(setActiveLeaf).toHaveBeenCalledWith(openLeaf, { focus: true });

    workspace.getLeavesOfType = vi.fn().mockReturnValue([]);
    await opener.open('Focus Flow/Epics/FF-40 Direction.md', new MouseEvent('click', { metaKey: true }));
    await opener.open('Focus Flow/Epics/FF-40 Direction.md', new MouseEvent('auxclick', { button: 1 }));
    expect(workspace.getLeaf).toHaveBeenCalledTimes(2);
    expect(openFile).toHaveBeenCalledTimes(2);
  });
});
