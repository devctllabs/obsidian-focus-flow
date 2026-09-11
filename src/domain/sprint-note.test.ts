import { describe, expect, it } from 'vitest';
import { serializePlan } from '../application/closing/serialize-close';
import { closePlanFixture } from '../test/lifecycle-fixture';
import { parseSprintNote } from './sprint-note';

const criteriaHash = `sha256:${'a'.repeat(64)}`;
const startSnapshotFixture = {
  captured_at: '2026-08-17T08:30:00+04:00',
  stories: [
    {
      id: '019946f1-8d2a-7f05-87b1-1eebbb476300',
      key: 'FF-42',
      title: 'Use Focus on mobile',
      epic_id: '019946c9-5f97-7196-8483-73469275ff90',
      sprint_rank: 'a0',
      acceptance_criteria_hash: criteriaHash,
      acceptance_criteria: [
        { text: 'The board opens on mobile', checked: false },
      ],
      effective_tags: ['product/focus-flow'],
      tasks: [],
    },
  ],
};
const closeSnapshotFixture = {
  operation_id: '01994a8a-0371-7a2d-a3e9-247990391600',
  captured_at: '2026-08-23T18:00:00+04:00',
  stories: [
    {
      id: '019946f1-8d2a-7f05-87b1-1eebbb476300',
      key: 'FF-42',
      title: 'Use Focus on mobile',
      epic_id: '019946c9-5f97-7196-8483-73469275ff90',
      outcome: 'achieved',
      evidence: 'Verified on mobile.',
      acceptance_exception_reason: null,
      acceptance_criteria: [{ text: 'The board opens on mobile', checked: true }],
      effective_tags: ['product/focus-flow'],
    },
  ],
  tasks: [],
  summary: {
    attempted_stories: 1,
    stories_at_start: 1,
    stories_at_close: 1,
    stories_added: 0,
    stories_removed: 0,
    achieved_stories: 1,
    not_achieved_stories: 0,
    closed_stories: 0,
    committed_open_tasks: 0,
    tasks_at_start: 0,
    tasks_at_close: 0,
    tasks_added: 0,
    tasks_removed: 0,
    completed_during_sprint: 0,
    open_at_close: 0,
    exception_count: 0,
  },
  effective_tag_summary: [],
};

