import { TFile, type Vault } from 'obsidian';
import { describe, expect, it, vi } from 'vitest';
import type {
  CandidateCreationPlan,
  TaskCreationPlan,
} from '../../application/work/create-work';
import { ObsidianWorkCreator } from './ObsidianWorkCreator';

const candidate: CandidateCreationPlan = {
  kind: 'candidate',
  id: '01994770-0000-7000-8000-000000000001',
  key: 'FF-42',
  title: 'Explore calm / planning',
  createdAt: '2026-08-30T12:00:00.000Z',
  body: '# Explore calm planning\n\nUSER BODY.',
  tags: ['focus', 'weekly'],
};

function vaultFixture() {
  const paths = new Set<string>();
  const vault = {
    getAbstractFileByPath: vi.fn((path: string) =>
      paths.has(path) ? { path } : null,
    ),
    createFolder: vi.fn(async (path: string) => {
      paths.add(path);
      return { path };
    }),
    create: vi.fn(async (path: string) => {
      paths.add(path);
      return Object.assign(new TFile(), { path });
    }),
  } as unknown as Pick<
    Vault,
    'getAbstractFileByPath' | 'createFolder' | 'create'
  >;
  return { vault, paths };
}

describe('ObsidianWorkCreator', () => {
  it('creates missing Inbox folders and a managed Candidate note', async () => {
    const { vault } = vaultFixture();
    const writer = new ObsidianWorkCreator(vault, () => 'Focus Flow');

    await expect(writer.create(candidate)).resolves.toBe(
      'Focus Flow/Inbox/FF-42 Explore calm - planning.md',
    );

    expect(vault.createFolder).toHaveBeenNthCalledWith(1, 'Focus Flow');
    expect(vault.createFolder).toHaveBeenNthCalledWith(2, 'Focus Flow/Inbox');
    expect(vault.create).toHaveBeenCalledWith(
      'Focus Flow/Inbox/FF-42 Explore calm - planning.md',
      `---
tags: ["focus","weekly"]
focus_flow:
  schema_version: 1
  id: 01994770-0000-7000-8000-000000000001
  key: FF-42
  type: candidate
  lifecycle: inbox
  created_at: "2026-08-30T12:00:00.000Z"
---

# Explore calm planning

USER BODY.`,
    );
  });

  it('creates a Task with its canonical Story relationship and rank', async () => {
    const { vault } = vaultFixture();
    const writer = new ObsidianWorkCreator(vault, () => 'Focus Flow');
    const task: TaskCreationPlan = {
      kind: 'task',
      id: '01994770-0000-7000-8000-000000000002',
      key: 'FF-44',
      title: 'Draft review',
      createdAt: '2026-08-30T12:15:00.000Z',
      body: '# Draft review\n',
      storyId: '019946f1-8d2a-7f05-87b1-1eebbb476300',
      storyLink: '[[Focus Flow/Stories/FF-42 Improve weekly focus]]',
      taskRank: 'a1',
    };

    await writer.create(task);

    expect(vault.create).toHaveBeenCalledWith(
      'Focus Flow/Tasks/FF-44 Draft review.md',
      expect.stringContaining(`  type: task
  lifecycle: active
  story_id: 019946f1-8d2a-7f05-87b1-1eebbb476300
  story_link: "[[Focus Flow/Stories/FF-42 Improve weekly focus]]"
  task_rank: a1
  status: todo
  started_at:
  completed_at:`),
    );
  });

  it('does not overwrite an existing note at the generated path', async () => {
    const { vault, paths } = vaultFixture();
    paths.add('Focus Flow');
    paths.add('Focus Flow/Inbox');
    paths.add('Focus Flow/Inbox/FF-42 Explore calm - planning.md');
    const writer = new ObsidianWorkCreator(vault, () => 'Focus Flow');

    await expect(writer.create(candidate)).rejects.toThrow(
      'Focus Flow note already exists.',
    );
    expect(vault.create).not.toHaveBeenCalled();
  });
});
