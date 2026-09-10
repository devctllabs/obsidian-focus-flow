import { describe, expect, it } from 'vitest';
import type { WorkIndexSnapshot } from '../indexing/work-index';
import { activeSprintScope, startingSprintScopeCount } from './sprint-scope';

const sprintId = '01994770-0000-7000-8000-000000000099';
const storyId = '019946f1-8d2a-7f05-87b1-1eebbb476300';

describe('activeSprintScope', () => {
  it('counts every Task not already Done at the Sprint start boundary', () => {
    expect(startingSprintScopeCount([
      { lifecycle: 'active', status: 'todo' },
      { lifecycle: 'active', status: 'external_in_progress' },
      { lifecycle: 'active', status: 'on_hold' },
      { lifecycle: 'done', status: 'done' },
    ])).toBe(3);
  });

  it('counts current Active Story Tasks except work Done by the start boundary', () => {
    const snapshot = fixture(
      [
      task('initial', 'todo', null),
      task('before', 'done', '2026-08-24T08:29:59Z'),
      task('external', 'external_in_progress', null),
      task('hold', 'on_hold', null),
      task('after', 'done', '2026-08-24T08:30:01Z'),
      task('unknown-done', 'done', null),
      ],
      [{ id: 'initial', completedBeforeSprint: false }],
    );

    expect([...activeSprintScope(snapshot)!.taskIds]).toEqual([
      'initial',
      'external',
      'hold',
      'after',
      'unknown-done',
    ]);
  });

  it('returns null unless exactly one matching Active Sprint exists', () => {
    const snapshot = fixture([]);
    expect(activeSprintScope({ ...snapshot, entities: snapshot.entities.slice(1) })).toBeNull();
    expect(activeSprintScope(snapshot, 'another-sprint')).toBeNull();
  });

  it('drops Start Snapshot Tasks when their Story leaves the Active Sprint', () => {
    const base = fixture([], [
      { id: 'task-from-removed-story', completedBeforeSprint: false },
    ]);
    const sprint = base.entities[0];
    if (sprint?.type !== 'sprint' || sprint.lifecycle !== 'active') {
      throw new Error('Fixture must contain an Active Sprint.');
    }
    const snapshot: WorkIndexSnapshot = {
      ...base,
      entities: [
        {
          ...sprint,
          startSnapshot: {
            ...sprint.startSnapshot,
            stories: sprint.startSnapshot.stories.map((story) => ({
              ...story,
              id: 'removed-story',
            })),
          },
        },
        ...base.entities.slice(1),
      ],
    };

    expect([...activeSprintScope(snapshot)!.taskIds]).toEqual([]);
  });
});

function fixture(
  tasks: Array<ReturnType<typeof task>>,
  initialTasks: Array<{ id: string; completedBeforeSprint: boolean }> = [],
): WorkIndexSnapshot {
  return {
    phase: 'ready',
    diagnostics: [],
    entities: [
      {
        id: sprintId,
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
          stories: initialTasks.length === 0 ? [] : [{
            id: storyId,
            key: 'FF-42',
            title: 'Story added after start',
            epicId: '019946c9-5f97-7196-8483-73469275ff90',
            sprintRank: 'a0',
            acceptanceCriteriaHash: `sha256:${'a'.repeat(64)}`,
            acceptanceCriteria: [],
            effectiveTags: [],
            tasks: initialTasks.map(({ id, completedBeforeSprint }) => ({
              id,
              key: 'FF-1',
              title: id,
              taskRank: id,
              status: completedBeforeSprint ? 'done' : 'todo',
              completedBeforeSprint,
              effectiveTags: [],
            })),
          }],
        },
        closeSnapshot: null,
        path: 'Focus Flow/Sprints/SPR-014.md',
      },
      {
        id: storyId,
        key: 'FF-42',
        title: 'Story added after start',
        type: 'story',
        lifecycle: 'active_sprint',
        epicId: '019946c9-5f97-7196-8483-73469275ff90',
        epicLink: '[[Focus Flow/Epics/FF-40 Product]]',
        backlogRank: null,
        sprintId,
        sprintRank: 'a0',
        acceptanceCriteria: [{ text: 'Works', checked: false }],
        createdAt: '2026-08-24T09:00:00Z',
        tags: [],
        effectiveTags: [],
        path: 'Focus Flow/Stories/FF-42 Story.md',
      },
      ...tasks,
    ],
  };
}

function task(
  id: string,
  status: 'todo' | 'external_in_progress' | 'on_hold' | 'done',
  completedAt: string | null,
) {
  return {
    id,
    key: `FF-${id.length}`,
    title: id,
    type: 'task' as const,
    lifecycle: status === 'done' ? ('done' as const) : ('active' as const),
    storyId,
    storyLink: '[[Focus Flow/Stories/FF-42 Story]]',
    taskRank: id,
    status,
    startedAt: null,
    completedAt,
    createdAt: '2026-08-24T09:00:00Z',
    tags: [],
    effectiveTags: [],
    path: `Focus Flow/Tasks/${id}.md`,
  };
}
