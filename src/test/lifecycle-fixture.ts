import type { SprintClosePlan } from '../domain/sprint-close';

const sprintId = '01994744-a401-759a-b582-4418f2f2405f';
const sprintPath = 'Focus Flow/Sprints/SPR-014.md';
const storyPath = 'Focus Flow/Stories/FF-42 Continue.md';
const taskPath = 'Focus Flow/Tasks/FF-43 Promote me.md';

export function closePlanFixture(): SprintClosePlan {
  return {
    operationId: '01994a8a-0371-7a2d-a3e9-247990391600',
    decisionsHash: 'sha256:reviewed',
    capturedAt: '2026-08-30T18:00:00Z',
    sprintId,
    sprintPath,
    stories: [
      {
        id: '019946f1-8d2a-7f05-87b1-1eebbb476300',
        path: storyPath,
        expectedSprintRank: 'a0',
        outcome: 'not_achieved',
        evidence: 'Needs another Sprint.',
        acceptanceExceptionReason: null,
        backlogRank: 'a1',
      },
    ],
    tasks: [
      {
        id: '01994706-857c-76f1-8006-85cd9bd80890',
        path: taskPath,
        expectedStoryId: '019946f1-8d2a-7f05-87b1-1eebbb476300',
        expectedStatus: 'in_progress',
        resolution: 'reclassify',
        targetStoryId: null,
        targetStoryLink: null,
        targetEpicId: '019946c9-5f97-7196-8483-73469275ff90',
        targetEpicLink: '[[Focus Flow/Epics/FF-40 Product]]',
        targetRank: 'a2',
        continuationContext: null,
      },
    ],
    delta: {
      addedStories: [],
      removedStories: [],
      addedTasks: [],
      removedTasks: [],
      changedAcceptanceCriteriaStories: [],
    },
    closeSnapshot: {
      operationId: '01994a8a-0371-7a2d-a3e9-247990391600',
      capturedAt: '2026-08-30T18:00:00Z',
      stories: [
        {
          id: '019946f1-8d2a-7f05-87b1-1eebbb476300',
          key: 'FF-42',
          title: 'Continue',
          epicId: '019946c9-5f97-7196-8483-73469275ff90',
          outcome: 'not_achieved',
          evidence: 'Needs another Sprint.',
          acceptanceExceptionReason: null,
          acceptanceCriteria: [{ text: 'Done', checked: false }],
          effectiveTags: ['product/focus-flow'],
        },
      ],
      tasks: [
        {
          id: '01994706-857c-76f1-8006-85cd9bd80890',
          key: 'FF-43',
          title: 'Promote me',
          storyId: '019946f1-8d2a-7f05-87b1-1eebbb476300',
          status: 'in_progress',
          startedAt: '2026-08-28T09:00:00Z',
          completedAt: null,
          effectiveTags: ['product/focus-flow'],
          resolution: 'reclassify',
          targetStoryId: null,
          targetEpicId: '019946c9-5f97-7196-8483-73469275ff90',
          continuationContext: null,
        },
      ],
      summary: {
        attemptedStories: 1,
        storiesAtStart: 1,
        storiesAtClose: 1,
        storiesAdded: 0,
        storiesRemoved: 0,
        achievedStories: 0,
        notAchievedStories: 1,
        closedStories: 0,
        committedOpenTasks: 1,
        tasksAtStart: 1,
        tasksAtClose: 1,
        tasksAdded: 0,
        tasksRemoved: 0,
        completedDuringSprint: 0,
        openAtClose: 1,
        exceptionCount: 0,
      },
      effectiveTagSummary: [],
    },
    retrospective: { wins: [], friction: [], improvements: [] },
  };
}
