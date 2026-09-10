import { describe, expect, it } from 'vitest';
import type { WorkIndexSnapshot } from './work-index';
import {
  sprintScopeWipDiagnostics,
  wipDiagnostics,
} from './wip-diagnostics';

describe('sprintScopeWipDiagnostics', () => {
  it.each([
    { mode: 'soft' as const, severity: 'warning' as const },
    { mode: 'hard' as const, severity: 'error' as const },
  ])('reports one aggregate $mode Scope excess', ({ mode, severity }) => {
    expect(sprintScopeWipDiagnostics(snapshot(), { mode, limit: 1 })).toEqual([
      {
        code: 'wip-limit-exceeded',
        severity,
        message: `Sprint Scope ${mode} WIP limit exceeded: observed 2, limit 1, excess 1.`,
        path: 'Focus Flow/Sprints/SPR-1.md',
      },
    ]);
  });

  it('emits nothing when policy is off or there is not one Active Sprint', () => {
    expect(sprintScopeWipDiagnostics(snapshot(), { mode: 'off', limit: 1 }))
      .toEqual([]);
    expect(sprintScopeWipDiagnostics({ ...snapshot(), entities: [] }, {
      mode: 'hard',
      limit: 1,
    })).toEqual([]);
  });

  it('reports every exceeded active-Sprint policy on the Sprint path', () => {
    const current = snapshot();
    const storyId = '019946f1-8d2a-7f05-87b1-1eebbb476300';
    current.entities = [
      ...current.entities,
      task('tomorrow-1', storyId, 'tomorrow'),
      task('tomorrow-2', storyId, 'tomorrow'),
      task('today-1', storyId, 'today'),
      task('today-2', storyId, 'today'),
      task('progress-1', storyId, 'in_progress'),
      task('progress-2', storyId, 'in_progress'),
    ];

    expect(wipDiagnostics(current, {
      sprintScope: { mode: 'hard', limit: 2 },
      tomorrow: { mode: 'soft', limit: 1 },
      today: { mode: 'hard', limit: 1 },
      inProgress: { mode: 'soft', limit: 1 },
    })).toEqual([
      diagnostic({ label: 'Sprint Scope', mode: 'hard', severity: 'error', observed: 8, limit: 2 }),
      diagnostic({ label: 'Tomorrow', mode: 'soft', severity: 'warning', observed: 2, limit: 1 }),
      diagnostic({ label: 'Today', mode: 'hard', severity: 'error', observed: 2, limit: 1 }),
      diagnostic({ label: 'In Progress', mode: 'soft', severity: 'warning', observed: 2, limit: 1 }),
    ]);
  });

  it('skips all WIP analysis without one unique Active Sprint', () => {
    const policies = {
      sprintScope: { mode: 'hard' as const, limit: 1 },
      tomorrow: { mode: 'hard' as const, limit: 1 },
      today: { mode: 'hard' as const, limit: 1 },
      inProgress: { mode: 'hard' as const, limit: 1 },
    };

    expect(wipDiagnostics({ ...snapshot(), entities: [] }, policies)).toEqual([]);
    expect(wipDiagnostics({
      ...snapshot(),
      entities: [...snapshot().entities, snapshot().entities[0]!],
    }, policies)).toEqual([]);
  });
});

function diagnostic(
  { label, mode, severity, observed, limit }: { label: string; mode: 'soft' | 'hard'; severity: 'warning' | 'error'; observed: number; limit: number },
) {
  return {
    code: 'wip-limit-exceeded',
    severity,
    message: `${label} ${mode} WIP limit exceeded: observed ${observed}, limit ${limit}, excess ${observed - limit}.`,
    path: 'Focus Flow/Sprints/SPR-1.md',
  };
}

function task(
  id: string,
  storyId: string,
  status: 'tomorrow' | 'today' | 'in_progress',
) {
  return {
    id,
    key: `FF-${id}`,
    title: id,
    type: 'task' as const,
    lifecycle: 'active' as const,
    storyId,
    storyLink: '[[Story]]',
    taskRank: id,
    status,
    startedAt: status === 'in_progress' ? '2026-08-25T00:00:00Z' : null,
    completedAt: null,
    createdAt: '2026-08-25T00:00:00Z',
    tags: [],
    effectiveTags: [],
    path: `Focus Flow/Tasks/${id}.md`,
  };
}

function snapshot(): WorkIndexSnapshot {
  const sprintId = '01994770-0000-7000-8000-000000000099';
  const storyId = '019946f1-8d2a-7f05-87b1-1eebbb476300';
  return {
    phase: 'ready',
    diagnostics: [],
    entities: [
      {
        id: sprintId,
        type: 'sprint',
        lifecycle: 'active',
        code: 'SPR-1',
        sequence: 1,
        startsOn: '2026-08-24',
        dueOn: '2026-08-30',
        startedAt: '2026-08-24T08:00:00Z',
        closedAt: null,
        provisionalStoryOutcomes: [],
        startSnapshot: {
          capturedAt: '2026-08-24T08:00:00Z',
          stories: [{
            id: storyId,
            key: 'FF-1',
            title: 'Story',
            epicId: '019946c9-5f97-7196-8483-73469275ff90',
            sprintRank: 'a0',
            acceptanceCriteriaHash: `sha256:${'a'.repeat(64)}`,
            acceptanceCriteria: [],
            effectiveTags: [],
            tasks: [{
              id: 'task-at-start',
              key: 'FF-2',
              title: 'Initial',
              taskRank: 'a0',
              status: 'todo',
              completedBeforeSprint: false,
              effectiveTags: [],
            }],
          }],
        },
        closeSnapshot: null,
        path: 'Focus Flow/Sprints/SPR-1.md',
      },
      {
        id: storyId,
        key: 'FF-1',
        title: 'Story',
        type: 'story',
        lifecycle: 'active_sprint',
        epicId: '019946c9-5f97-7196-8483-73469275ff90',
        epicLink: '[[Epic]]',
        backlogRank: null,
        sprintId,
        sprintRank: 'a0',
        acceptanceCriteria: [],
        createdAt: '2026-08-20T00:00:00Z',
        tags: [],
        effectiveTags: [],
        path: 'Focus Flow/Stories/FF-1 Story.md',
      },
      {
        id: 'task-added',
        key: 'FF-3',
        title: 'Added',
        type: 'task',
        lifecycle: 'done',
        storyId,
        storyLink: '[[Story]]',
        taskRank: 'a1',
        status: 'done',
        startedAt: null,
        completedAt: '2026-08-25T00:00:00Z',
        createdAt: '2026-08-25T00:00:00Z',
        tags: [],
        effectiveTags: [],
        path: 'Focus Flow/Tasks/FF-3 Added.md',
      },
      {
        id: 'task-at-start',
        key: 'FF-2',
        title: 'Initial',
        type: 'task',
        lifecycle: 'active',
        storyId,
        storyLink: '[[Story]]',
        taskRank: 'a0',
        status: 'todo',
        startedAt: null,
        completedAt: null,
        createdAt: '2026-08-20T00:00:00Z',
        tags: [],
        effectiveTags: [],
        path: 'Focus Flow/Tasks/FF-2 Initial.md',
      },
    ],
  };
}
