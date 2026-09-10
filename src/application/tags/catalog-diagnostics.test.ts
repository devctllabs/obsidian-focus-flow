import { describe, expect, it } from 'vitest';
import type { ProjectedManagedEntity } from '../indexing/work-index';
import { currentNativeTagUsage, uncatalogedTagDiagnostics } from './catalog-diagnostics';

const base = { createdAt: '2026-09-07T00:00:00Z', effectiveTags: [] as string[] };

describe('uncatalogedTagDiagnostics', () => {
  it('counts exact native tags only on current work', () => {
    const entities = [
      { ...base, id: 'candidate', key: 'FF-1', title: 'Candidate', type: 'candidate', lifecycle: 'inbox', tags: ['direct', 'direct'], path: 'Inbox/FF-1.md' },
      { ...base, id: 'story', key: 'FF-2', title: 'Story', type: 'story', lifecycle: 'backlog', epicId: 'epic', epicLink: '[[Epic]]', backlogRank: 'a0', sprintId: null, sprintRank: null, tags: ['direct'], effectiveTags: ['direct', 'inherited'], acceptanceCriteria: [], path: 'Stories/FF-2.md' },
      { ...base, id: 'done', key: 'FF-3', title: 'Done', type: 'task', lifecycle: 'done', storyId: 'story', storyLink: '[[Story]]', status: 'done', taskRank: 'a0', startedAt: null, completedAt: '2026-09-07T00:00:00Z', tags: ['terminal'], path: 'Tasks/Archive/FF-3.md' },
    ] satisfies ProjectedManagedEntity[];

    expect(currentNativeTagUsage(entities)).toEqual({ direct: 2 });
  });

  it('reports each missing native tag on current work once as an advisory repair', () => {
    const entities = [
      { ...base, id: 'candidate', key: 'FF-1', title: 'Candidate', type: 'candidate', lifecycle: 'inbox', tags: ['direct', 'cataloged'], path: 'Inbox/FF-1.md' },
      { ...base, id: 'epic', key: 'FF-2', title: 'Epic', type: 'epic', lifecycle: 'backlog', backlogRank: 'a0', tags: ['direct'], path: 'Epics/FF-2.md' },
    ] satisfies ProjectedManagedEntity[];

    expect(uncatalogedTagDiagnostics(entities, { entries: { cataloged: {} }, diagnostics: [] })).toEqual([{
      code: 'uncataloged-tag',
      message: '#direct is used on 2 current notes but is not in the Tag Catalog.',
      path: 'Inbox/FF-1.md',
      severity: 'warning',
      repair: { kind: 'catalog-tag', tag: 'direct' },
    }]);
  });

  it('ignores inherited tags, terminal work, and frozen Sprint history', () => {
    const entities = [
      { ...base, id: 'story', key: 'FF-3', title: 'Story', type: 'story', lifecycle: 'backlog', epicId: 'epic', epicLink: '[[Epic]]', backlogRank: 'a0', sprintId: null, sprintRank: null, tags: [], effectiveTags: ['inherited'], acceptanceCriteria: [], path: 'Stories/FF-3.md' },
      { ...base, id: 'done', key: 'FF-4', title: 'Done', type: 'task', lifecycle: 'done', storyId: 'story', storyLink: '[[Story]]', status: 'done', taskRank: 'a0', startedAt: null, completedAt: '2026-09-07T00:00:00Z', tags: ['terminal'], path: 'Tasks/Archive/FF-4.md' },
      { id: 'sprint', type: 'sprint', lifecycle: 'closed', code: 'SPR-001', sequence: 1, startsOn: '2026-09-01', dueOn: '2026-09-07', startedAt: '2026-09-01T00:00:00Z', closedAt: '2026-09-07T00:00:00Z', provisionalStoryOutcomes: [], startSnapshot: { capturedAt: '2026-09-01T00:00:00Z', stories: [] }, closeSnapshot: { operationId: 'op', capturedAt: '2026-09-07T00:00:00Z', stories: [], tasks: [], summary: { attemptedStories: 0, storiesAtStart: 0, storiesAtClose: 0, storiesAdded: 0, storiesRemoved: 0, achievedStories: 0, notAchievedStories: 0, closedStories: 0, committedOpenTasks: 0, tasksAtStart: 0, tasksAtClose: 0, tasksAdded: 0, tasksRemoved: 0, completedDuringSprint: 0, openAtClose: 0, exceptionCount: 0 }, effectiveTagSummary: [{ tag: 'history', completedTasks: 1 }] }, pendingClose: null, path: 'Sprints/Archive/SPR-001.md' },
    ] satisfies ProjectedManagedEntity[];

    expect(uncatalogedTagDiagnostics(entities, { entries: {}, diagnostics: [] })).toEqual([]);
  });
});
