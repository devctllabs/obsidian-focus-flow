import type { FileManager, Vault } from 'obsidian';
import { TFile } from 'obsidian';
import { describe, expect, it, vi } from 'vitest';
import type { TaskMovementPlan } from '../../application/focus/focus-board';
import { ObsidianTaskMovementWriter } from './ObsidianTaskMovementWriter';

const plan: TaskMovementPlan = {
  path: 'Focus Flow/Tasks/FF-43 Prepare weekly focus.md',
  id: '01994706-857c-76f1-8006-85cd9bd80890',
  expectedLifecycle: 'active',
  replacementLifecycle: 'active',
  expectedStatus: 'today',
  replacementStatus: 'in_progress',
  expectedTaskRank: 'a1',
  replacementTaskRank: 'a1V',
  expectedStartedAt: null,
  replacementStartedAt: '2026-08-31T10:00:00.000Z',
  expectedCompletedAt: null,
  replacementCompletedAt: null,
};

function setup(managed: Record<string, unknown>) {
  const file = Object.assign(new TFile(), { path: plan.path });
  const frontmatter = {
    cssclasses: ['wide-page'],
    focus_flow: {
      ...managed,
      custom_managed_extension: 'preserve me',
    },
  };
  const vault = {
    getAbstractFileByPath: vi.fn().mockReturnValue(file),
  } as unknown as Pick<Vault, 'getAbstractFileByPath'>;
  const fileManager = {
    processFrontMatter: vi.fn(
      async (
        _file: TFile,
        update: (value: Record<string, unknown>) => void,
      ) => update(frontmatter),
    ),
  } as unknown as Pick<FileManager, 'processFrontMatter'>;
  return {
    frontmatter,
    fileManager,
    writer: new ObsidianTaskMovementWriter(vault, fileManager),
  };
}

describe('ObsidianTaskMovementWriter', () => {
  it('atomically writes status, rank, lifecycle, and timestamps', async () => {
    const { writer, frontmatter, fileManager } = setup({
      id: plan.id,
      lifecycle: plan.expectedLifecycle,
      status: plan.expectedStatus,
      task_rank: plan.expectedTaskRank,
      started_at: plan.expectedStartedAt,
      completed_at: plan.expectedCompletedAt,
    });

    await writer.move(plan);

    expect(frontmatter).toEqual({
      cssclasses: ['wide-page'],
      focus_flow: {
        id: plan.id,
        lifecycle: plan.replacementLifecycle,
        status: plan.replacementStatus,
        task_rank: plan.replacementTaskRank,
        started_at: plan.replacementStartedAt,
        completed_at: plan.replacementCompletedAt,
        custom_managed_extension: 'preserve me',
      },
    });
    expect(fileManager.processFrontMatter).toHaveBeenCalledOnce();
  });

  it('accepts an already applied movement as an idempotent resume', async () => {
    const { writer, frontmatter } = setup({
      id: plan.id,
      lifecycle: plan.replacementLifecycle,
      status: plan.replacementStatus,
      task_rank: plan.replacementTaskRank,
      started_at: plan.replacementStartedAt,
      completed_at: plan.replacementCompletedAt,
    });

    await expect(writer.move(plan)).resolves.toBeUndefined();
    expect(frontmatter.focus_flow).toMatchObject({
      status: plan.replacementStatus,
      task_rank: plan.replacementTaskRank,
    });
  });

  it('rejects stale Task state without overwriting any field', async () => {
    const { writer, frontmatter } = setup({
      id: plan.id,
      lifecycle: plan.expectedLifecycle,
      status: 'tomorrow',
      task_rank: plan.expectedTaskRank,
      started_at: plan.expectedStartedAt,
      completed_at: plan.expectedCompletedAt,
    });

    await expect(writer.move(plan)).rejects.toThrow(
      'Task changed before the move.',
    );
    expect(frontmatter.focus_flow).toMatchObject({
      status: 'tomorrow',
      task_rank: plan.expectedTaskRank,
      started_at: null,
      completed_at: null,
    });
  });

  it('rejects a missing Task before processing frontmatter', async () => {
    const vault = {
      getAbstractFileByPath: vi.fn().mockReturnValue(null),
    } as unknown as Pick<Vault, 'getAbstractFileByPath'>;
    const fileManager = {
      processFrontMatter: vi.fn(),
    } as unknown as Pick<FileManager, 'processFrontMatter'>;
    const writer = new ObsidianTaskMovementWriter(vault, fileManager);

    await expect(writer.move(plan)).rejects.toThrow('Task was not found.');
    expect(fileManager.processFrontMatter).not.toHaveBeenCalled();
  });
});
