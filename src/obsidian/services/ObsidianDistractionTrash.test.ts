import { TFile } from 'obsidian';
import { describe, expect, it, vi } from 'vitest';
import { distraction } from '../../test/storybook/fixtures';
import { trashObsidianDistraction } from './ObsidianDistractionTrash';

describe('Obsidian Distraction trash', () => {
  it('uses recoverable host trash after checking the current note identity and lifecycle', async () => {
    const file = Object.assign(new TFile(), { path: distraction.path });
    const vault = { getAbstractFileByPath: vi.fn(() => file) };
    const managed = { id: distraction.id, key: distraction.key, type: 'candidate', lifecycle: 'rejected' };
    const fileManager = { processFrontMatter: vi.fn(async (_file: TFile, update: (frontmatter: Record<string, unknown>) => void) => update({ focus_flow: managed })), trashFile: vi.fn().mockResolvedValue(undefined) };
    await trashObsidianDistraction(vault, fileManager, 'Focus Flow', distraction);
    expect(fileManager.trashFile).toHaveBeenCalledWith(file);
    expect(managed.lifecycle).toBe('rejected');
    fileManager.trashFile.mockClear();
    managed.lifecycle = 'inbox';
    await expect(trashObsidianDistraction(vault, fileManager, 'Focus Flow', distraction)).rejects.toThrow();
    await expect(trashObsidianDistraction(vault, fileManager, 'Another workspace', distraction)).rejects.toThrow();
    expect(fileManager.trashFile).not.toHaveBeenCalled();
  });
});
