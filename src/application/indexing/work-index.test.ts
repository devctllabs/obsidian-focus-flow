import { describe, expect, it, vi } from 'vitest';
import { buildWorkIndexSnapshot, WorkIndex } from './work-index';

const candidateSource = {
  path: 'Focus Flow/Inbox/FF-41 Explore weekly focus.md',
  frontmatter: {
    focus_flow: {
      schema_version: 1,
      id: '019946e9-0ef0-7ca3-af0c-ec423d76efed',
      key: 'FF-41',
      type: 'candidate',
      lifecycle: 'inbox',
      created_at: '2026-08-30T08:45:00+04:00',
    },
  },
  body: 'A valid candidate.',
};

it('projects canonical authoring fields without unrelated Markdown', () => {
  const snapshot = buildWorkIndexSnapshot([{ ...candidateSource, body: '## Description\n\nA **thought**\n\n## Entry Review\n\nWANT\n\n## Acceptance Criteria\n\n- [ ] Visible result\n\n## Notes\n\nPrivate context' }]);
  expect(snapshot.entities[0]).toMatchObject({ bodyFields: { Description: 'A **thought**', 'Entry Review': 'WANT', 'Acceptance Criteria': '- [ ] Visible result' } });
});

it('rejects a repeated typed folder nested below the workspace root', () => {
  const source = { ...candidateSource, path: 'Focus Flow/Inbox/Other/Inbox/FF-41 Explore weekly focus.md' };
  const snapshot = buildWorkIndexSnapshot([source], { path: 'Focus Flow/MISSION.md', body: 'Focus intentionally.' });
  expect(snapshot.diagnostics).toContainEqual(expect.objectContaining({ code: 'wrong-folder', path: source.path }));
});

const taggedEpicSource = {
  path: 'Focus Flow/Epics/FF-40 Build a calmer system.md',
  frontmatter: {
    focus_flow: {
      schema_version: 1,
      id: '019946c9-5f97-7196-8483-73469275ff90',
      key: 'FF-40',
      type: 'epic',
      lifecycle: 'backlog',
      backlog_rank: 'a0',
      created_at: '2026-08-30T08:30:00+04:00',
    },
    tags: ['area/work', 'shared'],
  },
  body: '',
};

const taggedStorySource = {
  path: 'Focus Flow/Stories/FF-42 Improve weekly focus.md',
  frontmatter: {
    focus_flow: {
      schema_version: 1,
      id: '019946f1-8d2a-7f05-87b1-1eebbb476300',
      key: 'FF-42',
      type: 'story',
      lifecycle: 'backlog',
      epic_id: taggedEpicSource.frontmatter.focus_flow.id,
      epic_link: '[[Focus Flow/Epics/FF-40 Build a calmer system]]',
      backlog_rank: 'a0',
      created_at: '2026-08-30T09:00:00+04:00',
    },
    tags: ['shared', 'outcome/weekly'],
  },
  body: '',
};

const taggedTaskSource = {
  path: 'Focus Flow/Tasks/FF-43 Prepare weekly focus.md',
  frontmatter: {
    focus_flow: {
      schema_version: 1,
      id: '01994706-857c-76f1-8006-85cd9bd80890',
      key: 'FF-43',
      type: 'task',
      lifecycle: 'active',
      story_id: taggedStorySource.frontmatter.focus_flow.id,
      story_link: '[[Focus Flow/Stories/FF-42 Improve weekly focus]]',
      task_rank: 'a0',
      status: 'todo',
      created_at: '2026-08-30T09:15:00+04:00',
    },
    tags: ['next/action'],
  },
  body: '',
};

