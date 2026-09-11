import { TFile } from 'obsidian';
import { expect, it, vi } from 'vitest';
import { activeStory } from '../../test/storybook/fixtures';
import { setObsidianMonthMembership } from './ObsidianMonthBacklogWriter';

it('changes only the Story horizon and its owning rank, rejecting a concurrent Sprint transfer', async () => {
  const note = { ...activeStory, lifecycle: 'epic_backlog' as const, backlogRank: null, sprintId: null, sprintRank: null };
  const managed = { id: note.id, type: 'story', lifecycle: 'epic_backlog', epic_id: note.epicId, custom: 'keep' } as Record<string, unknown>;
  const file = Object.assign(new TFile(), { path: note.path });
  const vault = { getAbstractFileByPath: vi.fn(() => file) };
  const fileManager = { processFrontMatter: vi.fn(async (_file: TFile, update: (value: Record<string, unknown>) => void) => update({ focus_flow: managed })) };
  await setObsidianMonthMembership(vault, fileManager, 'Focus Flow', { note, selected: true, backlogRank: 'a0' });
  expect(managed).toEqual({ id: note.id, type: 'story', lifecycle: 'backlog', epic_id: note.epicId, custom: 'keep', backlog_rank: 'a0' });
  managed.lifecycle = 'active_sprint';
  await expect(setObsidianMonthMembership(vault, fileManager, 'Focus Flow', { note, selected: true, backlogRank: 'a0' })).rejects.toThrow('changed');
});
