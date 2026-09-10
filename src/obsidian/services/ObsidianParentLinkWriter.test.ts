import type { FileManager, Vault } from 'obsidian';
import { TFile } from 'obsidian';
import { describe, expect, it, vi } from 'vitest';
import type { ParentLinkRepairPlan } from '../../domain/work-note';
import { ObsidianParentLinkWriter } from './ObsidianParentLinkWriter';

const plan: ParentLinkRepairPlan = {
  kind: 'replace-parent-link',
  path: 'Focus Flow/Stories/FF-42 Improve weekly focus.md',
  parentId: '019946c9-5f97-7196-8483-73469275ff90',
  field: 'epic_link',
  expectedValue: '[[FF-99 Wrong Epic]]',
  replacementValue: '[[Focus Flow/Epics/FF-40 Build a calmer system]]',
};

describe('ObsidianParentLinkWriter', () => {
  it('revalidates and replaces only the planned managed field', async () => {
    const note = Object.assign(new TFile(), { path: plan.path });
    const frontmatter = {
      cssclasses: ['wide-page'],
      focus_flow: {
        schema_version: 1,
        id: '019946f1-8d2a-7f05-87b1-1eebbb476300',
        epic_id: plan.parentId,
        epic_link: plan.expectedValue,
        custom_managed_extension: 'preserve me',
      },
    };
    const vault = {
      getAbstractFileByPath: vi.fn().mockReturnValue(note),
    } as unknown as Pick<Vault, 'getAbstractFileByPath'>;
    const fileManager = {
      processFrontMatter: vi
        .fn()
        .mockImplementation(
          async (
            _file: TFile,
            update: (value: Record<string, unknown>) => void,
          ) => update(frontmatter),
        ),
    } as unknown as Pick<FileManager, 'processFrontMatter'>;
    const writer = new ObsidianParentLinkWriter(vault, fileManager);

    await writer.replaceParentLink(plan);

    expect(vault.getAbstractFileByPath).toHaveBeenCalledWith(plan.path);
    expect(fileManager.processFrontMatter).toHaveBeenCalledWith(
      note,
      expect.any(Function),
    );
    expect(frontmatter).toEqual({
      cssclasses: ['wide-page'],
      focus_flow: {
        schema_version: 1,
        id: '019946f1-8d2a-7f05-87b1-1eebbb476300',
        epic_id: plan.parentId,
        epic_link: plan.replacementValue,
        custom_managed_extension: 'preserve me',
      },
    });
  });

  it('rejects a stale plan without changing frontmatter', async () => {
    const note = Object.assign(new TFile(), { path: plan.path });
    const frontmatter = {
      focus_flow: {
        epic_id: plan.parentId,
        epic_link: '[[Already changed by the user]]',
      },
    };
    const vault = {
      getAbstractFileByPath: vi.fn().mockReturnValue(note),
    } as unknown as Pick<Vault, 'getAbstractFileByPath'>;
    const fileManager = {
      processFrontMatter: vi
        .fn()
        .mockImplementation(
          async (
            _file: TFile,
            update: (value: Record<string, unknown>) => void,
          ) => update(frontmatter),
        ),
    } as unknown as Pick<FileManager, 'processFrontMatter'>;
    const writer = new ObsidianParentLinkWriter(vault, fileManager);

    await expect(writer.replaceParentLink(plan)).rejects.toThrow(
      'Focus Flow note changed before repair.',
    );
    expect(frontmatter.focus_flow.epic_link).toBe(
      '[[Already changed by the user]]',
    );
  });

  it('rejects the repair when the planned path is no longer a file', async () => {
    const vault = {
      getAbstractFileByPath: vi.fn().mockReturnValue(null),
    } as unknown as Pick<Vault, 'getAbstractFileByPath'>;
    const fileManager = {
      processFrontMatter: vi.fn(),
    } as unknown as Pick<FileManager, 'processFrontMatter'>;
    const writer = new ObsidianParentLinkWriter(vault, fileManager);

    await expect(writer.replaceParentLink(plan)).rejects.toThrow(
      'Focus Flow note was not found.',
    );
    expect(fileManager.processFrontMatter).not.toHaveBeenCalled();
  });
});