describe('buildWorkIndexSnapshot', () => {
  it('indexes an empty managed root as a ready empty snapshot', () => {
    expect(buildWorkIndexSnapshot([])).toEqual({
      phase: 'ready',
      entities: [],
      diagnostics: [],
    });
  });

  it('projects stable Effective Tags through the valid hierarchy', () => {
    const snapshot = buildWorkIndexSnapshot([
      taggedEpicSource,
      taggedStorySource,
      taggedTaskSource,
    ]);

    expect(snapshot.entities).toMatchObject([
      {
        type: 'epic',
        effectiveTags: ['area/work', 'shared'],
      },
      {
        type: 'story',
        effectiveTags: ['area/work', 'shared', 'outcome/weekly'],
      },
      {
        type: 'task',
        effectiveTags: [
          'area/work',
          'shared',
          'outcome/weekly',
          'next/action',
        ],
      },
    ]);
    expect(snapshot.diagnostics).toEqual([]);
  });

  it('keeps a Story visible while reporting its terminal Epic parent', () => {
    const terminalEpic = {
      ...taggedEpicSource,
      frontmatter: {
        ...taggedEpicSource.frontmatter,
        focus_flow: {
          ...taggedEpicSource.frontmatter.focus_flow,
          lifecycle: 'done',
          backlog_rank: undefined,
          completed_at: '2026-09-01T12:00:00Z',
        },
      },
    };

    const snapshot = buildWorkIndexSnapshot([terminalEpic, taggedStorySource]);

    expect(snapshot.entities).toHaveLength(2);
    expect(snapshot.diagnostics).toContainEqual({
      code: 'terminal-parent',
      severity: 'error',
      message: 'Story parent Epic FF-40 is terminal.',
      path: taggedStorySource.path,
    });
  });

  it('indexes a valid Draft Sprint alongside work entities', () => {
    const draftSprint = {
      path: 'Focus Flow/Sprints/DRAFT.md',
      frontmatter: {
        focus_flow: {
          schema_version: 1,
          id: '01994744-a401-759a-b582-4418f2f2405f',
          type: 'sprint',
          lifecycle: 'draft',
        },
      },
      body: '# Draft Sprint',
    };

    const snapshot = buildWorkIndexSnapshot([candidateSource, draftSprint]);

    expect(snapshot.entities).toMatchObject([
      { key: 'FF-41', type: 'candidate' },
      { type: 'sprint', lifecycle: 'draft' },
    ]);
    expect(snapshot.diagnostics).toEqual([]);
  });

  it('reports every open Sprint when the single-open invariant is broken', () => {
    const firstDraft = {
      path: 'Focus Flow/Sprints/DRAFT.md',
      frontmatter: {
        focus_flow: {
          schema_version: 1,
          id: '01994744-a401-759a-b582-4418f2f2405f',
          type: 'sprint',
          lifecycle: 'draft',
        },
      },
      body: '# Draft Sprint',
    };
    const secondDraft = {
      ...firstDraft,
      path: 'Archive/Sprints/DRAFT.md',
      frontmatter: {
        focus_flow: {
          ...firstDraft.frontmatter.focus_flow,
          id: '01994744-a401-759a-b582-4418f2f24050',
        },
      },
    };

    const snapshot = buildWorkIndexSnapshot([firstDraft, secondDraft]);

    expect(snapshot.diagnostics).toEqual([
      {
        code: 'multiple-open-sprints',
        message: 'Only one Draft or Active Sprint may exist.',
        path: firstDraft.path,
      },
      {
        code: 'multiple-open-sprints',
        message: 'Only one Draft or Active Sprint may exist.',
        path: secondDraft.path,
      },
    ]);
  });

  it('keeps valid entities while reporting malformed managed notes', () => {
    const snapshot = buildWorkIndexSnapshot([
      candidateSource,
      {
        path: 'Focus Flow/Tasks/FF-43 Broken task.md',
        frontmatter: {
          focus_flow: {
            schema_version: 1,
            id: '01994706-857c-76f1-8006-85cd9bd80890',
            key: 'FF-43',
            type: 'task',
          },
        },
        body: 'The user content must remain visible outside the index.',
      },
    ]);

    expect(snapshot.phase).toBe('ready');
    expect(snapshot.entities).toMatchObject([
      { key: 'FF-41', type: 'candidate', lifecycle: 'inbox' },
    ]);
    expect(snapshot.diagnostics).toMatchObject([
      {
        code: 'invalid-managed-data',
        path: 'Focus Flow/Tasks/FF-43 Broken task.md',
      },
    ]);
  });

  it('keeps Tasks visible while warning about missing transition timestamps', () => {
    const inProgress = {
      ...taggedTaskSource,
      frontmatter: {
        ...taggedTaskSource.frontmatter,
        focus_flow: {
          ...taggedTaskSource.frontmatter.focus_flow,
          status: 'in_progress',
          started_at: null,
        },
      },
    };
    const done = {
      ...taggedTaskSource,
      path: 'Focus Flow/Tasks/FF-44 Finish weekly focus.md',
      frontmatter: {
        ...taggedTaskSource.frontmatter,
        focus_flow: {
          ...taggedTaskSource.frontmatter.focus_flow,
          id: '01994706-857c-76f1-8006-85cd9bd80891',
          key: 'FF-44',
          lifecycle: 'done',
          status: 'done',
          task_rank: 'a1',
          started_at: '2026-08-30T10:00:00+04:00',
          completed_at: null,
        },
      },
    };
    const externalInProgress = {
      ...taggedTaskSource,
      path: 'Focus Flow/Tasks/FF-45 Wait for review.md',
      frontmatter: {
        ...taggedTaskSource.frontmatter,
        focus_flow: {
          ...taggedTaskSource.frontmatter.focus_flow,
          id: '01994706-857c-76f1-8006-85cd9bd80892',
          key: 'FF-45',
          status: 'external_in_progress',
          task_rank: 'a2',
          started_at: null,
        },
      },
    };

    const snapshot = buildWorkIndexSnapshot([
      taggedEpicSource,
      taggedStorySource,
      inProgress,
      done,
      externalInProgress,
    ]);

    expect(snapshot.entities.filter(({ type }) => type === 'task')).toHaveLength(3);
    expect(snapshot.diagnostics).toEqual([
      {
        code: 'missing-transition-timestamp',
        severity: 'warning',
        message: 'In Progress Task is missing started_at.',
        path: inProgress.path,
      },
      {
        code: 'missing-transition-timestamp',
        severity: 'warning',
        message: 'Done Task is missing completed_at.',
        path: done.path,
      },
      { code: 'wrong-folder', path: done.path, message: 'A valid terminal timestamp is required before organizing this note. Fix completed_at or closed_at first.' },
      {
        code: 'missing-transition-timestamp',
        severity: 'warning',
        message: 'External In Progress Task is missing started_at.',
        path: externalInProgress.path,
      },
    ]);
  });

  it('reports every note that shares a UUID without dropping either entity', () => {
    const duplicateIdSource = {
      ...candidateSource,
      path: 'Focus Flow/Inbox/FF-42 Explore daily focus.md',
      frontmatter: {
        focus_flow: {
          ...candidateSource.frontmatter.focus_flow,
          key: 'FF-42',
        },
      },
    };

    const snapshot = buildWorkIndexSnapshot([
      duplicateIdSource,
      candidateSource,
    ]);

    expect(snapshot.entities).toHaveLength(2);
    expect(snapshot.diagnostics).toEqual([
      {
        code: 'duplicate-id',
        message:
          'UUID 019946e9-0ef0-7ca3-af0c-ec423d76efed is used by multiple notes.',
        path: duplicateIdSource.path,
        repair: {
          kind: 'repair-duplicate-ids',
          entries: [
            {
              path: duplicateIdSource.path,
              expectedId: '019946e9-0ef0-7ca3-af0c-ec423d76efed',
            },
          ],
          references: [],
        },
      },
      {
        code: 'duplicate-id',
        message:
          'UUID 019946e9-0ef0-7ca3-af0c-ec423d76efed is used by multiple notes.',
        path: candidateSource.path,
      },
    ]);
  });

  it('plans a parent reference update when its link identifies the duplicate UUID owner', () => {
    const sharedId = '019946c9-5f97-7196-8483-73469275ff90';
    const firstEpic = {
      ...taggedEpicSource,
      path: 'Focus Flow/Epics/FF-40 Build a calmer system.md',
    };
    const secondEpic = {
      ...taggedEpicSource,
      path: 'Focus Flow/Epics/FF-41 Make reviews repeatable.md',
      frontmatter: {
        ...taggedEpicSource.frontmatter,
        focus_flow: {
          ...taggedEpicSource.frontmatter.focus_flow,
          key: 'FF-41',
          backlog_rank: 'a1',
        },
      },
    };
    const childStory = {
      ...taggedStorySource,
      frontmatter: {
        ...taggedStorySource.frontmatter,
        focus_flow: {
          ...taggedStorySource.frontmatter.focus_flow,
          epic_id: sharedId,
          epic_link:
            '[[Focus Flow/Epics/FF-41 Make reviews repeatable]]',
        },
      },
    };

    const snapshot = buildWorkIndexSnapshot([
      firstEpic,
      secondEpic,
      childStory,
    ]);

    expect(snapshot.diagnostics.filter(({ code }) => code === 'duplicate-id'))
      .toEqual([
        {
          code: 'duplicate-id',
          message: `UUID ${sharedId} is used by multiple notes.`,
          path: firstEpic.path,
        },
        {
          code: 'duplicate-id',
          message: `UUID ${sharedId} is used by multiple notes.`,
          path: secondEpic.path,
          repair: {
            kind: 'repair-duplicate-ids',
            entries: [{ path: secondEpic.path, expectedId: sharedId }],
            references: [
              {
                path: childStory.path,
                field: 'epic_id',
                expectedId: sharedId,
                replacementForPath: secondEpic.path,
              },
            ],
          },
        },
      ]);
  });

  it('leaves a duplicate UUID read-only when a parent reference is ambiguous', () => {
    const sharedId = taggedEpicSource.frontmatter.focus_flow.id;
    const secondEpic = {
      ...taggedEpicSource,
      path: 'Focus Flow/Epics/FF-41 Make reviews repeatable.md',
      frontmatter: {
        ...taggedEpicSource.frontmatter,
        focus_flow: {
          ...taggedEpicSource.frontmatter.focus_flow,
          key: 'FF-41',
          backlog_rank: 'a1',
        },
      },
    };
    const childStory = {
      ...taggedStorySource,
      frontmatter: {
        ...taggedStorySource.frontmatter,
        focus_flow: {
          ...taggedStorySource.frontmatter.focus_flow,
          epic_id: sharedId,
          epic_link: '[[FF-99 Unknown owner]]',
        },
      },
    };

    const snapshot = buildWorkIndexSnapshot([
      taggedEpicSource,
      secondEpic,
      childStory,
    ]);

    expect(
      snapshot.diagnostics.filter(({ code }) => code === 'duplicate-id'),
    ).toEqual([
      {
        code: 'duplicate-id',
        message: `UUID ${sharedId} is used by multiple notes.`,
        path: taggedEpicSource.path,
      },
      {
        code: 'duplicate-id',
        message: `UUID ${sharedId} is used by multiple notes.`,
        path: secondEpic.path,
      },
    ]);
  });

  it('reports every note that shares a Focus Flow key', () => {
    const duplicateKeySource = {
      ...candidateSource,
      path: 'Focus Flow/Inbox/FF-41 Explore daily focus.md',
      frontmatter: {
        focus_flow: {
          ...candidateSource.frontmatter.focus_flow,
          id: '01994706-857c-76f1-8006-85cd9bd80890',
        },
      },
    };

    const snapshot = buildWorkIndexSnapshot([
      duplicateKeySource,
      candidateSource,
    ]);

    expect(snapshot.entities).toHaveLength(2);
    expect(snapshot.diagnostics).toEqual([
      {
        code: 'duplicate-key',
        message: 'Key FF-41 is used by multiple notes.',
        path: duplicateKeySource.path,
        repair: {
          kind: 'repair-duplicate-keys',
          entries: [
            {
              path: duplicateKeySource.path,
              id: '01994706-857c-76f1-8006-85cd9bd80890',
              expectedKey: 'FF-41',
              replacementKey: 'FF-42',
              replacementPath:
                'Focus Flow/Inbox/FF-42 Explore daily focus.md',
            },
          ],
          links: [],
        },
      },
      {
        code: 'duplicate-key',
        message: 'Key FF-41 is used by multiple notes.',
        path: candidateSource.path,
      },
    ]);
  });

  it('plans derived parent-link updates when a parent key changes', () => {
    const firstEpic = {
      path: 'Focus Flow/Epics/FF-40 Build a calmer system.md',
      frontmatter: {
        focus_flow: {
          schema_version: 1,
          id: '019946c9-5f97-7196-8483-73469275ff90',
          key: 'FF-40',
          type: 'epic',
          lifecycle: 'backlog',
          backlog_rank: 'a0',
          created_at: '2026-08-30T08:30:00+04:00',
        },
      },
      body: '',
    };
    const secondEpic = {
      path: 'Focus Flow/Epics/FF-40 Make reviews repeatable.md',
      frontmatter: {
        focus_flow: {
          ...firstEpic.frontmatter.focus_flow,
          id: '01994710-0000-7000-8000-000000000001',
          backlog_rank: 'a1',
        },
      },
      body: '',
    };
    const childStory = {
      path: 'Focus Flow/Stories/FF-42 Improve personal reviews.md',
      frontmatter: {
        focus_flow: {
          schema_version: 1,
          id: '01994720-0000-7000-8000-000000000001',
          key: 'FF-42',
          type: 'story',
          lifecycle: 'backlog',
          epic_id: secondEpic.frontmatter.focus_flow.id,
          epic_link: '[[Focus Flow/Epics/FF-40 Make reviews repeatable]]',
          backlog_rank: 'a0',
          created_at: '2026-08-30T09:30:00+04:00',
        },
      },
      body: '',
    };

    const snapshot = buildWorkIndexSnapshot([
      firstEpic,
      secondEpic,
      childStory,
    ]);

    expect(snapshot.diagnostics).toEqual([
      {
        code: 'duplicate-key',
        message: 'Key FF-40 is used by multiple notes.',
        path: firstEpic.path,
      },
      {
        code: 'duplicate-key',
        message: 'Key FF-40 is used by multiple notes.',
        path: secondEpic.path,
        repair: {
          kind: 'repair-duplicate-keys',
          entries: [
            {
              path: secondEpic.path,
              id: secondEpic.frontmatter.focus_flow.id,
              expectedKey: 'FF-40',
              replacementKey: 'FF-43',
              replacementPath:
                'Focus Flow/Epics/FF-43 Make reviews repeatable.md',
            },
          ],
          links: [
            {
              path: childStory.path,
              parentId: secondEpic.frontmatter.focus_flow.id,
              field: 'epic_link',
              expectedValue:
                '[[Focus Flow/Epics/FF-40 Make reviews repeatable]]',
              replacementValue:
                '[[Focus Flow/Epics/FF-43 Make reviews repeatable]]',
            },
          ],
        },
      },
    ]);
  });

  it('does not offer key repair while the colliding UUID is ambiguous', () => {
    const copiedSource = {
      ...candidateSource,
      path: 'Focus Flow/Inbox/FF-41 Explore daily focus.md',
    };

    const snapshot = buildWorkIndexSnapshot([candidateSource, copiedSource]);

    expect(snapshot.diagnostics).toEqual([
      {
        code: 'duplicate-id',
        message:
          'UUID 019946e9-0ef0-7ca3-af0c-ec423d76efed is used by multiple notes.',
        path: candidateSource.path,
        repair: {
          kind: 'repair-duplicate-ids',
          entries: [
            {
              path: candidateSource.path,
              expectedId: '019946e9-0ef0-7ca3-af0c-ec423d76efed',
            },
          ],
          references: [],
        },
      },
      {
        code: 'duplicate-id',
        message:
          'UUID 019946e9-0ef0-7ca3-af0c-ec423d76efed is used by multiple notes.',
        path: copiedSource.path,
      },
      {
        code: 'duplicate-key',
        message: 'Key FF-41 is used by multiple notes.',
        path: candidateSource.path,
      },
      {
        code: 'duplicate-key',
        message: 'Key FF-41 is used by multiple notes.',
        path: copiedSource.path,
      },
    ]);
  });

  it('reports a Story whose parent Epic is absent', () => {
    const storySource = {
      path: 'Focus Flow/Stories/FF-42 Improve weekly focus.md',
      frontmatter: {
        focus_flow: {
          schema_version: 1,
          id: '019946f1-8d2a-7f05-87b1-1eebbb476300',
          key: 'FF-42',
          type: 'story',
          lifecycle: 'backlog',
          created_at: '2026-08-30T09:00:00+04:00',
          epic_id: '019946c9-5f97-7196-8483-73469275ff90',
          epic_link: '[[FF-40 Build a calmer system]]',
          backlog_rank: 'a0',
        },
      },
      body: '',
    };

    const snapshot = buildWorkIndexSnapshot([storySource]);

    expect(snapshot.entities).toHaveLength(1);
    expect(snapshot.diagnostics).toEqual([
      {
        code: 'missing-parent',
        message:
          'Parent Epic 019946c9-5f97-7196-8483-73469275ff90 was not found.',
        path: storySource.path,
      },
    ]);
  });

  it('reports a Task whose parent Story is absent', () => {
    const taskSource = {
      path: 'Focus Flow/Tasks/FF-43 Prepare weekly focus.md',
      frontmatter: {
        focus_flow: {
          schema_version: 1,
          id: '01994706-857c-76f1-8006-85cd9bd80890',
          key: 'FF-43',
          type: 'task',
          lifecycle: 'active',
          created_at: '2026-08-30T09:15:00+04:00',
          story_id: '019946f1-8d2a-7f05-87b1-1eebbb476300',
          story_link: '[[FF-42 Improve weekly focus]]',
          task_rank: 'a0',
          status: 'todo',
        },
      },
      body: '',
    };

    const snapshot = buildWorkIndexSnapshot([taskSource]);

    expect(snapshot.entities).toHaveLength(1);
    expect(snapshot.diagnostics).toEqual([
      {
        code: 'missing-parent',
        message:
          'Parent Story 019946f1-8d2a-7f05-87b1-1eebbb476300 was not found.',
        path: taskSource.path,
      },
    ]);
  });

  it('reports an Inbox Candidate stored outside the Inbox folder', () => {
    const misplacedSource = {
      ...candidateSource,
      path: 'Focus Flow/Tasks/FF-41 Explore weekly focus.md',
    };

    const snapshot = buildWorkIndexSnapshot([misplacedSource]);

    expect(snapshot.entities).toHaveLength(1);
    expect(snapshot.diagnostics).toEqual([
      {
        code: 'wrong-folder',
        message: 'Candidate notes with lifecycle inbox belong in Inbox.',
        path: misplacedSource.path,
        repair: {
          kind: 'move-note',
          path: misplacedSource.path,
          id: candidateSource.frontmatter.focus_flow.id,
          targetFolder: 'Inbox',
        },
      },
    ]);
  });

  it('reports Epic, Story, and Task notes stored outside their type folders', () => {
    const epicSource = {
      path: 'Focus Flow/Tasks/FF-40 Build a calmer system.md',
      frontmatter: {
        focus_flow: {
          schema_version: 1,
          id: '019946c9-5f97-7196-8483-73469275ff90',
          key: 'FF-40',
          type: 'epic',
          lifecycle: 'backlog',
          created_at: '2026-08-30T08:30:00+04:00',
          backlog_rank: 'a0',
        },
      },
      body: '',
    };
    const storySource = {
      path: 'Focus Flow/Epics/FF-42 Improve weekly focus.md',
      frontmatter: {
        focus_flow: {
          schema_version: 1,
          id: '019946f1-8d2a-7f05-87b1-1eebbb476300',
          key: 'FF-42',
          type: 'story',
          lifecycle: 'backlog',
          created_at: '2026-08-30T09:00:00+04:00',
          epic_id: '019946c9-5f97-7196-8483-73469275ff90',
          epic_link: '[[FF-40 Build a calmer system]]',
          backlog_rank: 'a0',
        },
      },
      body: '',
    };
    const taskSource = {
      path: 'Focus Flow/Stories/FF-43 Prepare weekly focus.md',
      frontmatter: {
        focus_flow: {
          schema_version: 1,
          id: '01994706-857c-76f1-8006-85cd9bd80890',
          key: 'FF-43',
          type: 'task',
          lifecycle: 'active',
          created_at: '2026-08-30T09:15:00+04:00',
          story_id: '019946f1-8d2a-7f05-87b1-1eebbb476300',
          story_link: '[[FF-42 Improve weekly focus]]',
          task_rank: 'a0',
          status: 'todo',
        },
      },
      body: '',
    };

    const snapshot = buildWorkIndexSnapshot([
      epicSource,
      storySource,
      taskSource,
    ]);

    expect(snapshot.entities).toHaveLength(3);
    expect(snapshot.diagnostics).toEqual([
      {
        code: 'wrong-folder',
        message: 'Epic notes belong in Epics.',
        path: epicSource.path,
        repair: {
          kind: 'move-note',
          path: epicSource.path,
          id: epicSource.frontmatter.focus_flow.id,
          targetFolder: 'Epics',
        },
      },
      {
        code: 'wrong-folder',
        message: 'Story notes belong in Stories.',
        path: storySource.path,
        repair: {
          kind: 'move-note',
          path: storySource.path,
          id: storySource.frontmatter.focus_flow.id,
          targetFolder: 'Stories',
        },
      },
      {
        code: 'wrong-folder',
        message: 'Task notes belong in Tasks.',
        path: taskSource.path,
        repair: {
          kind: 'move-note',
          path: taskSource.path,
          id: taskSource.frontmatter.focus_flow.id,
          targetFolder: 'Tasks',
        },
      },
    ]);
  });

  it('reports every backlog Epic that shares a rank in the Epic Backlog', () => {
    const firstEpic = {
      path: 'Focus Flow/Epics/FF-40 Build a calmer system.md',
      frontmatter: {
        focus_flow: {
          schema_version: 1,
          id: '019946c9-5f97-7196-8483-73469275ff90',
          key: 'FF-40',
          type: 'epic',
          lifecycle: 'backlog',
          created_at: '2026-08-30T08:30:00+04:00',
          backlog_rank: 'a0',
        },
      },
      body: '',
    };
    const secondEpic = {
      path: 'Focus Flow/Epics/FF-44 Improve personal reviews.md',
      frontmatter: {
        focus_flow: {
          ...firstEpic.frontmatter.focus_flow,
          id: '01994710-0000-7000-8000-000000000001',
          key: 'FF-44',
        },
      },
      body: '',
    };

    const snapshot = buildWorkIndexSnapshot([secondEpic, firstEpic]);

    expect(snapshot.entities).toHaveLength(2);
    expect(snapshot.diagnostics).toEqual([
      {
        code: 'duplicate-rank',
        message: 'Rank a0 is duplicated in the Epic Backlog.',
        path: secondEpic.path,
        repair: {
          kind: 'rebalance-ranks',
          collectionLabel: 'the Epic Backlog',
          entries: [
            {
              path: firstEpic.path,
              id: '019946c9-5f97-7196-8483-73469275ff90',
              field: 'backlog_rank',
              expectedValue: 'a0',
              replacementValue: 'a0',
            },
            {
              path: secondEpic.path,
              id: '01994710-0000-7000-8000-000000000001',
              field: 'backlog_rank',
              expectedValue: 'a0',
              replacementValue: 'a1',
            },
          ],
        },
      },
      {
        code: 'duplicate-rank',
        message: 'Rank a0 is duplicated in the Epic Backlog.',
        path: firstEpic.path,
      },
    ]);
  });

  it('reports every backlog Story that shares a rank in the Month Backlog', () => {
    const epic = {
      path: 'Focus Flow/Epics/FF-40 Build a calmer system.md',
      frontmatter: {
        focus_flow: {
          schema_version: 1,
          id: '019946c9-5f97-7196-8483-73469275ff90',
          key: 'FF-40',
          type: 'epic',
          lifecycle: 'backlog',
          created_at: '2026-08-30T08:30:00+04:00',
          backlog_rank: 'a0',
        },
      },
      body: '',
    };
    const firstStory = {
      path: 'Focus Flow/Stories/FF-42 Improve weekly focus.md',
      frontmatter: {
        focus_flow: {
          schema_version: 1,
          id: '019946f1-8d2a-7f05-87b1-1eebbb476300',
          key: 'FF-42',
          type: 'story',
          lifecycle: 'backlog',
          created_at: '2026-08-30T09:00:00+04:00',
          epic_id: '019946c9-5f97-7196-8483-73469275ff90',
          epic_link: '[[FF-40 Build a calmer system]]',
          backlog_rank: 'a0',
        },
      },
      body: '',
    };
    const secondStory = {
      path: 'Focus Flow/Stories/FF-45 Make reviews repeatable.md',
      frontmatter: {
        focus_flow: {
          ...firstStory.frontmatter.focus_flow,
          id: '01994710-0000-7000-8000-000000000002',
          key: 'FF-45',
        },
      },
      body: '',
    };

    const snapshot = buildWorkIndexSnapshot([
      epic,
      firstStory,
      secondStory,
    ]);

    expect(snapshot.diagnostics).toEqual([
      {
        code: 'duplicate-rank',
        message: 'Rank a0 is duplicated in the Month Backlog.',
        path: firstStory.path,
        repair: {
          kind: 'rebalance-ranks',
          collectionLabel: 'the Month Backlog',
          entries: [
            {
              path: firstStory.path,
              id: '019946f1-8d2a-7f05-87b1-1eebbb476300',
              field: 'backlog_rank',
              expectedValue: 'a0',
              replacementValue: 'a0',
            },
            {
              path: secondStory.path,
              id: '01994710-0000-7000-8000-000000000002',
              field: 'backlog_rank',
              expectedValue: 'a0',
              replacementValue: 'a1',
            },
          ],
        },
      },
      {
        code: 'duplicate-rank',
        message: 'Rank a0 is duplicated in the Month Backlog.',
        path: secondStory.path,
      },
    ]);
  });

  it('reports every Story that shares a rank in the same Sprint', () => {
    const epic = {
      path: 'Focus Flow/Epics/FF-40 Build a calmer system.md',
      frontmatter: {
        focus_flow: {
          schema_version: 1,
          id: '019946c9-5f97-7196-8483-73469275ff90',
          key: 'FF-40',
          type: 'epic',
          lifecycle: 'backlog',
          created_at: '2026-08-30T08:30:00+04:00',
          backlog_rank: 'a0',
        },
      },
      body: '',
    };
    const firstStory = {
      path: 'Focus Flow/Stories/FF-42 Improve weekly focus.md',
      frontmatter: {
        focus_flow: {
          schema_version: 1,
          id: '019946f1-8d2a-7f05-87b1-1eebbb476300',
          key: 'FF-42',
          type: 'story',
          lifecycle: 'active_sprint',
          created_at: '2026-08-30T09:00:00+04:00',
          epic_id: '019946c9-5f97-7196-8483-73469275ff90',
          epic_link: '[[FF-40 Build a calmer system]]',
          sprint_id: '01994744-a401-759a-b582-4418f2f2405f',
          sprint_rank: 'a0',
        },
      },
      body: '',
    };
    const secondStory = {
      path: 'Focus Flow/Stories/FF-45 Make reviews repeatable.md',
      frontmatter: {
        focus_flow: {
          ...firstStory.frontmatter.focus_flow,
          id: '01994710-0000-7000-8000-000000000002',
          key: 'FF-45',
        },
      },
      body: '',
    };

    const snapshot = buildWorkIndexSnapshot([
      epic,
      firstStory,
      secondStory,
    ]);

    expect(snapshot.diagnostics).toEqual([
      {
        code: 'duplicate-rank',
        message:
          'Rank a0 is duplicated in Sprint 01994744-a401-759a-b582-4418f2f2405f.',
        path: firstStory.path,
        repair: {
          kind: 'rebalance-ranks',
          collectionLabel:
            'Sprint 01994744-a401-759a-b582-4418f2f2405f',
          entries: [
            {
              path: firstStory.path,
              id: '019946f1-8d2a-7f05-87b1-1eebbb476300',
              field: 'sprint_rank',
              expectedValue: 'a0',
              replacementValue: 'a0',
            },
            {
              path: secondStory.path,
              id: '01994710-0000-7000-8000-000000000002',
              field: 'sprint_rank',
              expectedValue: 'a0',
              replacementValue: 'a1',
            },
          ],
        },
      },
      {
        code: 'duplicate-rank',
        message:
          'Rank a0 is duplicated in Sprint 01994744-a401-759a-b582-4418f2f2405f.',
        path: secondStory.path,
      },
    ]);
  });

  it('allows the same Story rank in different Sprints', () => {
    const epic = {
      path: 'Focus Flow/Epics/FF-40 Build a calmer system.md',
      frontmatter: {
        focus_flow: {
          schema_version: 1,
          id: '019946c9-5f97-7196-8483-73469275ff90',
          key: 'FF-40',
          type: 'epic',
          lifecycle: 'backlog',
          created_at: '2026-08-30T08:30:00+04:00',
          backlog_rank: 'a0',
        },
      },
      body: '',
    };
    const firstStory = {
      path: 'Focus Flow/Stories/FF-42 Improve weekly focus.md',
      frontmatter: {
        focus_flow: {
          schema_version: 1,
          id: '019946f1-8d2a-7f05-87b1-1eebbb476300',
          key: 'FF-42',
          type: 'story',
          lifecycle: 'active_sprint',
          created_at: '2026-08-30T09:00:00+04:00',
          epic_id: '019946c9-5f97-7196-8483-73469275ff90',
          epic_link: '[[FF-40 Build a calmer system]]',
          sprint_id: '01994744-a401-759a-b582-4418f2f2405f',
          sprint_rank: 'a0',
        },
      },
      body: '',
    };
    const secondStory = {
      path: 'Focus Flow/Stories/FF-45 Make reviews repeatable.md',
      frontmatter: {
        focus_flow: {
          ...firstStory.frontmatter.focus_flow,
          id: '01994710-0000-7000-8000-000000000002',
          key: 'FF-45',
          sprint_id: '01994744-a401-759a-b582-4418f2f24060',
        },
      },
      body: '',
    };

    const snapshot = buildWorkIndexSnapshot([
      epic,
      firstStory,
      secondStory,
    ]);

    expect(snapshot.diagnostics).toEqual([]);
  });

  it('reports every Task that shares a rank under the same Story', () => {
    const epic = {
      path: 'Focus Flow/Epics/FF-40 Build a calmer system.md',
      frontmatter: {
        focus_flow: {
          schema_version: 1,
          id: '019946c9-5f97-7196-8483-73469275ff90',
          key: 'FF-40',
          type: 'epic',
          lifecycle: 'backlog',
          created_at: '2026-08-30T08:30:00+04:00',
          backlog_rank: 'a0',
        },
      },
      body: '',
    };
    const story = {
      path: 'Focus Flow/Stories/FF-42 Improve weekly focus.md',
      frontmatter: {
        focus_flow: {
          schema_version: 1,
          id: '019946f1-8d2a-7f05-87b1-1eebbb476300',
          key: 'FF-42',
          type: 'story',
          lifecycle: 'backlog',
          created_at: '2026-08-30T09:00:00+04:00',
          epic_id: '019946c9-5f97-7196-8483-73469275ff90',
          epic_link: '[[FF-40 Build a calmer system]]',
          backlog_rank: 'a0',
        },
      },
      body: '',
    };
    const firstTask = {
      path: 'Focus Flow/Tasks/FF-43 Prepare weekly focus.md',
      frontmatter: {
        focus_flow: {
          schema_version: 1,
          id: '01994706-857c-76f1-8006-85cd9bd80890',
          key: 'FF-43',
          type: 'task',
          lifecycle: 'active',
          created_at: '2026-08-30T09:15:00+04:00',
          story_id: '019946f1-8d2a-7f05-87b1-1eebbb476300',
          story_link: '[[FF-42 Improve weekly focus]]',
          task_rank: 'a0',
          status: 'todo',
        },
      },
      body: '',
    };
    const secondTask = {
      path: 'Focus Flow/Tasks/FF-46 Write the review checklist.md',
      frontmatter: {
        focus_flow: {
          ...firstTask.frontmatter.focus_flow,
          id: '01994710-0000-7000-8000-000000000003',
          key: 'FF-46',
        },
      },
      body: '',
    };

    const snapshot = buildWorkIndexSnapshot([
      epic,
      story,
      firstTask,
      secondTask,
    ]);

    expect(snapshot.diagnostics).toEqual([
      {
        code: 'duplicate-rank',
        message:
          'Rank a0 is duplicated in Tasks of Story 019946f1-8d2a-7f05-87b1-1eebbb476300.',
        path: firstTask.path,
        repair: {
          kind: 'rebalance-ranks',
          collectionLabel:
            'Tasks of Story 019946f1-8d2a-7f05-87b1-1eebbb476300',
          entries: [
            {
              path: firstTask.path,
              id: '01994706-857c-76f1-8006-85cd9bd80890',
              field: 'task_rank',
              expectedValue: 'a0',
              replacementValue: 'a0',
            },
            {
              path: secondTask.path,
              id: '01994710-0000-7000-8000-000000000003',
              field: 'task_rank',
              expectedValue: 'a0',
              replacementValue: 'a1',
            },
          ],
        },
      },
      {
        code: 'duplicate-rank',
        message:
          'Rank a0 is duplicated in Tasks of Story 019946f1-8d2a-7f05-87b1-1eebbb476300.',
        path: secondTask.path,
      },
    ]);
  });

  it('allows the same Task rank under different Stories', () => {
    const epic = {
      path: 'Focus Flow/Epics/FF-40 Build a calmer system.md',
      frontmatter: {
        focus_flow: {
          schema_version: 1,
          id: '019946c9-5f97-7196-8483-73469275ff90',
          key: 'FF-40',
          type: 'epic',
          lifecycle: 'backlog',
          created_at: '2026-08-30T08:30:00+04:00',
          backlog_rank: 'a0',
        },
      },
      body: '',
    };
    const firstStory = {
      path: 'Focus Flow/Stories/FF-42 Improve weekly focus.md',
      frontmatter: {
        focus_flow: {
          schema_version: 1,
          id: '019946f1-8d2a-7f05-87b1-1eebbb476300',
          key: 'FF-42',
          type: 'story',
          lifecycle: 'backlog',
          created_at: '2026-08-30T09:00:00+04:00',
          epic_id: '019946c9-5f97-7196-8483-73469275ff90',
          epic_link: '[[FF-40 Build a calmer system]]',
          backlog_rank: 'a0',
        },
      },
      body: '',
    };
    const secondStory = {
      path: 'Focus Flow/Stories/FF-45 Make reviews repeatable.md',
      frontmatter: {
        focus_flow: {
          ...firstStory.frontmatter.focus_flow,
          id: '01994710-0000-7000-8000-000000000002',
          key: 'FF-45',
          backlog_rank: 'a1',
        },
      },
      body: '',
    };
    const firstTask = {
      path: 'Focus Flow/Tasks/FF-43 Prepare weekly focus.md',
      frontmatter: {
        focus_flow: {
          schema_version: 1,
          id: '01994706-857c-76f1-8006-85cd9bd80890',
          key: 'FF-43',
          type: 'task',
          lifecycle: 'active',
          created_at: '2026-08-30T09:15:00+04:00',
          story_id: '019946f1-8d2a-7f05-87b1-1eebbb476300',
          story_link: '[[FF-42 Improve weekly focus]]',
          task_rank: 'a0',
          status: 'todo',
        },
      },
      body: '',
    };
    const secondTask = {
      path: 'Focus Flow/Tasks/FF-46 Write the review checklist.md',
      frontmatter: {
        focus_flow: {
          ...firstTask.frontmatter.focus_flow,
          id: '01994710-0000-7000-8000-000000000003',
          key: 'FF-46',
          story_id: '01994710-0000-7000-8000-000000000002',
          story_link: '[[FF-45 Make reviews repeatable]]',
        },
      },
      body: '',
    };

    const snapshot = buildWorkIndexSnapshot([
      epic,
      firstStory,
      secondStory,
      firstTask,
      secondTask,
    ]);

    expect(snapshot.diagnostics).toEqual([]);
  });

  it('reports a Story whose derived parent link disagrees with its Epic UUID', () => {
    const epic = {
      path: 'Focus Flow/Epics/FF-40 Build a calmer system.md',
      frontmatter: {
        focus_flow: {
          schema_version: 1,
          id: '019946c9-5f97-7196-8483-73469275ff90',
          key: 'FF-40',
          type: 'epic',
          lifecycle: 'backlog',
          created_at: '2026-08-30T08:30:00+04:00',
          backlog_rank: 'a0',
        },
      },
      body: '',
    };
    const story = {
      path: 'Focus Flow/Stories/FF-42 Improve weekly focus.md',
      frontmatter: {
        focus_flow: {
          schema_version: 1,
          id: '019946f1-8d2a-7f05-87b1-1eebbb476300',
          key: 'FF-42',
          type: 'story',
          lifecycle: 'backlog',
          created_at: '2026-08-30T09:00:00+04:00',
          epic_id: '019946c9-5f97-7196-8483-73469275ff90',
          epic_link: '[[FF-99 Wrong Epic]]',
          backlog_rank: 'a0',
        },
      },
      body: '',
    };

    const snapshot = buildWorkIndexSnapshot([epic, story]);

    expect(snapshot.entities).toHaveLength(2);
    expect(snapshot.diagnostics).toEqual([
      {
        code: 'parent-link-mismatch',
        message:
          'Parent link does not match Epic FF-40 at Focus Flow/Epics/FF-40 Build a calmer system.md.',
        path: story.path,
        repair: {
          kind: 'replace-parent-link',
          path: story.path,
          parentId: '019946c9-5f97-7196-8483-73469275ff90',
          field: 'epic_link',
          expectedValue: '[[FF-99 Wrong Epic]]',
          replacementValue:
            '[[Focus Flow/Epics/FF-40 Build a calmer system]]',
        },
      },
    ]);
  });

  it('reports a Task whose derived parent link disagrees with its Story UUID', () => {
    const epic = {
      path: 'Focus Flow/Epics/FF-40 Build a calmer system.md',
      frontmatter: {
        focus_flow: {
          schema_version: 1,
          id: '019946c9-5f97-7196-8483-73469275ff90',
          key: 'FF-40',
          type: 'epic',
          lifecycle: 'backlog',
          created_at: '2026-08-30T08:30:00+04:00',
          backlog_rank: 'a0',
        },
      },
      body: '',
    };
    const story = {
      path: 'Focus Flow/Stories/FF-42 Improve weekly focus.md',
      frontmatter: {
        focus_flow: {
          schema_version: 1,
          id: '019946f1-8d2a-7f05-87b1-1eebbb476300',
          key: 'FF-42',
          type: 'story',
          lifecycle: 'backlog',
          created_at: '2026-08-30T09:00:00+04:00',
          epic_id: '019946c9-5f97-7196-8483-73469275ff90',
          epic_link: '[[FF-40 Build a calmer system]]',
          backlog_rank: 'a0',
        },
      },
      body: '',
    };
    const task = {
      path: 'Focus Flow/Tasks/FF-43 Prepare weekly focus.md',
      frontmatter: {
        focus_flow: {
          schema_version: 1,
          id: '01994706-857c-76f1-8006-85cd9bd80890',
          key: 'FF-43',
          type: 'task',
          lifecycle: 'active',
          created_at: '2026-08-30T09:15:00+04:00',
          story_id: '019946f1-8d2a-7f05-87b1-1eebbb476300',
          story_link: '[[FF-99 Wrong Story]]',
          task_rank: 'a0',
          status: 'todo',
        },
      },
      body: '',
    };

    const snapshot = buildWorkIndexSnapshot([epic, story, task]);

    expect(snapshot.entities).toHaveLength(3);
    expect(snapshot.diagnostics).toEqual([
      {
        code: 'parent-link-mismatch',
        message:
          'Parent link does not match Story FF-42 at Focus Flow/Stories/FF-42 Improve weekly focus.md.',
        path: task.path,
        repair: {
          kind: 'replace-parent-link',
          path: task.path,
          parentId: '019946f1-8d2a-7f05-87b1-1eebbb476300',
          field: 'story_link',
          expectedValue: '[[FF-99 Wrong Story]]',
          replacementValue:
            '[[Focus Flow/Stories/FF-42 Improve weekly focus]]',
        },
      },
    ]);
  });
});

