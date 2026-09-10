import { describe, expect, it, vi } from 'vitest';
import type { WorkIndexSnapshot } from '../indexing/work-index';
import { WorkCreationService, type WorkCreator, type WorkTemplateRenderer } from './create-work';

function makeService(...[writer, index, templates, nextId, now, getScopePolicy, getLocalDate]: [
  WorkCreator,
  ConstructorParameters<typeof WorkCreationService>[0]['index'],
  WorkTemplateRenderer,
  () => string,
  () => string,
  ConstructorParameters<typeof WorkCreationService>[0]['getScopePolicy']?,
  (() => string)?,
]) {
  return new WorkCreationService({ writer, index, templates, nextId, now, getScopePolicy, getLocalDate });
}

const snapshot: WorkIndexSnapshot = {
  phase: 'ready',
  entities: [
    {
      id: '019946e9-0ef0-7ca3-af0c-ec423d76efed',
      key: 'FF-41',
      title: 'Existing idea',
      type: 'candidate',
      lifecycle: 'inbox',
      createdAt: '2026-08-30T08:45:00+04:00',
      tags: [],
      effectiveTags: [],
      path: 'Focus Flow/Inbox/FF-41 Existing idea.md',
    },
  ],
  diagnostics: [],
};

describe('WorkCreationService', () => {
  it('fills Candidate template fields without removing custom sections', async () => {
    const writer = { create: vi.fn<WorkCreator['create']>().mockResolvedValue('created.md') };
    const service = makeService(writer, { refresh: vi.fn(), getSnapshot: () => snapshot }, { render: vi.fn().mockResolvedValue('## Description\n\nTemplate hint\n\n## Entry Review\n\n## Notes\n\nKeep me\n') }, () => 'id', () => '2026-09-05T10:00:00Z');
    await service.captureCandidate('An idea', ['idea'], { Description: '**My thought**', 'Entry Review': 'WANT', 'Acceptance Criteria': '- [ ] Result' });
    expect(writer.create.mock.calls[0]![0].body).toContain('## Description\n\n**My thought**');
    expect(writer.create.mock.calls[0]![0].body).toContain('## Notes\n\nKeep me');
    expect(writer.create.mock.calls[0]![0].body).toContain('## Acceptance Criteria\n\n- [ ] Result');
  });
  it('creates Tasks with typed body fields and own tags', async () => {
    const { activeStory } = await import('../../test/storybook/fixtures');
    const writer = { create: vi.fn<WorkCreator['create']>().mockResolvedValue('Task.md') };
    const service = makeService(writer, { refresh: vi.fn(), getSnapshot: () => ({ ...snapshot, entities: [{ ...activeStory, lifecycle: 'epic_backlog', backlogRank: null, sprintId: null, sprintRank: null }] }) }, { render: vi.fn().mockResolvedValue('## Description\n\n## Acceptance Criteria\n') }, () => 'id', () => '2026-09-05T10:00:00Z');
    await service.createTask(activeStory.id, 'Check flow', false, { tags: ['#ux', 'ux'], bodyFields: { Description: 'Small action', 'Acceptance Criteria': '- [ ] Verified' } });
    expect(writer.create.mock.calls[0]![0]).toMatchObject({ tags: ['ux'] });
    expect(writer.create.mock.calls[0]![0].body).toContain('## Description\n\nSmall action');
  });
  it('captures a Candidate with the next global key and rendered body', async () => {
    const writer = {
      create: vi
        .fn()
        .mockResolvedValue('Focus Flow/Inbox/FF-42 Explore calm planning.md'),
    };
    const index = {
      refresh: vi.fn().mockResolvedValue(undefined),
      getSnapshot: vi.fn(() => snapshot),
    };
    const templates = {
      render: vi.fn().mockResolvedValue('# Explore calm planning\n'),
    };
    const service = makeService(
      writer,
      index,
      templates,
      () => '01994770-0000-7000-8000-000000000001',
      () => '2026-08-30T12:00:00.000Z',
      () => ({ mode: 'off', limit: 1 }),
      () => '2026-08-31',
    );

    await expect(
      service.captureCandidate('  Explore calm planning  ', ['#focus', 'weekly', 'focus']),
    ).resolves.toBe('Focus Flow/Inbox/FF-42 Explore calm planning.md');

    expect(templates.render).toHaveBeenCalledWith('candidate', {
      title: 'Explore calm planning',
      key: 'FF-42',
      date: '2026-08-31',
      parentLink: '',
    });
    expect(writer.create).toHaveBeenCalledWith({
      kind: 'candidate',
      id: '01994770-0000-7000-8000-000000000001',
      key: 'FF-42',
      title: 'Explore calm planning',
      createdAt: '2026-08-30T12:00:00.000Z',
      body: '# Explore calm planning\n',
      tags: ['focus', 'weekly'],
    });
    expect(index.refresh).toHaveBeenCalledTimes(2);
  });

  it('promotes an Improvement to Candidate with a Sprint backlink', async () => {
    const writer = {
      create: vi.fn().mockResolvedValue('Focus Flow/Inbox/FF-42 Automate.md'),
    };
    const index = {
      refresh: vi.fn().mockResolvedValue(undefined),
      getSnapshot: vi.fn(() => snapshot),
    };
    const templates = { render: vi.fn().mockResolvedValue('# Automate\n') };
    const service = makeService(
      writer,
      index,
      templates,
      () => '01994770-0000-7000-8000-000000000001',
      () => '2026-08-30T12:00:00.000Z',
    );

    await service.promoteImprovement(
      'Automate the device matrix',
      'SPR-014',
    );

    expect(writer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'candidate',
        title: 'Automate the device matrix',
        body: '# Automate\n\nSource Sprint: [[SPR-014]]\n',
      }),
    );
  });

  it('decomposes a Draft Sprint Story without extra bookkeeping', async () => {
    const storyId = '019946f1-8d2a-7f05-87b1-1eebbb476300';
    const storyPath = 'Focus Flow/Stories/FF-42 Improve weekly focus.md';
    const planningSnapshot: WorkIndexSnapshot = {
      phase: 'ready',
      diagnostics: [],
      entities: [
        ...snapshot.entities,
        {
          id: storyId,
          key: 'FF-42',
          title: 'Improve weekly focus',
          type: 'story',
          lifecycle: 'draft_sprint',
          createdAt: '2026-08-30T09:00:00+04:00',
          tags: [],
          effectiveTags: [],
          path: storyPath,
          epicId: '019946c9-5f97-7196-8483-73469275ff90',
          epicLink: '[[Focus Flow/Epics/FF-40 Build a calmer system]]',
          backlogRank: 'a0',
          sprintId: '01994770-0000-7000-8000-000000000099',
          sprintRank: 'a0',
          acceptanceCriteria: [],
        },
        {
          id: '01994706-857c-76f1-8006-85cd9bd80890',
          key: 'FF-43',
          title: 'Existing Task',
          type: 'task',
          lifecycle: 'active',
          createdAt: '2026-08-30T09:15:00+04:00',
          tags: [],
          effectiveTags: [],
          path: 'Focus Flow/Tasks/FF-43 Existing Task.md',
          storyId,
          storyLink: '[[Focus Flow/Stories/FF-42 Improve weekly focus]]',
          taskRank: 'a0',
          status: 'todo',
          startedAt: null,
          completedAt: null,
        },
      ],
    };
    const writer = {
      create: vi
        .fn()
        .mockResolvedValue('Focus Flow/Tasks/FF-44 Draft review.md'),
    };
    const index = {
      refresh: vi.fn().mockResolvedValue(undefined),
      getSnapshot: vi.fn(() => planningSnapshot),
    };
    const templates = { render: vi.fn().mockResolvedValue('# Draft review\n') };
    const service = makeService(
      writer,
      index,
      templates,
      () => '01994770-0000-7000-8000-000000000002',
      () => '2026-08-30T12:15:00.000Z',
    );

    await expect(service.createTask(storyId, 'Draft review')).resolves.toEqual({
      kind: 'created',
      path: 'Focus Flow/Tasks/FF-44 Draft review.md',
    });

    expect(writer.create).toHaveBeenCalledWith({
      kind: 'task',
      id: '01994770-0000-7000-8000-000000000002',
      key: 'FF-44',
      title: 'Draft review',
      createdAt: '2026-08-30T12:15:00.000Z',
      body: '# Draft review\n',
      storyId,
      storyLink: '[[Focus Flow/Stories/FF-42 Improve weekly focus]]',
      taskRank: 'a1',
    });
  });

  it('refuses to create an orphan Task', async () => {
    const writer = { create: vi.fn() };
    const index = {
      refresh: vi.fn().mockResolvedValue(undefined),
      getSnapshot: vi.fn(() => snapshot),
    };
    const service = makeService(
      writer,
      index,
      { render: vi.fn() },
      () => 'unused',
      () => '2026-08-30T12:15:00.000Z',
    );

    await expect(
      service.createTask('01994770-0000-7000-8000-000000000099', 'Orphan'),
    ).rejects.toThrow('Parent Story was not found.');
    expect(writer.create).not.toHaveBeenCalled();
  });

  it('creates an Active Sprint Task without a reason when Scope WIP allows it', async () => {
    const committedStory: WorkIndexSnapshot['entities'][number] = {
      id: '019946f1-8d2a-7f05-87b1-1eebbb476300',
      key: 'FF-42',
      title: 'Committed Story',
      type: 'story',
      lifecycle: 'active_sprint',
      epicId: '019946c9-5f97-7196-8483-73469275ff90',
      epicLink: '[[Focus Flow/Epics/FF-40 Build a calmer system]]',
      backlogRank: null,
      sprintId: '01994770-0000-7000-8000-000000000099',
      sprintRank: 'a0',
      acceptanceCriteria: [],
      createdAt: '2026-08-30T09:00:00Z',
      tags: [],
      effectiveTags: [],
      path: 'Focus Flow/Stories/FF-42 Committed Story.md',
    };
    const writer = {
      create: vi.fn().mockResolvedValue('Focus Flow/Tasks/FF-43 New scope.md'),
    };
    const activeSprint: WorkIndexSnapshot['entities'][number] = {
      id: '01994770-0000-7000-8000-000000000099',
      type: 'sprint',
      lifecycle: 'active',
      code: 'SPR-014',
      sequence: 14,
      startsOn: '2026-08-24',
      dueOn: '2026-08-30',
      startedAt: '2026-08-24T08:30:00Z',
      closedAt: null,
      provisionalStoryOutcomes: [],
      startSnapshot: { capturedAt: '2026-08-24T08:30:00Z', stories: [] },
      closeSnapshot: null,
      path: 'Focus Flow/Sprints/SPR-014.md',
    };
    const index = {
      refresh: vi.fn().mockResolvedValue(undefined),
      getSnapshot: vi.fn<() => WorkIndexSnapshot>(() => ({
        ...snapshot,
        entities: [activeSprint, committedStory],
      })),
    };
    const service = makeService(
      writer,
      index,
      { render: vi.fn() },
      () => '01994770-0000-7000-8000-000000000002',
      () => '2026-08-30T12:15:00.000Z',
      () => ({ mode: 'off', limit: 1 }),
    );
    await expect(
      service.createTask(committedStory.id, 'New scope'),
    ).resolves.toEqual({
      kind: 'created',
      path: 'Focus Flow/Tasks/FF-43 New scope.md',
    });
    expect(writer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'task',
        id: '01994770-0000-7000-8000-000000000002',
        storyId: committedStory.id,
      }),
    );
  });

  it('requires confirmation for soft Scope WIP and rejects hard excess', async () => {
    const storyId = '019946f1-8d2a-7f05-87b1-1eebbb476300';
    const activeSprintId = '01994770-0000-7000-8000-000000000099';
    const committedStory: WorkIndexSnapshot['entities'][number] = {
      id: storyId,
      key: 'FF-42',
      title: 'Committed Story',
      type: 'story',
      lifecycle: 'active_sprint',
      epicId: '019946c9-5f97-7196-8483-73469275ff90',
      epicLink: '[[Focus Flow/Epics/FF-40 Product]]',
      backlogRank: null,
      sprintId: activeSprintId,
      sprintRank: 'a0',
      acceptanceCriteria: [],
      createdAt: '2026-08-30T09:00:00Z',
      tags: [],
      effectiveTags: [],
      path: 'Focus Flow/Stories/FF-42 Committed Story.md',
    };
    const activeSprint: WorkIndexSnapshot['entities'][number] = {
      id: activeSprintId,
      type: 'sprint',
      lifecycle: 'active',
      code: 'SPR-014',
      sequence: 14,
      startsOn: '2026-08-24',
      dueOn: '2026-08-30',
      startedAt: '2026-08-24T08:30:00Z',
      closedAt: null,
      provisionalStoryOutcomes: [],
      startSnapshot: {
        capturedAt: '2026-08-24T08:30:00Z',
        stories: [
          {
            id: storyId,
            key: 'FF-42',
            title: 'Committed Story',
            epicId: committedStory.epicId,
            sprintRank: 'a0',
            acceptanceCriteriaHash: `sha256:${'a'.repeat(64)}`,
            acceptanceCriteria: [],
            effectiveTags: [],
            tasks: [
              {
                id: '01994706-857c-76f1-8006-85cd9bd80890',
                key: 'FF-43',
                title: 'Committed Task',
                taskRank: 'a0',
                status: 'todo',
                completedBeforeSprint: false,
                effectiveTags: [],
              },
            ],
          },
        ],
      },
      closeSnapshot: null,
      path: 'Focus Flow/Sprints/SPR-014.md',
    };
    const writer = {
      create: vi.fn().mockResolvedValue('Focus Flow/Tasks/FF-44 Added.md'),
    };
    const index = {
      refresh: vi.fn().mockResolvedValue(undefined),
      getSnapshot: vi.fn(() => ({
        ...snapshot,
        entities: [
          activeSprint,
          committedStory,
          {
            id: '01994706-857c-76f1-8006-85cd9bd80890',
            key: 'FF-43',
            title: 'Committed Task',
            type: 'task' as const,
            lifecycle: 'active' as const,
            storyId,
            storyLink: '[[Focus Flow/Stories/FF-42 Committed Story]]',
            taskRank: 'a0',
            status: 'todo' as const,
            startedAt: null,
            completedAt: null,
            createdAt: '2026-08-24T08:00:00Z',
            tags: [],
            effectiveTags: [],
            path: 'Focus Flow/Tasks/FF-43 Committed Task.md',
          },
        ],
      })),
    };
    let mode: 'soft' | 'hard' = 'soft';
    const service = makeService(
      writer,
      index,
      { render: vi.fn().mockResolvedValue('# Added\n') },
      () => '01994770-0000-7000-8000-000000000002',
      () => '2026-08-30T12:15:00.000Z',
      () => ({ mode, limit: 1 }),
    );

    await expect(service.createTask(storyId, 'Added')).resolves.toEqual({
      kind: 'confirmation-required',
      excess: 1,
      message: 'Sprint scope exceeds its WIP limit by 1.',
    });
    expect(writer.create).not.toHaveBeenCalled();

    await expect(service.createTask(storyId, 'Added', true)).resolves.toEqual({
      kind: 'created',
      path: 'Focus Flow/Tasks/FF-44 Added.md',
    });

    mode = 'hard';
    await expect(service.createTask(storyId, 'Blocked')).resolves.toEqual({
      kind: 'rejected',
      message: 'Sprint scope has a hard WIP limit of 1.',
    });
  });
});
