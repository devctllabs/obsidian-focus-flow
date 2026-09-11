import { describe, expect, it, vi } from 'vitest';
import type { WipPolicies } from '../../domain/wip-policy';
import { WorkIndex } from './work-index';

describe('WorkIndex Sprint Scope diagnostics', () => {
  it('recomputes the configured Scope policy on refresh', async () => {
    let policies: WipPolicies = {
      sprintScope: { mode: 'soft', limit: 1 },
      tomorrow: { mode: 'off', limit: 1 },
      today: { mode: 'off', limit: 1 },
      inProgress: { mode: 'off', limit: 1 },
    };
    const repository = {
      list: vi.fn().mockResolvedValue(activeSprintHierarchy()),
      readMission: vi.fn().mockResolvedValue({
        path: 'Focus Flow/MISSION.md',
        body: '# Mission',
      }),
    };
    const index = new WorkIndex(repository, {
      getWipPolicies: () => policies,
    });

    await index.refresh();
    expect(index.getSnapshot().diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'wip-limit-exceeded',
        severity: 'warning',
        path: 'Focus Flow/Sprints/SPR-001.md',
      }),
    );

    policies = {
      ...policies,
      sprintScope: { mode: 'off', limit: 1 },
    };
    await index.refresh();
    expect(index.getSnapshot().diagnostics).toEqual([]);
  });

  it('recomputes lane diagnostics from all current WIP settings', async () => {
    let policies: WipPolicies = {
      sprintScope: { mode: 'off', limit: 1 },
      tomorrow: { mode: 'soft', limit: 1 },
      today: { mode: 'off', limit: 1 },
      inProgress: { mode: 'off', limit: 1 },
    };
    const repository = {
      list: vi.fn().mockResolvedValue(activeSprintHierarchy()),
      readMission: vi.fn().mockResolvedValue({
        path: 'Focus Flow/MISSION.md',
        body: '# Mission',
      }),
    };
    const index = new WorkIndex(repository, {
      getWipPolicies: () => policies,
    });

    await index.refresh();
    const diagnostics = index.getSnapshot().diagnostics;
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      code: 'wip-limit-exceeded',
      severity: 'warning',
      path: 'Focus Flow/Sprints/SPR-001.md',
    });
    expect(diagnostics[0]?.message).toContain(
      'Tomorrow soft WIP limit exceeded',
    );

    policies = {
      ...policies,
      tomorrow: { mode: 'off', limit: 1 },
    };
    await index.refresh();
    expect(index.getSnapshot().diagnostics).toEqual([]);
  });

  it('does not count malformed or otherwise non-projected Tasks in Sprint Scope', async () => {
    const sources = activeSprintHierarchy().filter(
      (source) => !source.path.startsWith('Focus Flow/Tasks/'),
    );
    sources.push({
      path: 'Focus Flow/Tasks/FF-3 Malformed.md',
      frontmatter: {
        focus_flow: {
          schema_version: 1,
          id: '01994706-857c-76f1-8006-85cd9bd80890',
          key: 'FF-3',
          type: 'task',
          lifecycle: 'active',
          story_id: '019946f1-8d2a-7f05-87b1-1eebbb476300',
          story_link: '[[Focus Flow/Stories/FF-2 Story]]',
          task_rank: 'a0',
          status: 'not-a-task-status',
          created_at: '2026-08-24T08:00:00Z',
        },
      },
      body: '',
    });
    const index = new WorkIndex({
      list: vi.fn().mockResolvedValue(sources),
      readMission: vi.fn().mockResolvedValue({
        path: 'Focus Flow/MISSION.md',
        body: '# Mission',
      }),
    }, {
      getWipPolicies: () => ({
        sprintScope: { mode: 'hard', limit: 0 },
        tomorrow: { mode: 'off', limit: 1 },
        today: { mode: 'off', limit: 1 },
        inProgress: { mode: 'off', limit: 1 },
      }),
    });

    await index.refresh();

    expect(index.getSnapshot().diagnostics).not.toContainEqual(
      expect.objectContaining({ code: 'wip-limit-exceeded' }),
    );
  });
});

function activeSprintHierarchy() {
  const epicId = '019946c9-5f97-7196-8483-73469275ff90';
  const storyId = '019946f1-8d2a-7f05-87b1-1eebbb476300';
  const sprintId = '01994770-0000-7000-8000-000000000099';
  const epicPath = 'Focus Flow/Epics/FF-1 Epic.md';
  const storyPath = 'Focus Flow/Stories/FF-2 Story.md';
  const taskSource = (id: string, key: string, rank: string) => ({
    path: `Focus Flow/Tasks/${key} Task.md`,
    frontmatter: {
      focus_flow: {
        schema_version: 1,
        id,
        key,
        type: 'task',
        lifecycle: 'active',
        story_id: storyId,
        story_link: `[[${storyPath.replace(/\.md$/, '')}]]`,
        task_rank: rank,
        status: 'tomorrow',
        created_at: '2026-08-24T08:00:00Z',
      },
    },
    body: '',
  });
  return [
    activeSprintSource(),
    {
      path: epicPath,
      frontmatter: { focus_flow: {
        schema_version: 1,
        id: epicId,
        key: 'FF-1',
        type: 'epic',
        lifecycle: 'backlog',
        backlog_rank: 'a0',
        created_at: '2026-08-20T00:00:00Z',
      } },
      body: '',
    },
    {
      path: storyPath,
      frontmatter: { focus_flow: {
        schema_version: 1,
        id: storyId,
        key: 'FF-2',
        type: 'story',
        lifecycle: 'active_sprint',
        epic_id: epicId,
        epic_link: `[[${epicPath.replace(/\.md$/, '')}]]`,
        sprint_id: sprintId,
        sprint_rank: 'a0',
        created_at: '2026-08-20T00:00:00Z',
      } },
      body: '',
    },
    taskSource('01994706-857c-76f1-8006-85cd9bd80890', 'FF-3', 'a0'),
    taskSource('01994706-857c-76f1-8006-85cd9bd80891', 'FF-4', 'a1'),
  ];
}

function activeSprintSource() {
  const task = (id: string, key: string) => ({
    id,
    key,
    title: key,
    task_rank: key,
    status: 'todo',
    completed_before_sprint: false,
    effective_tags: [],
  });
  return {
    path: 'Focus Flow/Sprints/SPR-001.md',
    frontmatter: {
      focus_flow: {
        schema_version: 1,
        id: '01994770-0000-7000-8000-000000000099',
        type: 'sprint',
        lifecycle: 'active',
        code: 'SPR-001',
        sequence: 1,
        starts_on: '2026-08-24',
        due_on: '2026-08-30',
        started_at: '2026-08-24T08:00:00Z',
        closed_at: null,
        provisional_story_outcomes: [],
        start_snapshot: {
          captured_at: '2026-08-24T08:00:00Z',
          stories: [{
            id: '019946f1-8d2a-7f05-87b1-1eebbb476300',
            key: 'FF-1',
            title: 'Story',
            epic_id: '019946c9-5f97-7196-8483-73469275ff90',
            sprint_rank: 'a0',
            acceptance_criteria_hash: `sha256:${'a'.repeat(64)}`,
            acceptance_criteria: [{ text: 'Works', checked: false }],
            effective_tags: [],
            tasks: [
              task('01994706-857c-76f1-8006-85cd9bd80890', 'FF-2'),
              task('01994706-857c-76f1-8006-85cd9bd80891', 'FF-3'),
            ],
          }],
        },
        close_snapshot: null,
        pending_close: null,
      },
    },
    body: '# SPR-001',
  };
}