describe('WorkIndex', () => {
  it('keeps Candidates visible while reporting a missing Mission softly', async () => {
    const repository = {
      list: vi.fn().mockResolvedValue([candidateSource]),
      readMission: vi.fn().mockResolvedValue({
        path: 'Focus Flow/MISSION.md',
        body: null,
      }),
    };
    const index = new WorkIndex(repository);

    await index.refresh();

    expect(index.getSnapshot()).toMatchObject({
      phase: 'ready',
      entities: [{ type: 'candidate', key: 'FF-41' }],
      diagnostics: [
        {
          code: 'missing-mission',
          path: 'Focus Flow/MISSION.md',
          message:
            'Mission is missing or empty. Capture and triage remain available.',
        },
      ],
    });
  });

  it('updates descendant Effective Tags after a parent tag change', async () => {
    const updatedEpic = {
      ...taggedEpicSource,
      frontmatter: {
        ...taggedEpicSource.frontmatter,
        tags: [...taggedEpicSource.frontmatter.tags, 'priority/current'],
      },
    };
    const repository = {
      list: vi
        .fn()
        .mockResolvedValueOnce([
          taggedEpicSource,
          taggedStorySource,
          taggedTaskSource,
        ])
        .mockResolvedValueOnce([
          updatedEpic,
          taggedStorySource,
          taggedTaskSource,
        ]),
      readMission: vi.fn().mockResolvedValue({
        path: 'MISSION.md',
        body: 'Choose deliberately.',
      }),
    };
    const index = new WorkIndex(repository);

    await index.refresh();
    expect(
      index
        .getSnapshot()
        .entities.find((entity) => entity.type === 'task')?.effectiveTags,
    ).not.toContain('priority/current');

    await index.refresh();
    expect(
      index
        .getSnapshot()
        .entities.find((entity) => entity.type === 'task')?.effectiveTags,
    ).toContain('priority/current');
  });

  it('reads only changed notes during an incremental refresh', async () => {
    const updatedEpic = {
      ...taggedEpicSource,
      frontmatter: {
        ...taggedEpicSource.frontmatter,
        tags: [...taggedEpicSource.frontmatter.tags, 'priority/current'],
      },
    };
    const repository = {
      list: vi.fn().mockResolvedValue([
        taggedEpicSource,
        taggedStorySource,
        taggedTaskSource,
      ]),
      read: vi.fn().mockResolvedValue(updatedEpic),
      readMission: vi.fn().mockResolvedValue({
        path: 'Focus Flow/MISSION.md',
        body: 'Choose deliberately.',
      }),
    };
    const index = new WorkIndex(repository);

    await index.refresh();
    await index.refreshPaths([updatedEpic.path]);

    expect(repository.list).toHaveBeenCalledTimes(1);
    expect(repository.read).toHaveBeenCalledWith(updatedEpic.path);
    expect(
      index
        .getSnapshot()
        .entities.find((entity) => entity.type === 'task')?.effectiveTags,
    ).toContain('priority/current');
  });

  it('clears a transition-timestamp warning after a valid edit', async () => {
    const missingTimestamp = {
      ...taggedTaskSource,
      frontmatter: {
        ...taggedTaskSource.frontmatter,
        focus_flow: {
          ...taggedTaskSource.frontmatter.focus_flow,
          status: 'in_progress',
          started_at: null,
        },
      },
    };
    const fixed = {
      ...missingTimestamp,
      frontmatter: {
        ...missingTimestamp.frontmatter,
        focus_flow: {
          ...missingTimestamp.frontmatter.focus_flow,
          started_at: '2026-08-30T10:00:00+04:00',
        },
      },
    };
    const repository = {
      list: vi.fn().mockResolvedValue([
        taggedEpicSource,
        taggedStorySource,
        missingTimestamp,
      ]),
      read: vi.fn().mockResolvedValue(fixed),
      readMission: vi.fn().mockResolvedValue({
        path: 'Focus Flow/MISSION.md',
        body: '# Mission',
      }),
    };
    const index = new WorkIndex(repository);

    await index.refresh();
    expect(index.getSnapshot().diagnostics).toContainEqual(
      expect.objectContaining({ code: 'missing-transition-timestamp' }),
    );

    await index.refreshPaths([missingTimestamp.path]);
    expect(index.getSnapshot().diagnostics).toEqual([]);
  });

  it('yields while indexing a large initial source set', async () => {
    const sources = Array.from({ length: 501 }, (_, index) => ({
      ...candidateSource,
      path: `Focus Flow/Inbox/FF-${index + 100} Candidate ${index}.md`,
      frontmatter: {
        ...candidateSource.frontmatter,
        focus_flow: {
          ...candidateSource.frontmatter.focus_flow,
          id: `01994770-0000-7000-8000-${String(index).padStart(12, '0')}`,
          key: `FF-${index + 100}`,
        },
        title: `Candidate ${index}`,
      },
    }));
    const yieldToMain = vi.fn().mockResolvedValue(undefined);
    const repository = {
      list: vi.fn().mockResolvedValue(sources),
      readMission: vi.fn().mockResolvedValue({
        path: 'Focus Flow/MISSION.md',
        body: 'Choose deliberately.',
      }),
    };
    const index = new WorkIndex(repository, { batchSize: 200, yieldToMain });

    await index.refresh();

    expect(index.getSnapshot().entities).toHaveLength(501);
    expect(yieldToMain).toHaveBeenCalledTimes(2);
  });

  it('updates a descendant repair plan after its parent is renamed', async () => {
    const renamedEpic = {
      ...taggedEpicSource,
      path: 'Focus Flow/Epics/FF-40 Build a sustainable system.md',
    };
    const repository = {
      list: vi
        .fn()
        .mockResolvedValueOnce([taggedEpicSource, taggedStorySource])
        .mockResolvedValueOnce([renamedEpic, taggedStorySource]),
      readMission: vi.fn().mockResolvedValue({
        path: 'Focus Flow/MISSION.md',
        body: 'Choose deliberately.',
      }),
    };
    const index = new WorkIndex(repository);

    await index.refresh();
    expect(index.getSnapshot().diagnostics).toEqual([]);

    await index.refresh();
    expect(index.getSnapshot().diagnostics).toContainEqual({
      code: 'parent-link-mismatch',
      message:
        'Parent link does not match Epic FF-40 at Focus Flow/Epics/FF-40 Build a sustainable system.md.',
      path: taggedStorySource.path,
      repair: {
        kind: 'replace-parent-link',
        path: taggedStorySource.path,
        parentId: taggedEpicSource.frontmatter.focus_flow.id,
        field: 'epic_link',
        expectedValue:
          '[[Focus Flow/Epics/FF-40 Build a calmer system]]',
        replacementValue:
          '[[Focus Flow/Epics/FF-40 Build a sustainable system]]',
      },
    });
  });

  it('publishes a refreshed snapshot until the subscriber unsubscribes', async () => {
    const repository = {
      list: vi.fn().mockResolvedValue([candidateSource]),
      readMission: vi.fn().mockResolvedValue({
        path: 'MISSION.md',
        body: 'Choose deliberately.',
      }),
    };
    const index = new WorkIndex(repository);
    const subscriber = vi.fn();
    const unsubscribe = index.subscribe(subscriber);

    expect(index.getSnapshot()).toEqual({
      phase: 'loading',
      entities: [],
      diagnostics: [],
    });

    await index.refresh();

    expect(index.getSnapshot()).toMatchObject({
      phase: 'ready',
      entities: [{ key: 'FF-41', type: 'candidate' }],
    });
    expect(subscriber).toHaveBeenCalledTimes(1);

    unsubscribe();
    await index.refresh();

    expect(subscriber).toHaveBeenCalledTimes(1);
  });

  it('retains the last snapshot when reading managed notes fails', async () => {
    const repository = {
      list: vi
        .fn()
        .mockResolvedValueOnce([candidateSource])
        .mockRejectedValueOnce(new Error('Sensitive vault details')),
      readMission: vi.fn().mockResolvedValue({
        path: 'MISSION.md',
        body: 'Choose deliberately.',
      }),
    };
    const index = new WorkIndex(repository);

    await index.refresh();
    await index.refresh();

    expect(index.getSnapshot()).toMatchObject({
      phase: 'error',
      entities: [{ key: 'FF-41', type: 'candidate' }],
      errorMessage: 'Focus Flow could not read managed notes.',
    });
  });

  it('returns to ready after a tag-only refresh recovers from a read error', async () => {
    const updatedEpic = {
      ...taggedEpicSource,
      frontmatter: {
        ...taggedEpicSource.frontmatter,
        tags: [...taggedEpicSource.frontmatter.tags, 'priority/current'],
      },
    };
    const repository = {
      list: vi
        .fn()
        .mockResolvedValueOnce([taggedEpicSource, taggedStorySource, taggedTaskSource])
        .mockRejectedValueOnce(new Error('Sensitive vault details')),
      read: vi.fn().mockResolvedValue(updatedEpic),
      readMission: vi.fn().mockResolvedValue({
        path: 'MISSION.md',
        body: 'Choose deliberately.',
      }),
    };
    const index = new WorkIndex(repository);

    await index.refresh();
    await index.refresh();
    expect(index.getSnapshot().phase).toBe('error');

    await index.refreshPaths([updatedEpic.path]);

    expect(index.getSnapshot().phase).toBe('ready');
    expect(index.getSnapshot().errorMessage).toBeUndefined();
  });
});
