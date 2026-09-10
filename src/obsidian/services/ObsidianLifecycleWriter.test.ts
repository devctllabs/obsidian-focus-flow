import { TFile, TFolder } from 'obsidian';
import { parse, stringify } from 'yaml';
import { expect, it } from 'vitest';
import { closePlanFixture } from '../../test/lifecycle-fixture';
import { ObsidianManagedStore, readManagedMarkdown } from './ObsidianManagedStore';
import { ObsidianLifecycleWriter } from './ObsidianLifecycleWriter';
import type { ManagedBlock } from '../../domain/managed-replacement';
import { buildWorkIndexSnapshot } from '../../application/indexing/work-index';
import { buildReviewHistory } from '../../application/history/review-history';

const archivedSprintPath = 'Focus Flow/Sprints/Archive/2026/08/SPR-014.md';

function fixture(
  retrospectiveTemplate = '## Retrospective Items\n',
) {
  const plan = closePlanFixture();
  const files = new Map<string, TFile | TFolder>();
  const contents = new Map<string, string>();
  const writes: string[] = [];
  let failAt = -1;
  const mutate = (label: string) => { writes.push(label); if (writes.length === failAt) throw new Error('Interrupted'); };
  const add = (path: string, managed: ManagedBlock) => {
    files.set(path, Object.assign(new TFile(), { path }));
    contents.set(path, `---\n${stringify({ tags: ['live'], owner: 'me', focus_flow: managed })}---\nMy **live** notes.\n`);
  };
  const vault = {
    getAbstractFileByPath: (path: string) => files.get(path) ?? null,
    getMarkdownFiles: () => [...files.values()].filter((file): file is TFile => file instanceof TFile),
    read: async (file: TFile) => contents.get(file.path)!,
    process: async (file: TFile, transform: (markdown: string) => string) => { mutate(`write:${file.path}`); const value = transform(contents.get(file.path)!); contents.set(file.path, value); return value; },
    createFolder: async (path: string) => { const folder = Object.assign(new TFolder(), { path }); files.set(path, folder); return folder; },
    create: async (path: string, markdown: string) => { if (files.has(path)) throw new Error('Collision'); mutate(`create:${path}`); const file = Object.assign(new TFile(), { path }); files.set(path, file); contents.set(path, markdown); return file; },
  };
  const manager = { renameFile: async (file: TFile, destination: string) => { mutate(`move:${file.path}`); if (files.has(destination)) throw new Error('Collision'); contents.set(destination, contents.get(file.path)!); contents.delete(file.path); files.delete(file.path); Object.assign(file, { path: destination }); files.set(destination, file); } };
  const store = new ObsidianManagedStore({ ...vault, rename: manager.renameFile }, () => 'Focus Flow');
  const service = new ObsidianLifecycleWriter(
    store,
    () => '01994a8a-0371-7a2d-a3e9-247990391601',
    async () => retrospectiveTemplate,
  );
  const sprint: ManagedBlock = {
    schema_version: 1,
    id: plan.sprintId,
    type: 'sprint',
    lifecycle: 'active',
    code: 'SPR-014',
    sequence: 14,
    starts_on: '2026-08-24',
    due_on: '2026-08-30',
    started_at: '2026-08-24T08:30:00Z',
    provisional_story_outcomes: [{
      story_id: plan.stories[0]!.id,
      evaluated_at: '2026-08-30T17:00:00Z',
      outcome: 'not_achieved',
      evidence: 'My reflection',
      acceptance_exception_reason: null,
    }],
    start_snapshot: {
      captured_at: '2026-08-24T08:30:00Z',
      stories: [{
        id: plan.stories[0]!.id,
        key: 'FF-42',
        title: 'Continue',
        epic_id: plan.closeSnapshot.stories[0]!.epicId,
        sprint_rank: 'a0',
        acceptance_criteria_hash: `sha256:${'0'.repeat(64)}`,
        acceptance_criteria: [{ text: 'Done', checked: false }],
        effective_tags: ['product/focus-flow'],
        tasks: [{
          id: plan.tasks[0]!.id,
          key: 'FF-43',
          title: 'Promote me',
          task_rank: 'a0',
          status: 'in_progress',
          completed_before_sprint: false,
          effective_tags: ['product/focus-flow'],
        }],
      }],
    },
  };
  const story: ManagedBlock = { id: plan.stories[0]!.id, type: 'story', key: 'FF-42', lifecycle: 'active_sprint', sprint_id: plan.sprintId, sprint_rank: 'a0', epic_id: '019946c9-5f97-7196-8483-73469275ff90' };
  const task: ManagedBlock = { id: plan.tasks[0]!.id, key: 'FF-43', type: 'task', lifecycle: 'active', story_id: story.id, story_link: `[[${plan.stories[0]!.path.replace(/\.md$/, '')}]]`, task_rank: 'a0', status: 'in_progress', started_at: '2026-08-28T09:00:00Z', completed_at: null };
  add(plan.sprintPath, sprint); add(plan.stories[0]!.path, story); add(plan.tasks[0]!.path, task);
  return { plan, add, store, service, contents, writes, sprint, story, task, interrupt: (count: number) => { failAt = writes.length + count; }, resume: () => { failAt = -1; } };
}

