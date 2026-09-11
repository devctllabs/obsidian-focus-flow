import { TFile, type FileManager, type Vault } from 'obsidian';
import { describe, expect, it, vi } from 'vitest';
import type { EpicFinalizationPlan } from '../../application/planning/finalize-epic';
import { ObsidianEpicFinalizationWriter } from './ObsidianEpicFinalizationWriter';

const epicPath = 'Focus Flow/Epics/FF-1 Epic.md';
const childPath = 'Focus Flow/Stories/FF-2 Story.md';

describe('ObsidianEpicFinalizationWriter', () => {
  it('revalidates children, completes the Epic, and preserves unrelated frontmatter', async () => {
    const context = setup('done');

    await context.writer.apply(plan('complete-epic'));

    expect(context.epic).toEqual({
      tags: ['keep'],
      focus_flow: {
        id: 'epic',
        type: 'epic',
        lifecycle: 'done',
        created_at: '2026-08-01T00:00:00Z',
        completed_at: '2026-09-01T12:00:00Z',
        custom_extension: 'keep',
      },
    });
  });

  it('rejects a child-state race before changing the Epic', async () => {
    const context = setup('backlog');

    await expect(context.writer.apply(plan('close-epic'))).rejects.toThrow(
      'child Story changed',
    );
    expect(context.epic.focus_flow).toMatchObject({
      lifecycle: 'backlog',
      backlog_rank: 'a0',
    });
  });

  it.each([
    { reason: 'Changed.', expected: 'Changed.' },
    { reason: null, expected: undefined },
  ])('closes the Epic and preserves optional reason $reason', async ({
    reason,
    expected,
  }) => {
    const context = setup('done');

    await context.writer.apply({ ...plan('close-epic'), closeReason: reason });

    expect(context.epic.focus_flow).toEqual({
      id: 'epic',
      type: 'epic',
      lifecycle: 'closed',
      created_at: '2026-08-01T00:00:00Z',
      closed_at: '2026-09-01T12:00:00Z',
      close_reason: expected,
      custom_extension: 'keep',
    });
  });
});

function plan(kind: EpicFinalizationPlan['kind']): EpicFinalizationPlan {
  return {
    kind,
    epic: { id: 'epic', path: epicPath, expectedBacklogRank: 'a0' },
    children: [{ id: 'story', path: childPath, lifecycle: 'done' }],
    finalizedAt: '2026-09-01T12:00:00Z',
    closeReason: kind === 'close-epic' ? 'Changed.' : null,
  };
}

function setup(childLifecycle: 'backlog' | 'done') {
  const files = new Map([
    [epicPath, Object.assign(new TFile(), { path: epicPath })],
    [childPath, Object.assign(new TFile(), { path: childPath })],
  ]);
  const epic: { tags: string[]; focus_flow: Record<string, unknown> } = {
    tags: ['keep'],
    focus_flow: {
      id: 'epic',
      type: 'epic',
      lifecycle: 'backlog',
      backlog_rank: 'a0',
      created_at: '2026-08-01T00:00:00Z',
      custom_extension: 'keep',
    },
  };
  const child = {
    focus_flow: { id: 'story', type: 'story', lifecycle: childLifecycle },
  };
  const fileManager = {
    processFrontMatter: vi.fn(async (
      file: TFile,
      mutate: (value: Record<string, unknown>) => void,
    ) => mutate(file.path === epicPath ? epic : child)),
  } as unknown as Pick<FileManager, 'processFrontMatter'>;
  const vault = {
    getAbstractFileByPath: vi.fn((path: string) => files.get(path) ?? null),
  } as unknown as Pick<Vault, 'getAbstractFileByPath'>;
  return {
    writer: new ObsidianEpicFinalizationWriter(vault, fileManager),
    epic,
  };
}