describe('parseSprintNote', () => {
  it.each(['', undefined])('accepts optional reflections in saved outcomes and frozen snapshots (%s)', (evidence) => {
    const common = {
      schema_version: 1, id: '01994744-a401-759a-b582-4418f2f2405f', type: 'sprint',
      code: 'SPR-013', sequence: 13, starts_on: '2026-08-17', due_on: '2026-08-23',
      started_at: '2026-08-17T08:30:00+04:00', start_snapshot: startSnapshotFixture,
      provisional_story_outcomes: [{ story_id: closeSnapshotFixture.stories[0]!.id, evaluated_at: '2026-08-23T18:00:00+04:00', outcome: 'achieved', evidence, acceptance_exception_reason: null }],
    };
    for (const lifecycle of ['active', 'closed']) {
      const result = parseSprintNote({ path: 'Focus Flow/Sprints/SPR-013.md', body: '', frontmatter: { focus_flow: {
        ...common, lifecycle, closed_at: lifecycle === 'closed' ? '2026-08-23T18:00:00+04:00' : null,
        close_snapshot: lifecycle === 'closed' ? { ...closeSnapshotFixture, stories: closeSnapshotFixture.stories.map((story) => ({ ...story, evidence })) } : null,
      } } });
      expect(result).toMatchObject({ ok: true, entity: { provisionalStoryOutcomes: [{ evidence: '' }] } });
    }
  });
  it('parses the single Draft Sprint shape', () => {
    const result = parseSprintNote({
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
    });

    expect(result).toEqual({
      ok: true,
      entity: {
        id: '01994744-a401-759a-b582-4418f2f2405f',
        type: 'sprint',
        lifecycle: 'draft',
      },
    });
  });

  it('parses an Active Sprint and its boundary snapshot', () => {
    const result = parseSprintNote({
      path: 'Focus Flow/Sprints/SPR-014.md',
      frontmatter: {
        focus_flow: {
          schema_version: 1,
          id: '01994744-a401-759a-b582-4418f2f2405f',
          type: 'sprint',
          lifecycle: 'active',
          code: 'SPR-014',
          sequence: 14,
          starts_on: '2026-08-24',
          due_on: '2026-08-30',
          started_at: '2026-08-24T08:30:00+04:00',
          closed_at: null,
          provisional_story_outcomes: [
            {
              story_id: '019946f1-8d2a-7f05-87b1-1eebbb476300',
              evaluated_at: '2026-08-29T18:10:00+04:00',
              outcome: 'achieved',
              evidence: 'Verified on mobile.',
              acceptance_exception_reason: null,
            },
          ],
          start_snapshot: {
            captured_at: '2026-08-24T08:30:00+04:00',
            stories: [
              {
                id: '019946f1-8d2a-7f05-87b1-1eebbb476300',
                key: 'FF-42',
                title: 'Use Focus on mobile',
                epic_id: '019946c9-5f97-7196-8483-73469275ff90',
                sprint_rank: 'a0',
                acceptance_criteria_hash: criteriaHash,
                acceptance_criteria: [
                  { text: 'The board opens on mobile', checked: false },
                ],
                effective_tags: ['product/focus-flow'],
                tasks: [
                  {
                    id: '01994706-857c-76f1-8006-85cd9bd80890',
                    key: 'FF-43',
                    title: 'Build the mobile pager',
                    task_rank: 'a0',
                    status: 'done',
                    completed_before_sprint: true,
                    effective_tags: ['product/focus-flow'],
                  },
                ],
              },
            ],
          },
          close_snapshot: null,
        },
      },
      body: '# SPR-014',
    });

    expect(result).toMatchObject({
      ok: true,
      entity: {
        type: 'sprint',
        lifecycle: 'active',
        code: 'SPR-014',
        sequence: 14,
        startsOn: '2026-08-24',
        dueOn: '2026-08-30',
        closedAt: null,
        provisionalStoryOutcomes: [{ outcome: 'achieved' }],
        startSnapshot: {
          capturedAt: '2026-08-24T08:30:00+04:00',
          stories: [
            {
              key: 'FF-42',
              epicId: '019946c9-5f97-7196-8483-73469275ff90',
              acceptanceCriteriaHash: criteriaHash,
              acceptanceCriteria: [
                { text: 'The board opens on mobile', checked: false },
              ],
              tasks: [
                {
                  key: 'FF-43',
                  status: 'done',
                  completedBeforeSprint: true,
                },
              ],
            },
          ],
        },
        closeSnapshot: null,
      },
    });
  });

  it('parses a Closed Sprint only with a durable close snapshot', () => {
    const result = parseSprintNote({
      path: 'Focus Flow/Sprints/SPR-013.md',
      frontmatter: {
        focus_flow: {
          schema_version: 1,
          id: '01994744-a401-759a-b582-4418f2f2405f',
          type: 'sprint',
          lifecycle: 'closed',
          code: 'SPR-013',
          sequence: 13,
          starts_on: '2026-08-17',
          due_on: '2026-08-23',
          started_at: '2026-08-17T08:30:00+04:00',
          closed_at: '2026-08-23T18:00:00+04:00',
          provisional_story_outcomes: [],
          start_snapshot: startSnapshotFixture,
          close_snapshot: closeSnapshotFixture,
        },
      },
      body: `# SPR-013

## Wins
- Shipped the mobile board.

  **Evidence**
  - [[Review notes]]

## Friction
- Device testing was manual.

## Improvements
- Automate the device matrix.`,
    });

    expect(result).toMatchObject({
      ok: true,
      entity: {
        lifecycle: 'closed',
        closedAt: '2026-08-23T18:00:00+04:00',
        closeSnapshot: {
          capturedAt: '2026-08-23T18:00:00+04:00',
          summary: { achievedStories: 1 },
        },
        retrospectiveItems: [
          { kind: 'win', text: 'Shipped the mobile board.\n\n**Evidence**\n- [[Review notes]]' },
          { kind: 'friction', text: 'Device testing was manual.' },
          { kind: 'improvement', text: 'Automate the device matrix.' },
        ],
      },
    });
  });

  it('keeps a Closed Sprint with pending Close data available for recovery', () => {
    const plan = closePlanFixture();
    const serialized = serializePlan(plan);
    const result = parseSprintNote({
      path: plan.sprintPath,
      frontmatter: {
        focus_flow: {
          schema_version: 1,
          id: plan.sprintId,
          type: 'sprint',
          lifecycle: 'closed',
          code: 'SPR-014',
          sequence: 14,
          starts_on: '2026-08-24',
          due_on: '2026-08-30',
          started_at: '2026-08-24T08:30:00Z',
          closed_at: plan.capturedAt,
          provisional_story_outcomes: [],
          start_snapshot: startSnapshotFixture,
          close_snapshot: serialized.close_snapshot,
          pending_close: {
            ...serialized,
            sprint_move: {
              source_path: plan.sprintPath,
              destination_path:
                'Focus Flow/Sprints/Archive/2026/08/SPR-014.md',
            },
          },
        },
      },
      body: '# SPR-014',
    });

    expect(result).toMatchObject({
      ok: true,
      entity: {
        lifecycle: 'closed',
        pendingClose: { operationId: plan.operationId },
      },
    });
  });

  it('rejects duplicate retrospective sections', () => {
    const result = parseSprintNote({
      path: 'Focus Flow/Sprints/SPR-013.md',
      frontmatter: {
        focus_flow: {
          schema_version: 1,
          id: '01994744-a401-759a-b582-4418f2f2405f',
          type: 'sprint',
          lifecycle: 'closed',
          code: 'SPR-013',
          sequence: 13,
          starts_on: '2026-08-17',
          due_on: '2026-08-23',
          started_at: '2026-08-17T08:30:00+04:00',
          closed_at: '2026-08-23T18:00:00+04:00',
          provisional_story_outcomes: [],
          start_snapshot: startSnapshotFixture,
          close_snapshot: closeSnapshotFixture,
        },
      },
      body: '# SPR-013\n\n## Wins\n- First\n\n## Wins\n- Second\n',
    });

    expect(result).toMatchObject({
      ok: false,
      diagnostics: [
        {
          code: 'invalid-managed-data',
          message: 'Body contains duplicate Wins sections.',
        },
      ],
    });
  });

  it('does not parse retrospective items from legacy marker headings', () => {
    const result = parseSprintNote({
      path: 'Focus Flow/Sprints/SPR-013.md',
      frontmatter: {
        focus_flow: {
          schema_version: 1,
          id: '01994744-a401-759a-b582-4418f2f2405f',
          type: 'sprint',
          lifecycle: 'closed',
          code: 'SPR-013',
          sequence: 13,
          starts_on: '2026-08-17',
          due_on: '2026-08-23',
          started_at: '2026-08-17T08:30:00+04:00',
          closed_at: '2026-08-23T18:00:00+04:00',
          provisional_story_outcomes: [],
          start_snapshot: startSnapshotFixture,
          close_snapshot: closeSnapshotFixture,
        },
      },
      body: `# SPR-013

## Wins <!-- focus-flow:retro:wins -->
- Legacy win.
`,
    });

    expect(result).toMatchObject({
      ok: true,
      entity: { retrospectiveItems: [] },
    });
  });

  it('rejects a Sprint whose code disagrees with its sequence', () => {
    const result = parseSprintNote({
      path: 'Focus Flow/Sprints/SPR-099.md',
      frontmatter: {
        focus_flow: {
          schema_version: 1,
          id: '01994744-a401-759a-b582-4418f2f2405f',
          type: 'sprint',
          lifecycle: 'active',
          code: 'SPR-099',
          sequence: 14,
          starts_on: '2026-08-24',
          due_on: '2026-08-30',
          started_at: '2026-08-24T08:30:00+04:00',
          closed_at: null,
          provisional_story_outcomes: [],
          start_snapshot: startSnapshotFixture,
          close_snapshot: null,
        },
      },
      body: '',
    });

    expect(result).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'invalid-managed-data' }],
    });
  });
});