it('archives the canonical Sprint note in the close month', async () => {
  const f = fixture();

  await f.service.close(f.plan);

  expect(await f.store.read(f.plan.sprintPath)).toBeNull();
  expect(await f.store.read(archivedSprintPath)).toMatchObject({
    id: f.plan.sprintId,
    lifecycle: 'closed',
    closed_at: f.plan.capturedAt,
  });
  const markdown = f.contents.get(archivedSprintPath)!;
  expect(markdown).toContain('focus-flow:report:start');
  const parsed = readManagedMarkdown(markdown);
  const snapshot = buildWorkIndexSnapshot(
    [{
      path: archivedSprintPath,
      frontmatter: parsed.doc.toJS(),
      body: parsed.body,
    }],
    { path: 'Focus Flow/MISSION.md', body: 'Focus intentionally.' },
  );
  expect(snapshot.diagnostics).toEqual([]);
  expect(snapshot.entities).toMatchObject([
    { id: f.plan.sprintId, lifecycle: 'closed', path: archivedSprintPath },
  ]);
  expect(
    buildReviewHistory(snapshot.entities).years[0]?.quarters[0]?.months[0]
      ?.sprints[0]?.sprint.path,
  ).toBe(archivedSprintPath);
});

it.each(['invalid-timestamp', 'occupied-destination'] as const)(
  'blocks Close before writes when archive preflight finds %s',
  async (reason) => {
    const f = fixture();
    const plan = reason === 'invalid-timestamp'
      ? { ...f.plan, capturedAt: 'invalid' }
      : f.plan;
    if (reason === 'occupied-destination') {
      f.add(archivedSprintPath, {
        id: '01994744-a401-759a-b582-4418f2f24050',
        type: 'sprint',
        lifecycle: 'closed',
      });
    }

    await expect(f.service.close(plan)).rejects.toThrow(
      reason === 'invalid-timestamp' ? 'timestamp' : 'Destination already exists',
    );
    expect(f.writes).toEqual([]);
  },
);

