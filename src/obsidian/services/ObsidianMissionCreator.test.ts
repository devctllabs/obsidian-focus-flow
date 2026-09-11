import { TFile, type Vault } from 'obsidian';
import { describe, expect, it, vi } from 'vitest';
import { ObsidianMissionCreator } from './ObsidianMissionCreator';

describe('ObsidianMissionCreator', () => {
  it('creates the ordinary Mission note once and opens it', async () => {
    const mission = Object.assign(new TFile(), { path: 'Focus Flow/MISSION.md' });
    const vault = {
      getAbstractFileByPath: vi.fn().mockReturnValueOnce(null).mockReturnValue(mission),
      create: vi.fn().mockResolvedValue(mission),
    } as unknown as Pick<Vault, 'getAbstractFileByPath' | 'create'>;
    const opener = { open: vi.fn().mockResolvedValue(undefined) };
    const creator = new ObsidianMissionCreator(vault, opener, () => 'Focus Flow');

    await creator.createAndOpen();
    await creator.createAndOpen();

    expect(vault.create).toHaveBeenCalledOnce();
    expect(vault.create).toHaveBeenCalledWith('Focus Flow/MISSION.md', '# Mission\n\n');
    expect(opener.open).toHaveBeenCalledTimes(2);
  });
});
