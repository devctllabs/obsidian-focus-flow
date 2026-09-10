import { describe, expect, it } from 'vitest';
import type { SprintCloseSnapshot } from '../../domain/sprint-close';
import type { SprintDelta } from '../../domain/sprint-delta';
import {
  renderSprintReport,
  replaceManagedSprintReport,
  replaceRetrospectiveItems,
} from './sprint-report';

const snapshot: SprintCloseSnapshot = {
  operationId: '01994a8a-0371-7a2d-a3e9-247990391600',
  capturedAt: '2026-08-30T18:00:00Z',
  stories: [
    {
      id: '019946f1-8d2a-7f05-87b1-1eebbb476300',
      key: 'FF-42',
      title: 'Use Focus on mobile',
      epicId: '019946c9-5f97-7196-8483-73469275ff90',
      outcome: 'achieved',
      evidence: 'Verified on mobile.',
      acceptanceExceptionReason: null,
      acceptanceCriteria: [{ text: 'Board opens', checked: true }],
      effectiveTags: ['product/focus-flow'],
    },
  ],
  tasks: [
    {
      id: '01994706-857c-76f1-8006-85cd9bd80890',
      key: 'FF-43',
      title: 'Verify mobile',
      storyId: '019946f1-8d2a-7f05-87b1-1eebbb476300',
      status: 'done',
      startedAt: '2026-08-29T09:00:00Z',
      completedAt: '2026-08-30T16:00:00Z',
      effectiveTags: ['product/focus-flow'],
      resolution: 'completed',
      targetStoryId: null,
      targetEpicId: null,
      continuationContext: null,
    },
  ],
  summary: {
    attemptedStories: 1,
    storiesAtStart: 1,
    storiesAtClose: 1,
    storiesAdded: 0,
    storiesRemoved: 0,
    achievedStories: 1,
    notAchievedStories: 0,
    closedStories: 0,
    committedOpenTasks: 1,
    tasksAtStart: 1,
    tasksAtClose: 1,
    tasksAdded: 0,
    tasksRemoved: 0,
    completedDuringSprint: 1,
    openAtClose: 0,
    exceptionCount: 0,
  },
  effectiveTagSummary: [
    { tag: 'product/focus-flow', completedTasks: 1 },
  ],
};

const emptyDelta: SprintDelta = {
  addedStories: [],
  removedStories: [],
  addedTasks: [],
  removedTasks: [],
  changedAcceptanceCriteriaStories: [],
};

describe('Sprint report', () => {
  it('renders raw outcomes, scope counts, elapsed work, and frozen tags', () => {
    const report = renderSprintReport('SPR-014', snapshot, emptyDelta);

    expect(report).toContain('## Sprint report');
    expect(report).toContain('Stories achieved: 1 / 1');
    expect(report).toContain('Tasks completed during Sprint: 1');
    expect(report).toContain('FF-43 Verify mobile: completed — 31h');
    expect(report).toContain('product/focus-flow: 1');
    expect(report).not.toContain('### Sprint Delta');
  });

  it('renders a non-empty Sprint Delta without requiring reasons', () => {
    const report = renderSprintReport('SPR-014', snapshot, {
      ...emptyDelta,
      addedTasks: [snapshot.tasks[0]!],
      changedAcceptanceCriteriaStories: [snapshot.stories[0]!],
    });

    expect(report).toContain('### Sprint Delta');
    expect(report).toContain('- Task added: FF-43 Verify mobile');
    expect(report).toContain(
      '- Acceptance Criteria changed: FF-42 Use Focus on mobile',
    );
    expect(report).not.toContain('reason');
  });

  it('regenerates only the managed report marker range', () => {
    const body = `# SPR-014

User introduction.

<!-- focus-flow:report:start -->
old generated report
<!-- focus-flow:report:end -->

## Wins
- Kept this user-authored win.

## Friction
- Kept this friction.

## Improvements
- Automate the device matrix.
`;

    const updated = replaceManagedSprintReport(
      body,
      renderSprintReport('SPR-014', snapshot, emptyDelta),
      'unused retrospective template',
    );

    expect(updated).toContain('User introduction.');
    expect(updated).toContain('- Kept this user-authored win.');
    expect(updated).toContain('- Automate the device matrix.');
    expect(updated).not.toContain('old generated report');
    expect(updated.match(/focus-flow:report:start/g)).toHaveLength(1);
  });

  it('appends the managed report and retrospective template when absent', () => {
    const updated = replaceManagedSprintReport(
      '# SPR-014\n\nPersonal notes.\n',
      renderSprintReport('SPR-014', snapshot, emptyDelta),
      '## Wins\n\n## Friction\n\n## Improvements',
    );

    expect(updated).toContain('Personal notes.');
    expect(updated).toContain('<!-- focus-flow:report:start -->');
    expect(updated).toContain('## Improvements');
  });

  it('does not append the retrospective template when canonical sections already exist', () => {
    const updated = replaceManagedSprintReport(
      `# Draft Sprint

## Wins
- good

## Friction
- bad

## Improvements
- Improve
`,
      renderSprintReport('SPR-014', snapshot, emptyDelta),
      '## Wins\n\n## Friction\n\n## Improvements',
    );

    expect(updated.match(/^## Wins$/gm)).toHaveLength(1);
    expect(updated.match(/^## Friction$/gm)).toHaveLength(1);
    expect(updated.match(/^## Improvements$/gm)).toHaveLength(1);
    expect(updated).toContain('<!-- focus-flow:report:start -->');
  });

  it('replaces items under clean retrospective headings', () => {
    const updated = replaceRetrospectiveItems(
      `# SPR-014

## Wins
- Old win.

## Friction

## Improvements
- Existing improvement.
`,
      {
        wins: ['New win.\n\n**Evidence**\n- [[Review notes]]'],
        friction: ['New friction.'],
        improvements: [],
      },
    );

    expect(updated).toContain('## Wins\n- New win.\n  \n  **Evidence**\n  - [[Review notes]]');
    expect(updated).toContain('## Friction\n- New friction.');
    expect(updated).toContain('- Existing improvement.');
    expect(updated).not.toContain('- Old win.');
  });

  it('refuses to duplicate an incomplete managed marker range', () => {
    expect(() =>
      replaceManagedSprintReport(
        `# SPR-014\n\n${'<!-- focus-flow:report:start -->'}\nbroken`,
        renderSprintReport('SPR-014', snapshot, emptyDelta),
        '',
      ),
    ).toThrow('Sprint report markers are incomplete.');
  });
});