it('closes a Sprint with existing retrospective sections without duplicating them', async () => {
  const f = fixture('## Wins\n\n## Friction\n\n## Improvements\n');
  f.contents.set(
    f.plan.sprintPath,
    f.contents
      .get(f.plan.sprintPath)!
      .replace(
        'My **live** notes.',
        `# Draft Sprint

## Wins
- good

## Friction
- bad

## Improvements
- Improve`,
      ),
  );

  await f.service.close(f.plan);

  const body = readManagedMarkdown(f.contents.get(archivedSprintPath)!).body;
  expect(body.match(/^## Wins$/gm)).toHaveLength(1);
  expect(body.match(/^## Friction$/gm)).toHaveLength(1);
  expect(body.match(/^## Improvements$/gm)).toHaveLength(1);
  expect(body).toContain('<!-- focus-flow:report:start -->');
});

it('closes with durable pre/post recovery, reopens exact work and retracts only the generated report', async () => {
  const f = fixture();
  await f.service.close(f.plan);
  const closed = (await f.store.read(archivedSprintPath))!;
  expect(closed.lifecycle).toBe('closed');
  expect(closed.reopen_recovery).toMatchObject({ close_operation_id: f.plan.operationId });
  const promoted = 'Focus Flow/Stories/FF-43 Promote me.md';
  f.contents.set(promoted, f.contents.get(promoted)!.replace('My **live** notes.', 'Changed **user** prose.').replace('live', 'new-tag'));
  await f.service.reopen(f.plan.sprintId);
  expect(await f.store.read(f.plan.stories[0]!.path)).toEqual(f.story);
  expect(await f.store.read(f.plan.tasks[0]!.path)).toEqual(f.task);
  const reopened = (await f.store.read(f.plan.sprintPath))!;
  expect(reopened.lifecycle).toBe('active');
  expect(reopened.id).toBe(f.plan.sprintId);
  expect(reopened.provisional_story_outcomes).toEqual(f.sprint.provisional_story_outcomes);
  expect(reopened).not.toHaveProperty('close_snapshot');
  expect(reopened).not.toHaveProperty('closed_at');
  expect(reopened).not.toHaveProperty('pending_reopen');
  expect(f.contents.get(f.plan.tasks[0]!.path)).toContain('Changed **user** prose.');
  expect(f.contents.get(f.plan.tasks[0]!.path)).toContain('new-tag');
  expect(f.contents.get(f.plan.sprintPath)).not.toContain('focus-flow:report:start');
  expect(f.contents.get(f.plan.sprintPath)).toContain('My **live** notes.');
  const secondOperation = '01994a8a-0371-7a2d-a3e9-247990391602';
  await f.service.close({
    ...f.plan,
    operationId: secondOperation,
    capturedAt: '2026-09-01T09:00:00+04:00',
    closeSnapshot: {
      ...f.plan.closeSnapshot,
      operationId: secondOperation,
      capturedAt: '2026-09-01T09:00:00+04:00',
    },
  });
  const reclosed = await f.store.read(
    'Focus Flow/Sprints/Archive/2026/09/SPR-014.md',
  );
  expect(reclosed).toMatchObject({
    id: f.plan.sprintId,
    reopen_recovery: { close_operation_id: secondOperation },
  });
  expect(await f.store.read(archivedSprintPath)).toBeNull();
});

it('archives terminal Story and closed Task, updates even previously terminal child links and restores their original paths', async () => {
  const f = fixture();
  const plan = { ...f.plan, stories: f.plan.stories.map((story) => ({ ...story, outcome: 'achieved' as const, backlogRank: null })), tasks: f.plan.tasks.map((task) => ({ ...task, resolution: 'irrelevant' as const })) };
  const oldPath = 'Focus Flow/Tasks/Archive/2026/07/FF-50 Already done.md';
  const old = { ...f.task, id: '01994706-857c-76f1-8006-85cd9bd80899', lifecycle: 'done', status: 'done', completed_at: '2026-07-31T22:00:00Z' };
  f.add(oldPath, old);
  await f.service.close(plan);
  const archiveStory = 'Focus Flow/Stories/Archive/2026/08/FF-42 Continue.md';
  expect(await f.store.read(archiveStory)).toMatchObject({ lifecycle: 'done' });
  expect(await f.store.read('Focus Flow/Tasks/Archive/2026/08/FF-43 Promote me.md')).toMatchObject({ lifecycle: 'closed', story_link: `[[${archiveStory.slice(0, -3)}]]` });
  expect(await f.store.read(oldPath)).toMatchObject({ story_link: `[[${archiveStory.slice(0, -3)}]]` });
  await f.service.reopen(f.plan.sprintId);
  expect(await f.store.read(oldPath)).toEqual(old);
  expect(await f.store.read(f.plan.stories[0]!.path)).toEqual(f.story);
});

it.each(['draft', 'later', 'changed', 'legacy'] as const)('blocks unsafe Reopen before writes: %s', async (reason) => {
  const f = fixture();
  await f.service.close(f.plan);
  if (reason === 'draft') f.add('Focus Flow/Sprints/Draft.md', { id: 'draft', type: 'sprint', lifecycle: 'draft' });
  if (reason === 'later') f.add('Focus Flow/Sprints/SPR-015.md', { id: 'later', type: 'sprint', lifecycle: 'closed', sequence: 15 });
  if (reason === 'changed') f.contents.set(f.plan.stories[0]!.path, f.contents.get(f.plan.stories[0]!.path)!.replace('backlog_rank: a1', 'backlog_rank: a9'));
  if (reason === 'legacy') await f.store.transform(archivedSprintPath, (managed) => { delete managed.reopen_recovery; return managed; });
  const count = f.writes.length;
  await expect(f.service.reopen(f.plan.sprintId)).rejects.toThrow({ draft: 'Cancel the Draft', later: 'Only the latest', changed: 'Work changed', legacy: 'before reopen recovery' }[reason]);
  expect(f.writes).toHaveLength(count);
});

it.each([1, 2, 3, 4, 5, 6, 7])('resumes Close after write interruption %s', async (position) => {
  const f = fixture();
  f.interrupt(position);
  await expect(f.service.close(f.plan)).rejects.toThrow('Interrupted');
  f.resume();
  await f.service.close(f.plan);
  const archived = await f.store.read(archivedSprintPath);
  expect(archived).toMatchObject({ lifecycle: 'closed' });
  expect(archived).not.toHaveProperty('pending_close');
});

it('retains pending Close without touching work when the Sprint acquires a third state', async () => {
  const f = fixture();
  f.interrupt(2);
  await expect(f.service.close(f.plan)).rejects.toThrow('Interrupted');
  f.resume();
  await f.store.transform(f.plan.sprintPath, (managed) => ({
    ...managed,
    surprise: true,
  }));
  const count = f.writes.length;

  await expect(f.service.close(f.plan)).rejects.toThrow(
    'Sprint changed before Close finalization',
  );

  expect(f.writes).toHaveLength(count);
  expect(await f.store.read(f.plan.sprintPath)).toHaveProperty('pending_close');
});

it.each([1, 2, 3, 4, 5, 6, 7])('resumes Reopen after write interruption %s', async (position) => {
  const f = fixture();
  await f.service.close(f.plan);
  f.interrupt(position);
  await expect(f.service.reopen(f.plan.sprintId)).rejects.toThrow('Interrupted');
  f.resume();
  await f.service.reopen(f.plan.sprintId);
  expect(await f.store.read(f.plan.tasks[0]!.path)).toEqual(f.task);
  expect(await f.store.read(f.plan.sprintPath)).toMatchObject({
    id: f.plan.sprintId,
    lifecycle: 'active',
  });
  expect(await f.store.read(archivedSprintPath)).toBeNull();
});

it('blocks Reopen before writes when the active root destination is occupied', async () => {
  const f = fixture();
  await f.service.close(f.plan);
  f.add(f.plan.sprintPath, {
    id: '01994706-857c-76f1-8006-85cd9bd80899',
    type: 'task',
    lifecycle: 'active',
  });
  const count = f.writes.length;

  await expect(f.service.reopen(f.plan.sprintId)).rejects.toThrow(
    'Destination already exists',
  );

  expect(f.writes).toHaveLength(count);
  expect(await f.store.read(archivedSprintPath)).toMatchObject({
    id: f.plan.sprintId,
    lifecycle: 'closed',
  });
});

it.each(['close', 'reopen'] as const)('does not resume %s while another workspace operation is pending', async (operation) => {
  const f = fixture();
  if (operation === 'reopen') await f.service.close(f.plan);
  f.interrupt(2);
  const resume = () => operation === 'close' ? f.service.close(f.plan) : f.service.reopen(f.plan.sprintId);
  await expect(resume()).rejects.toThrow('Interrupted');
  f.resume();
  f.add('Focus Flow/WORKSPACE-OPERATIONS.md', { schema_version: 1, type: 'workspace_operation', pending: true });
  const count = f.writes.length;
  await expect(resume()).rejects.toThrow('A workspace operation is pending');
  expect(f.writes).toHaveLength(count);
});

it('organizes old terminal notes with a durable plan, then performs a no-write empty run', async () => {
  const f = fixture();
  const path = f.plan.tasks[0]!.path;
  f.add(path, { ...f.task, lifecycle: 'done', status: 'done', completed_at: '2026-09-01T00:30:00+14:00' });
  const preview = await f.service.previewArchive();
  expect(preview.entries[0]!.after.path).toContain('/Archive/2026/09/');
  f.interrupt(3);
  await expect(f.service.organize(preview)).rejects.toThrow('Interrupted');
  f.resume();
  await f.service.organize(await f.service.previewArchive());
  const count = f.writes.length;
  const empty = await f.service.previewArchive();
  expect(empty.entries).toEqual([]);
  await f.service.organize(empty);
  expect(f.writes).toHaveLength(count);
  const archived = f.contents.get(preview.entries[0]!.after.path)!;
  expect(readManagedMarkdown(archived).body).toBe('My **live** notes.\n');
  expect((parse(archived.split('---')[1]!) as { tags: unknown }).tags).toEqual(['live']);
});

it('organizes Closed Sprints from the root and a wrong archive month', async () => {
  const f = fixture();
  await f.store.transform(f.plan.sprintPath, (managed) => ({
    ...managed,
    lifecycle: 'closed',
    closed_at: '2026-09-01T00:30:00+14:00',
  }));
  const wrongMonth = 'Focus Flow/Sprints/Archive/2026/07/SPR-099.md';
  f.add(wrongMonth, {
    id: '01994744-a401-759a-b582-4418f2f24099',
    type: 'sprint',
    lifecycle: 'closed',
    closed_at: '2026-08-31T23:30:00-12:00',
  });

  const preview = await f.service.previewArchive();

  expect(preview.diagnostics).toEqual([]);
  expect(preview.entries.map((entry) => [entry.before.path, entry.after.path]))
    .toEqual([
      [
        f.plan.sprintPath,
        'Focus Flow/Sprints/Archive/2026/09/SPR-014.md',
      ],
      [
        wrongMonth,
        'Focus Flow/Sprints/Archive/2026/08/SPR-099.md',
      ],
    ]);
  expect(preview.entries.every((entry) => entry.before.managed === entry.after.managed || JSON.stringify(entry.before.managed) === JSON.stringify(entry.after.managed))).toBe(true);

  await f.service.organize(preview);

  expect(await f.store.read(f.plan.sprintPath)).toBeNull();
  expect(await f.store.read(wrongMonth)).toBeNull();
  expect(await f.store.read('Focus Flow/Sprints/Archive/2026/09/SPR-014.md')).toMatchObject({ id: f.plan.sprintId });
  expect(await f.store.read('Focus Flow/Sprints/Archive/2026/08/SPR-099.md')).toMatchObject({ id: '01994744-a401-759a-b582-4418f2f24099' });
  expect((await f.service.previewArchive()).entries).toEqual([]);
});

it('organizes the latest reopenable Sprint without changing its identity, report, or eligibility', async () => {
  const f = fixture('## Wins\n\n## Friction\n\n## Improvements\n');
  await f.service.close(f.plan);
  const closed = await f.store.read(archivedSprintPath);
  if (closed === null) throw new Error('Closed Sprint was not archived');
  const originalMarkdown = f.contents.get(archivedSprintPath);
  const wrongMonth = 'Focus Flow/Sprints/Archive/2026/07/SPR-014.md';
  await f.store.move(archivedSprintPath, wrongMonth, closed);

  const preview = await f.service.previewArchive();
  expect(preview.entries).toMatchObject([{
    before: { path: wrongMonth },
    after: { path: archivedSprintPath },
  }]);
  await f.service.organize(preview);

  expect(f.contents.get(archivedSprintPath)).toBe(originalMarkdown);
  await expect(f.service.previewReopen(f.plan.sprintId)).resolves.toEqual({
    path: archivedSprintPath,
    code: 'SPR-014',
    resuming: false,
  });
});

it('reports a Closed Sprint organizer destination collision before writing', async () => {
  const f = fixture();
  await f.service.close(f.plan);
  const closed = await f.store.read(archivedSprintPath);
  if (closed === null) throw new Error('Closed Sprint was not archived');
  const wrongMonth = 'Focus Flow/Sprints/Archive/2026/07/SPR-014.md';
  await f.store.move(archivedSprintPath, wrongMonth, closed);
  f.add(archivedSprintPath, {
    ...closed,
    id: '01994744-a401-759a-b582-4418f2f24098',
  });
  const writesBeforePreview = [...f.writes];

  const preview = await f.service.previewArchive();

  expect(preview.diagnostics).toEqual([
    expect.stringContaining(`Destination already exists: ${archivedSprintPath}`),
  ]);
  await expect(f.service.organize(preview)).rejects.toThrow('diagnostics');
  expect(f.writes).toEqual(writesBeforePreview);
  expect(await f.store.read(wrongMonth)).toMatchObject({ id: f.plan.sprintId });
  expect(await f.store.read(archivedSprintPath)).toMatchObject({
    id: '01994744-a401-759a-b582-4418f2f24098',
  });
});

it('diagnoses Draft and Active Sprints in Archive without planning a move', async () => {
  const f = fixture();
  f.add('Focus Flow/Sprints/Archive/2026/08/DRAFT.md', {
    id: '01994744-a401-759a-b582-4418f2f24097',
    type: 'sprint',
    lifecycle: 'draft',
  });
  f.add('Focus Flow/Sprints/Archive/2026/08/SPR-098.md', {
    id: '01994744-a401-759a-b582-4418f2f24098',
    type: 'sprint',
    lifecycle: 'active',
  });

  const preview = await f.service.previewArchive();

  expect(preview.entries).toEqual([]);
  expect(preview.diagnostics).toEqual([
    expect.stringContaining('DRAFT.md: Draft Sprint notes belong in Sprints.'),
    expect.stringContaining('SPR-098.md: Active Sprint notes belong in Sprints.'),
  ]);
});

it.each([2, 3])(
  'resumes Closed Sprint organization after interruption %s',
  async (position) => {
    const f = fixture();
    await f.store.transform(f.plan.sprintPath, (managed) => ({
      ...managed,
      lifecycle: 'closed',
      closed_at: '2026-09-01T00:30:00+14:00',
    }));
    const preview = await f.service.previewArchive();
    f.interrupt(position);
    await expect(f.service.organize(preview)).rejects.toThrow('Interrupted');
    f.resume();

    await f.service.organize(await f.service.previewArchive());

    expect(await f.store.read(f.plan.sprintPath)).toBeNull();
    expect(await f.store.read('Focus Flow/Sprints/Archive/2026/09/SPR-014.md'))
      .toMatchObject({ id: f.plan.sprintId, lifecycle: 'closed' });
    expect((await f.service.previewArchive()).entries).toEqual([]);
  },
);

it('moves a newly completed Task in the same durable operation and preserves unrelated data', async () => {
  const f = fixture();
  await f.service.moveTask({ path: f.plan.tasks[0]!.path, id: String(f.task.id), expectedLifecycle: 'active', replacementLifecycle: 'done', expectedStatus: 'in_progress', replacementStatus: 'done', expectedTaskRank: 'a0', replacementTaskRank: 'a1', expectedStartedAt: '2026-08-28T09:00:00Z', replacementStartedAt: '2026-08-28T09:00:00Z', expectedCompletedAt: null, replacementCompletedAt: '2026-09-01T00:30:00+14:00' });
  const path = 'Focus Flow/Tasks/Archive/2026/09/FF-43 Promote me.md';
  expect(await f.store.read(path)).toMatchObject({ lifecycle: 'done', status: 'done', completed_at: '2026-09-01T00:30:00+14:00' });
  expect(f.contents.get(path)).toContain('owner: me');
  expect(f.writes[0]).toBe('create:Focus Flow/WORKSPACE-OPERATIONS.md');
});

it.each(['complete-epic', 'close-epic'] as const)('archives %s and updates terminal child Story links before the move', async (kind) => {
  const f = fixture();
  const epicPath = 'Focus Flow/Epics/FF-40 Product.md';
  const epicId = String(f.story.epic_id);
  f.add(epicPath, { id: epicId, type: 'epic', lifecycle: 'backlog', backlog_rank: 'a0' });
  f.add(f.plan.stories[0]!.path, { ...f.story, lifecycle: 'done', completed_at: '2026-07-15T12:00:00Z', epic_link: `[[${epicPath.slice(0, -3)}]]` });
  await f.service.finalizeEpic({ kind, epic: { id: epicId, path: epicPath, expectedBacklogRank: 'a0' }, children: [{ id: String(f.story.id), path: f.plan.stories[0]!.path, lifecycle: 'done' }], finalizedAt: '2026-09-01T00:30:00+14:00', closeReason: null });
  const target = 'Focus Flow/Epics/Archive/2026/09/FF-40 Product.md';
  expect(await f.store.read(target)).toMatchObject({ lifecycle: kind === 'complete-epic' ? 'done' : 'closed' });
  expect(await f.store.read(f.plan.stories[0]!.path)).toMatchObject({ epic_link: `[[${target.slice(0, -3)}]]` });
  expect(f.writes.indexOf(`write:${f.plan.stories[0]!.path}`)).toBeLessThan(f.writes.indexOf(`move:${epicPath}`));
});

it('reports invalid timestamps alongside every safe preview path without partially organizing', async () => {
  const f = fixture();
  f.add(f.plan.tasks[0]!.path, { ...f.task, lifecycle: 'done', completed_at: '2026-09-01T12:00:00Z' });
  f.add('Focus Flow/Tasks/FF-50 Broken.md', { ...f.task, id: '01994706-857c-76f1-8006-85cd9bd80899', lifecycle: 'done', completed_at: 'invalid' });
  const preview = await f.service.previewArchive();
  expect(preview.entries).toHaveLength(1);
  expect(preview.diagnostics).toEqual([expect.stringContaining('FF-50 Broken')]);
  await expect(f.service.organize(preview)).rejects.toThrow('diagnostics');
  expect(f.writes).toEqual([]);
});

it('retains pending Reopen when a dependent note acquires a third state', async () => {
  const f = fixture();
  await f.service.close(f.plan);
  f.interrupt(3);
  await expect(f.service.reopen(f.plan.sprintId)).rejects.toThrow('Interrupted');
  f.resume();
  await f.store.transform('Focus Flow/Stories/FF-43 Promote me.md', (managed) => ({ ...managed, surprise: true }));
  const count = f.writes.length;
  await expect(f.service.reopen(f.plan.sprintId)).rejects.toThrow('Work changed');
  expect(f.writes).toHaveLength(count);
  expect(await f.store.read(archivedSprintPath)).toHaveProperty('pending_reopen');
});
