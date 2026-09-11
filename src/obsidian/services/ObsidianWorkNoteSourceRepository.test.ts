import { TFile, type MetadataCache, type Vault } from 'obsidian';
import { describe, expect, it, vi } from 'vitest';
import {
  isManagedIndexPath,
  ObsidianWorkNoteSourceRepository,
} from './ObsidianWorkNoteSourceRepository';

function file(path: string): { path: string } {
  return { path };
}

describe('ObsidianWorkNoteSourceRepository', () => {
  it('treats Mission and managed folders as index event paths', () => {
    expect(isManagedIndexPath('Focus Flow/MISSION.md', 'Focus Flow')).toBe(true);
    expect(
      isManagedIndexPath('Focus Flow/Stories/FF-2 Outcome.md', 'Focus Flow'),
    ).toBe(true);
    expect(
      isManagedIndexPath('Focus Flow/Sprints/SPR-2.md', 'Focus Flow'),
    ).toBe(true);
    expect(
      isManagedIndexPath(
        'Focus Flow/Sprints/Archive/2026/08/SPR-2.md',
        'Focus Flow',
      ),
    ).toBe(true);
    expect(
      isManagedIndexPath('Focus Flow/Cycles/Sprints/SPR-2.md', 'Focus Flow'),
    ).toBe(false);
    expect(isManagedIndexPath('Focus Flow/Templates/Story.md', 'Focus Flow')).toBe(
      false,
    );
  });

  it('reads the ordinary Mission note from the configured root', async () => {
    const mission = Object.assign(new TFile(), {
      path: 'Personal System/MISSION.md',
    });
    const vault = {
      getMarkdownFiles: vi.fn().mockReturnValue([]),
      getAbstractFileByPath: vi.fn().mockReturnValue(mission),
      read: vi.fn().mockResolvedValue('# Mission\n\nChoose deliberately.'),
    } as unknown as Pick<
      Vault,
      'getMarkdownFiles' | 'getAbstractFileByPath' | 'read'
    >;
    const repository = new ObsidianWorkNoteSourceRepository(
      vault,
      { getFileCache: vi.fn() },
      () => 'Personal System',
    );

    await expect(repository.readMission()).resolves.toEqual({
      path: mission.path,
      body: '# Mission\n\nChoose deliberately.',
    });
  });

  it('returns the configured Mission path when the note is absent', async () => {
    const vault = {
      getMarkdownFiles: vi.fn().mockReturnValue([]),
      getAbstractFileByPath: vi.fn().mockReturnValue(null),
      read: vi.fn(),
    } as unknown as Pick<
      Vault,
      'getMarkdownFiles' | 'getAbstractFileByPath' | 'read'
    >;
    const repository = new ObsidianWorkNoteSourceRepository(
      vault,
      { getFileCache: vi.fn() },
      () => 'Personal System',
    );

    await expect(repository.readMission()).resolves.toEqual({
      path: 'Personal System/MISSION.md',
      body: null,
    });
  });

  it('reads Sprint notes from the configured Sprints folder', async () => {
    const sprint = file('Personal System/Sprints/Archive/2026/08/SPR-014.md');
    const vault = {
      getMarkdownFiles: vi.fn().mockReturnValue([sprint]),
      getAbstractFileByPath: vi.fn().mockReturnValue(null),
      read: vi.fn().mockResolvedValue('Sprint body'),
    } as unknown as Pick<
      Vault,
      'getMarkdownFiles' | 'getAbstractFileByPath' | 'read'
    >;
    const metadataCache = {
      getFileCache: vi.fn().mockReturnValue({
        frontmatter: { focus_flow: { type: 'sprint' } },
      }),
    } as unknown as Pick<MetadataCache, 'getFileCache'>;
    const repository = new ObsidianWorkNoteSourceRepository(
      vault,
      metadataCache,
      () => 'Personal System',
    );

    await expect(repository.list()).resolves.toEqual([
      {
        path: sprint.path,
        frontmatter: { focus_flow: { type: 'sprint' } },
        body: 'Sprint body',
      },
    ]);
  });

  it('reads one managed note by path and treats an absent note as deleted', async () => {
    const candidate = Object.assign(new TFile(), {
      path: 'Focus Flow/Inbox/FF-41 Explore weekly focus.md',
    });
    const vault = {
      getMarkdownFiles: vi.fn().mockReturnValue([]),
      getAbstractFileByPath: vi
        .fn()
        .mockReturnValueOnce(candidate)
        .mockReturnValueOnce(null),
      read: vi.fn().mockResolvedValue('Candidate body'),
    } as unknown as Pick<
      Vault,
      'getMarkdownFiles' | 'getAbstractFileByPath' | 'read'
    >;
    const metadataCache = {
      getFileCache: vi.fn().mockReturnValue({
        frontmatter: { focus_flow: { key: 'FF-41' } },
      }),
    } as unknown as Pick<MetadataCache, 'getFileCache'>;
    const repository = new ObsidianWorkNoteSourceRepository(
      vault,
      metadataCache,
      () => 'Focus Flow',
    );

    await expect(repository.read(candidate.path)).resolves.toEqual({
      path: candidate.path,
      frontmatter: { focus_flow: { key: 'FF-41' } },
      body: 'Candidate body',
    });
    await expect(repository.read(candidate.path)).resolves.toBeNull();
  });

  it('reads only managed work-note folders beneath the configured root', async () => {
    const candidate = file('Focus Flow/Inbox/FF-41 Explore weekly focus.md');
    const template = file('Focus Flow/Templates/Candidate.md');
    const foreign = file('Projects/FF-99 Unrelated.md');
    const vault = {
      getMarkdownFiles: vi.fn().mockReturnValue([foreign, template, candidate]),
      getAbstractFileByPath: vi.fn().mockReturnValue(null),
      read: vi.fn().mockResolvedValue('Candidate body'),
    } as unknown as Pick<
      Vault,
      'getMarkdownFiles' | 'getAbstractFileByPath' | 'read'
    >;
    const metadataCache = {
      getFileCache: vi.fn().mockReturnValue({
        frontmatter: {
          focus_flow: { key: 'FF-41' },
        },
      }),
    } as unknown as Pick<MetadataCache, 'getFileCache'>;
    const repository = new ObsidianWorkNoteSourceRepository(
      vault,
      metadataCache,
      () => 'Focus Flow/',
    );

    await expect(repository.list()).resolves.toEqual([
      {
        path: candidate.path,
        frontmatter: { focus_flow: { key: 'FF-41' } },
        body: 'Candidate body',
      },
    ]);
    expect(vault.read).toHaveBeenCalledOnce();
    expect(vault.read).toHaveBeenCalledWith(candidate);
  });

  it('reads fresh frontmatter before the metadata cache catches up', async () => {
    const candidate = Object.assign(new TFile(), {
      path: 'Focus Flow/Inbox/FF-9000 External signal.md',
    });
    const body = `---
focus_flow:
  key: FF-9000
  type: candidate
---
# External signal
`;
    const vault = {
      getMarkdownFiles: vi.fn().mockReturnValue([]),
      getAbstractFileByPath: vi.fn().mockReturnValue(candidate),
      read: vi.fn().mockResolvedValue(body),
    } as unknown as Pick<
      Vault,
      'getMarkdownFiles' | 'getAbstractFileByPath' | 'read'
    >;
    const repository = new ObsidianWorkNoteSourceRepository(
      vault,
      { getFileCache: vi.fn() },
      () => 'Focus Flow',
      () => ({
        focus_flow: { key: 'FF-9000', type: 'candidate' },
      }),
    );

    await expect(repository.read(candidate.path)).resolves.toEqual({
      path: candidate.path,
      frontmatter: {
        focus_flow: { key: 'FF-9000', type: 'candidate' },
      },
      body,
    });
  });
});
