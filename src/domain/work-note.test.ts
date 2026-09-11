import { describe, expect, it } from 'vitest';
import { parseWorkNote } from './work-note';

describe('parseWorkNote', () => {
  it('keeps accepted Stories in their Epic until explicitly selected for Month', () => {
    const focus_flow = { schema_version: 1, id: '019946f1-8d2a-7f05-87b1-1eebbb476300', key: 'FF-42', type: 'story', lifecycle: 'epic_backlog', epic_id: '019946c9-5f97-7196-8483-73469275ff90', epic_link: '[[Epic]]', created_at: '2026-09-05T10:00:00Z' };
    const source = { path: 'Focus Flow/Stories/FF-42 Later outcome.md', frontmatter: { focus_flow }, body: '## Description\n\nA later outcome' };
    expect(parseWorkNote(source)).toMatchObject({ ok: true, entity: { lifecycle: 'epic_backlog', backlogRank: null, sprintId: null, sprintRank: null } });
    expect(parseWorkNote({ ...source, frontmatter: { focus_flow: { ...focus_flow, backlog_rank: 'a0' } } }).ok).toBe(false);
  });
  it('parses a Candidate without planning fields', () => {
    const result = parseWorkNote({
      path: 'Focus Flow/Inbox/FF-41 Explore a weekly focus flow.md',
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
      body: 'Captured before deciding whether this is an Epic or Story.',
    });

    expect(result).toEqual({
      ok: true,
      entity: {
        id: '019946e9-0ef0-7ca3-af0c-ec423d76efed',
        key: 'FF-41',
        type: 'candidate',
        lifecycle: 'inbox',
        title: 'Explore a weekly focus flow',
        createdAt: '2026-08-30T08:45:00+04:00',
        tags: [],
      },
    });
  });

  it('parses a rejected Candidate as an inspectable Distraction', () => {
    const result = parseWorkNote({
      path: 'Focus Flow/Distractions/FF-41 Chase a visible metric.md',
      frontmatter: {
        focus_flow: {
          schema_version: 1,
          id: '019946e9-0ef0-7ca3-af0c-ec423d76efed',
          key: 'FF-41',
          type: 'candidate',
          lifecycle: 'rejected',
          created_at: '2026-08-30T08:45:00+04:00',
          rejected_at: '2026-08-30T12:30:00Z',
          rejection_reason: 'It serves comparison rather than the Mission.',
        },
      },
      body: 'The original context remains here.',
    });

    expect(result).toEqual({
      ok: true,
      entity: {
        id: '019946e9-0ef0-7ca3-af0c-ec423d76efed',
        key: 'FF-41',
        type: 'candidate',
        lifecycle: 'rejected',
        title: 'Chase a visible metric',
        createdAt: '2026-08-30T08:45:00+04:00',
        tags: [],
        rejectedAt: '2026-08-30T12:30:00Z',
        rejectionReason: 'It serves comparison rather than the Mission.',
      },
    });
  });

  it('parses an Epic in the ordered backlog', () => {
    const result = parseWorkNote({
      path: 'Focus Flow/Epics/FF-7 Build Focus Flow.md',
      frontmatter: {
        focus_flow: {
          schema_version: 1,
          id: '019946c9-5f97-7196-8483-73469275ff90',
          key: 'FF-7',
          type: 'epic',
          lifecycle: 'backlog',
          backlog_rank: 'a0',
          created_at: '2026-08-30T08:00:00+04:00',
        },
        tags: ['product/focus-flow'],
      },
      body: 'Long-lived direction for the plugin.',
    });

    expect(result).toEqual({
      ok: true,
      entity: {
        id: '019946c9-5f97-7196-8483-73469275ff90',
        key: 'FF-7',
        type: 'epic',
        lifecycle: 'backlog',
        title: 'Build Focus Flow',
        backlogRank: 'a0',
        acceptanceCriteria: [],
        completedAt: null,
        closedAt: null,
        closeReason: null,
        createdAt: '2026-08-30T08:00:00+04:00',
        tags: ['product/focus-flow'],
      },
    });
  });

  it.each([
    {
      lifecycle: 'done' as const,
      timestamp: { completed_at: '2026-09-01T12:00:00Z' },
      expected: {
        lifecycle: 'done',
        completedAt: '2026-09-01T12:00:00Z',
        closedAt: null,
        closeReason: null,
      },
    },
    {
      lifecycle: 'closed' as const,
      timestamp: {
        closed_at: '2026-09-01T12:00:00Z',
        close_reason: 'Direction changed.',
      },
      expected: {
        lifecycle: 'closed',
        completedAt: null,
        closedAt: '2026-09-01T12:00:00Z',
        closeReason: 'Direction changed.',
      },
    },
  ])('parses a terminal $lifecycle Epic without a rank', ({ lifecycle, timestamp, expected }) => {
    const result = parseWorkNote({
      path: 'Focus Flow/Epics/FF-7 Build Focus Flow.md',
      frontmatter: {
        focus_flow: {
          schema_version: 1,
          id: '019946c9-5f97-7196-8483-73469275ff90',
          key: 'FF-7',
          type: 'epic',
          lifecycle,
          created_at: '2026-08-30T08:00:00+04:00',
          ...timestamp,
        },
      },
      body: '## Acceptance Criteria\n\n- [x] The direction is achieved\n',
    });

    expect(result).toMatchObject({
      ok: true,
      entity: {
        type: 'epic',
        backlogRank: null,
        acceptanceCriteria: [
          { text: 'The direction is achieved', checked: true },
        ],
        ...expected,
      },
    });
  });

  it('rejects a terminal Epic that retains its backlog rank', () => {
    const result = parseWorkNote({
      path: 'Focus Flow/Epics/FF-7 Build Focus Flow.md',
      frontmatter: {
        focus_flow: {
          schema_version: 1,
          id: '019946c9-5f97-7196-8483-73469275ff90',
          key: 'FF-7',
          type: 'epic',
          lifecycle: 'done',
          backlog_rank: 'a0',
          completed_at: '2026-09-01T12:00:00Z',
          created_at: '2026-08-30T08:00:00+04:00',
        },
      },
      body: '## Acceptance Criteria\n\n- [x] Done\n',
    });

    expect(result).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'invalid-managed-data' }],
    });
  });

  it('parses a Story and its Markdown acceptance criteria', () => {
    const result = parseWorkNote({
      path: 'Focus Flow/Stories/FF-42 Use Focus on mobile.md',
      frontmatter: {
        focus_flow: {
          schema_version: 1,
          id: '019946f1-8d2a-7f05-87b1-1eebbb476300',
          key: 'FF-42',
          type: 'story',
          lifecycle: 'backlog',
          epic_id: '019946c9-5f97-7196-8483-73469275ff90',
          epic_link: '[[Focus Flow/Epics/FF-7 Build Focus Flow]]',
          backlog_rank: 'a0',
          created_at: '2026-08-30T09:00:00+04:00',
        },
        tags: ['product/focus-flow', '#mobile'],
      },
      body: `## Description

The board should work without desktop-only interactions.

## Acceptance Criteria

- [ ] The Focus Board opens on mobile
  - On narrow screens
- [x] Invalid moves explain the allowed statuses
`,
    });

    expect(result).toEqual({
      ok: true,
      entity: {
        id: '019946f1-8d2a-7f05-87b1-1eebbb476300',
        key: 'FF-42',
        type: 'story',
        lifecycle: 'backlog',
        title: 'Use Focus on mobile',
        epicId: '019946c9-5f97-7196-8483-73469275ff90',
        epicLink: '[[Focus Flow/Epics/FF-7 Build Focus Flow]]',
        backlogRank: 'a0',
        sprintId: null,
        sprintRank: null,
        createdAt: '2026-08-30T09:00:00+04:00',
        tags: ['product/focus-flow', 'mobile'],
        acceptanceCriteria: [
          { text: 'The Focus Board opens on mobile\n- On narrow screens', checked: false },
          {
            text: 'Invalid moves explain the allowed statuses',
            checked: true,
          },
        ],
      },
    });
  });

  it('rejects duplicate Acceptance Criteria sections in every work-note type', () => {
    const body = '## Acceptance Criteria\n\n- [ ] First\n\n## Acceptance Criteria\n\n- [ ] Second\n';
    const sources = [
      {
        path: 'Focus Flow/Inbox/FF-41 Capture.md',
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
        body,
      },
      {
        path: 'Focus Flow/Epics/FF-7 Build Focus Flow.md',
        frontmatter: {
          focus_flow: {
            schema_version: 1,
            id: '019946c9-5f97-7196-8483-73469275ff90',
            key: 'FF-7',
            type: 'epic',
            lifecycle: 'backlog',
            backlog_rank: 'a0',
            created_at: '2026-08-30T08:00:00+04:00',
          },
        },
        body,
      },
      {
        path: 'Focus Flow/Stories/FF-42 Use Focus on mobile.md',
        frontmatter: {
          focus_flow: {
            schema_version: 1,
            id: '019946f1-8d2a-7f05-87b1-1eebbb476300',
            key: 'FF-42',
            type: 'story',
            lifecycle: 'backlog',
            epic_id: '019946c9-5f97-7196-8483-73469275ff90',
            epic_link: '[[Focus Flow/Epics/FF-7 Build Focus Flow]]',
            backlog_rank: 'a0',
            created_at: '2026-08-30T09:00:00+04:00',
          },
        },
        body,
      },
      {
        path: 'Focus Flow/Tasks/FF-43 Build the mobile status pager.md',
        frontmatter: {
          focus_flow: {
            schema_version: 1,
            id: '01994706-857c-76f1-8006-85cd9bd80890',
            key: 'FF-43',
            type: 'task',
            lifecycle: 'active',
            story_id: '019946f1-8d2a-7f05-87b1-1eebbb476300',
            story_link: '[[Focus Flow/Stories/FF-42 Use Focus on mobile]]',
            task_rank: 'a0',
            status: 'today',
            created_at: '2026-08-30T09:10:00+04:00',
            started_at: null,
            completed_at: null,
          },
        },
        body,
      },
    ] as const;

    for (const source of sources) {
      expect(parseWorkNote(source)).toMatchObject({
        ok: false,
        diagnostics: [
          {
            code: 'invalid-managed-data',
            message: 'Body contains duplicate Acceptance Criteria sections.',
          },
        ],
      });
    }
  });

  it('does not treat a legacy marker heading as Acceptance Criteria', () => {
    const result = parseWorkNote({
      path: 'Focus Flow/Stories/FF-42 Use Focus on mobile.md',
      frontmatter: {
        focus_flow: {
          schema_version: 1,
          id: '019946f1-8d2a-7f05-87b1-1eebbb476300',
          key: 'FF-42',
          type: 'story',
          lifecycle: 'backlog',
          epic_id: '019946c9-5f97-7196-8483-73469275ff90',
          epic_link: '[[Focus Flow/Epics/FF-7 Build Focus Flow]]',
          backlog_rank: 'a0',
          created_at: '2026-08-30T09:00:00+04:00',
        },
      },
      body: '## Acceptance Criteria <!-- focus-flow:acceptance-criteria -->\n\n- [ ] Legacy\n',
    });

    expect(result).toMatchObject({
      ok: true,
      entity: { acceptanceCriteria: [] },
    });
  });

  it('parses an Active Sprint Story without requiring a live backlog rank', () => {
    const result = parseWorkNote({
      path: 'Focus Flow/Stories/FF-44 Ship the first vertical slice.md',
      frontmatter: {
        focus_flow: {
          schema_version: 1,
          id: '0199472e-a5ed-76e8-a60b-735b1447ecfb',
          key: 'FF-44',
          type: 'story',
          lifecycle: 'active_sprint',
          epic_id: '019946c9-5f97-7196-8483-73469275ff90',
          epic_link: '[[Focus Flow/Epics/FF-7 Build Focus Flow]]',
          sprint_id: '01994744-a401-759a-b582-4418f2f2405f',
          sprint_rank: 'a0',
          created_at: '2026-08-30T09:30:00+04:00',
        },
      },
      body: `## Acceptance Criteria

- [ ] The plugin loads in an isolated vault
`,
    });

    expect(result).toMatchObject({
      ok: true,
      entity: {
        key: 'FF-44',
        type: 'story',
        lifecycle: 'active_sprint',
        backlogRank: null,
        sprintId: '01994744-a401-759a-b582-4418f2f2405f',
        sprintRank: 'a0',
      },
    });
  });

  it('parses an active Task and its Story relationship', () => {
    const result = parseWorkNote({
      path: 'Focus Flow/Tasks/FF-43 Build the mobile status pager.md',
      frontmatter: {
        focus_flow: {
          schema_version: 1,
          id: '01994706-857c-76f1-8006-85cd9bd80890',
          key: 'FF-43',
          type: 'task',
          lifecycle: 'active',
          story_id: '019946f1-8d2a-7f05-87b1-1eebbb476300',
          story_link: '[[Focus Flow/Stories/FF-42 Use Focus on mobile]]',
          task_rank: 'a0',
          status: 'today',
          created_at: '2026-08-30T09:10:00+04:00',
          started_at: null,
          completed_at: null,
        },
      },
      body: 'A concrete next action.',
    });

    expect(result).toEqual({
      ok: true,
      entity: {
        id: '01994706-857c-76f1-8006-85cd9bd80890',
        key: 'FF-43',
        type: 'task',
        lifecycle: 'active',
        title: 'Build the mobile status pager',
        storyId: '019946f1-8d2a-7f05-87b1-1eebbb476300',
        storyLink: '[[Focus Flow/Stories/FF-42 Use Focus on mobile]]',
        taskRank: 'a0',
        status: 'today',
        createdAt: '2026-08-30T09:10:00+04:00',
        startedAt: null,
        completedAt: null,
        tags: [],
      },
    });
  });

  it('reports an invalid Task lifecycle and status combination', () => {
    const result = parseWorkNote({
      path: 'Focus Flow/Tasks/FF-43 Build the mobile status pager.md',
      frontmatter: {
        focus_flow: {
          schema_version: 1,
          id: '01994706-857c-76f1-8006-85cd9bd80890',
          key: 'FF-43',
          type: 'task',
          lifecycle: 'active',
          story_id: '019946f1-8d2a-7f05-87b1-1eebbb476300',
          story_link: '[[Focus Flow/Stories/FF-42 Use Focus on mobile]]',
          task_rank: 'a0',
          status: 'done',
          created_at: '2026-08-30T09:10:00+04:00',
          started_at: null,
          completed_at: '2026-08-30T11:00:00+04:00',
        },
      },
      body: '',
    });

    expect(result).toMatchObject({
      ok: false,
      diagnostics: [
        {
          code: 'invalid-managed-data',
          path: 'Focus Flow/Tasks/FF-43 Build the mobile status pager.md',
        },
      ],
    });
  });
});
