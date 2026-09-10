import { expect, it, vi } from 'vitest';
import type { ProjectedManagedEntity } from '../indexing/work-index';
import { candidate, epic, story as monthStory, task, activeSprint, activeStory } from '../../test/storybook/fixtures';
import { WorkDeletionService } from './delete-work';

function setup(entities: ProjectedManagedEntity[], content = '# Accidental note\n\n## Description\n') {
  const snapshot = { phase: 'ready' as const, entities, diagnostics: [] };
  const storage = { read: vi.fn(async () => content), trash: vi.fn(async () => undefined) };
  const index = { refresh: vi.fn(async () => undefined), getSnapshot: () => snapshot };
  return { service: new WorkDeletionService(index, storage), storage, snapshot };
}
it('previews content and trashes a standalone accidental Story only after confirmation', async () => {
  const context = setup([epic, monthStory], '# Story\n\n## Notes\nKeep this research');
  const preview = await context.service.preview(monthStory.id);
  expect(preview.warnings.join(' ')).toMatch(/content/);
  expect(preview.blockers).toEqual([]);
  expect(context.storage.trash).not.toHaveBeenCalled();
  await context.service.confirm(preview);
  expect(context.storage.trash).toHaveBeenCalledWith(monthStory, preview.content);
});
it('blocks a parent with children, Sprint membership, and snapshot references', async () => {
  const context = setup([epic, activeStory, task, activeSprint]);
  expect((await context.service.preview(epic.id)).blockers.join(' ')).toMatch(/Stories/);
  expect((await context.service.preview(activeStory.id)).blockers.join(' ')).toMatch(/Tasks/);
  expect((await context.service.preview(activeStory.id)).blockers.join(' ')).toMatch(/Sprint/);
  expect((await context.service.preview(task.id)).blockers.join(' ')).toMatch(/Sprint/);
});
it('rechecks children and content when a confirmation is stale', async () => {
  const context = setup([epic, monthStory]);
  const preview = await context.service.preview(monthStory.id);
  context.snapshot.entities.push({ ...task, storyId: monthStory.id });
  await expect(context.service.confirm(preview)).rejects.toThrow(/Tasks/);
  context.snapshot.entities.pop();
  context.storage.read.mockResolvedValue('New research');
  await expect(context.service.confirm(preview)).rejects.toThrow(/changed/);
  expect(context.storage.trash).not.toHaveBeenCalled();
});
it('previews and deletes an accidental Inbox Candidate without rejecting it', async () => {
  const context = setup([candidate], '## Description\nA thought entered by mistake');
  const preview = await context.service.preview(candidate.id);
  expect(preview.blockers).toEqual([]);
  expect(preview.warnings.join(' ')).toContain('content');
  expect(context.storage.trash).not.toHaveBeenCalled();
  await context.service.confirm(preview);
  expect(context.storage.trash).toHaveBeenCalledWith(candidate, preview.content);
});
