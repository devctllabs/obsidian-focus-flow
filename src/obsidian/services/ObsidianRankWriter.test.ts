import type { FileManager, Vault } from 'obsidian';
import { TFile } from 'obsidian';
import { describe, expect, it, vi } from 'vitest';
import type { RankRepairPlan } from '../../domain/work-note';
import { ObsidianRankWriter } from './ObsidianRankWriter';

const plan: RankRepairPlan = {
  kind: 'rebalance-ranks',
  collectionLabel: 'the Epic Backlog',
  entries: [
    {
      path: 'Focus Flow/Epics/FF-40 Build a calmer system.md',
      id: '019946c9-5f97-7196-8483-73469275ff90',
      field: 'backlog_rank',
      expectedValue: 'a0',
      replacementValue: 'a0',
    },
    {
      path: 'Focus Flow/Epics/FF-44 Improve personal reviews.md',
      id: '01994710-0000-7000-8000-000000000001',
      field: 'backlog_rank',
      expectedValue: 'a0',
      replacementValue: 'a1',
    },
  ],
};

describe('ObsidianRankWriter', () => {
  it('revalidates each note and changes only its planned rank field', async () => {
    const files = new Map(
      plan.entries.map((entry) => [
        entry.path,
        Object.assign(new TFile(), { path: entry.path }),
      ]),
    );
    const frontmatters = new Map(
      plan.entries.map((entry) => [
        entry.path,
        {
          cssclasses: ['wide-page'],
          focus_flow: {
            id: entry.id,
            backlog_rank: entry.expectedValue,
            custom_managed_extension: 'preserve me',
          },
        },
      ]),
    );
    const vault = {
      getAbstractFileByPath: vi.fn((path: string) => files.get(path) ?? null),
    } as unknown as Pick<Vault, 'getAbstractFileByPath'>;
    const fileManager = {
      processFrontMatter: vi.fn(
        async (
          file: TFile,
          update: (value: Record<string, unknown>) => void,
        ) => update(frontmatters.get(file.path)!),
      ),
    } as unknown as Pick<FileManager, 'processFrontMatter'>;
    const writer = new ObsidianRankWriter(vault, fileManager);

    await writer.rebalanceRanks(plan);

    expect(
      frontmatters.get(plan.entries[0]!.path)?.focus_flow.backlog_rank,
    ).toBe('a0');
    expect(
      frontmatters.get(plan.entries[1]!.path)?.focus_flow.backlog_rank,
    ).toBe('a1');
    expect(frontmatters.get(plan.entries[1]!.path)).toMatchObject({
      cssclasses: ['wide-page'],
      focus_flow: { custom_managed_extension: 'preserve me' },
    });
    expect(fileManager.processFrontMatter).toHaveBeenCalledTimes(2);
  });

  it('resumes a partially applied plan idempotently', async () => {
    const resumablePlan: RankRepairPlan = {
      ...plan,
      entries: [
        ...plan.entries,
        {
          path: 'Focus Flow/Epics/FF-45 Make reviews repeatable.md',
          id: '01994710-0000-7000-8000-000000000002',
          field: 'backlog_rank',
          expectedValue: 'a0',
          replacementValue: 'a2',
        },
      ],
    };
    const files = new Map(
      resumablePlan.entries.map((entry) => [
        entry.path,
        Object.assign(new TFile(), { path: entry.path }),
      ]),
    );
    const frontmatters = new Map(
      resumablePlan.entries.map((entry, index) => [
        entry.path,
        {
          focus_flow: {
            id: entry.id,
            backlog_rank: index === 1 ? entry.replacementValue : 'a0',
          },
        },
      ]),
    );
    const vault = {
      getAbstractFileByPath: vi.fn((path: string) => files.get(path) ?? null),
    } as unknown as Pick<Vault, 'getAbstractFileByPath'>;
    const fileManager = {
      processFrontMatter: vi.fn(
        async (
          file: TFile,
          update: (value: Record<string, unknown>) => void,
        ) => update(frontmatters.get(file.path)!),
      ),
    } as unknown as Pick<FileManager, 'processFrontMatter'>;
    const writer = new ObsidianRankWriter(vault, fileManager);

    await writer.rebalanceRanks(resumablePlan);

    expect(
      frontmatters.get(resumablePlan.entries[1]!.path)?.focus_flow
        .backlog_rank,
    ).toBe('a1');
    expect(
      frontmatters.get(resumablePlan.entries[2]!.path)?.focus_flow
        .backlog_rank,
    ).toBe('a2');
  });

  it('rejects a stale rank without overwriting it', async () => {
    const entry = plan.entries[1]!;
    const note = Object.assign(new TFile(), { path: entry.path });
    const frontmatter = {
      focus_flow: { id: entry.id, backlog_rank: 'a9' },
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
    const writer = new ObsidianRankWriter(vault, fileManager);

    await expect(
      writer.rebalanceRanks({ ...plan, entries: [entry] }),
    ).rejects.toThrow('Focus Flow note changed before rank repair.');
    expect(frontmatter.focus_flow.backlog_rank).toBe('a9');
  });

  it('rejects a missing planned file before processing its frontmatter', async () => {
    const vault = {
      getAbstractFileByPath: vi.fn().mockReturnValue(null),
    } as unknown as Pick<Vault, 'getAbstractFileByPath'>;
    const fileManager = {
      processFrontMatter: vi.fn(),
    } as unknown as Pick<FileManager, 'processFrontMatter'>;
    const writer = new ObsidianRankWriter(vault, fileManager);

    await expect(writer.rebalanceRanks(plan)).rejects.toThrow(
      'Focus Flow note was not found.',
    );
    expect(fileManager.processFrontMatter).not.toHaveBeenCalled();
  });
});
