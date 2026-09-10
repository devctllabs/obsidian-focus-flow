import { TFile } from 'obsidian';
import { expect, it, vi } from 'vitest';
import { candidate, task } from '../../test/storybook/fixtures';
import { ObsidianWorkTrash } from './ObsidianWorkTrash';

it('uses Obsidian trash and refuses changed content or a different workspace', async () => {
  const file = Object.assign(new TFile(), { path: task.path });
  const vault = { getAbstractFileByPath: vi.fn(() => file), read: vi.fn(async () => 'Original') };
  const fileManager = { trashFile: vi.fn(async () => undefined) };
  let root = 'Focus Flow';
  const storage = new ObsidianWorkTrash(vault, fileManager, () => root);
  await storage.trash(task, 'Original');
  expect(fileManager.trashFile).toHaveBeenCalledWith(file);
  fileManager.trashFile.mockClear();
  vault.read.mockResolvedValue('New text');
  await expect(storage.trash(task, 'Original')).rejects.toThrow(/changed/);
  root = 'Elsewhere';
  await expect(storage.trash(task, 'New text')).rejects.toThrow(/outside/);
  expect(fileManager.trashFile).not.toHaveBeenCalled();
});
it('trashes Candidates only from their current typed folder', async () => {
  const file = Object.assign(new TFile(), { path: candidate.path });
  const vault = { getAbstractFileByPath: vi.fn(() => file), read: vi.fn(async () => 'Idea') };
  const fileManager = { trashFile: vi.fn(async () => undefined) };
  const storage = new ObsidianWorkTrash(vault, fileManager, () => 'Focus Flow');
  await storage.trash(candidate, 'Idea');
  expect(fileManager.trashFile).toHaveBeenCalledWith(file);
  await expect(storage.trash({ ...candidate, path: 'Focus Flow/Epics/Wrong.md' }, 'Idea')).rejects.toThrow(/outside/);
});
