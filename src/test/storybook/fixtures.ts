import type { ProjectedManagedEntity } from '../../application/indexing/work-index';

export const epic = {
  id: '019946c9-5f97-7196-8483-73469275ff90',
  key: 'FF-40',
  title: 'Build a calmer system',
  type: 'epic' as const,
  lifecycle: 'backlog' as const,
  backlogRank: 'a0',
  acceptanceCriteria: [
    { text: 'The system supports a weekly review', checked: true },
  ],
  createdAt: '2026-08-30T08:30:00Z',
  tags: ['focus'],
  effectiveTags: ['focus'],
  path: 'Focus Flow/Epics/FF-40 Build a calmer system.md',
} satisfies ProjectedManagedEntity;

export const secondEpic = {
  ...epic,
  id: '01994710-2d87-7f10-9df8-8150e5543241',
  key: 'FF-47',
  title: 'Make reviews repeatable',
  backlogRank: 'a1',
  path: 'Focus Flow/Epics/FF-47 Make reviews repeatable.md',
} satisfies ProjectedManagedEntity;

export const story = {
  id: '019946f1-8d2a-7f05-87b1-1eebbb476300',
  key: 'FF-42',
  title: 'Improve weekly focus',
  type: 'story' as const,
  lifecycle: 'backlog' as const,
  epicId: epic.id,
  epicLink: '[[Focus Flow/Epics/FF-40 Build a calmer system]]',
  backlogRank: 'a0',
  sprintId: null,
  sprintRank: null,
  acceptanceCriteria: [
    { text: 'Weekly priorities are visible', checked: true },
  ],
  createdAt: '2026-08-30T09:00:00Z',
  tags: [],
  effectiveTags: ['focus'],
  path: 'Focus Flow/Stories/FF-42 Improve weekly focus.md',
} satisfies ProjectedManagedEntity;

export const secondStory = {
  ...story,
  id: '019946f1-8d2a-7f05-87b1-1eebbb476301',
  key: 'FF-45',
  title: 'Summarize review notes',
  backlogRank: 'a1',
  path: 'Focus Flow/Stories/FF-45 Summarize review notes.md',
} satisfies ProjectedManagedEntity;

export const task = {
  id: '01994706-857c-76f1-8006-85cd9bd80890',
  key: 'FF-43',
  title: 'Draft the review',
  type: 'task' as const,
  lifecycle: 'active' as const,
  storyId: story.id,
  storyLink: '[[Focus Flow/Stories/FF-42 Improve weekly focus]]',
  taskRank: 'a0',
  status: 'todo' as const,
  startedAt: null,
  completedAt: null,
  createdAt: '2026-08-30T09:15:00Z',
  tags: [],
  effectiveTags: ['focus'],
  path: 'Focus Flow/Tasks/FF-43 Draft the review.md',
} satisfies ProjectedManagedEntity;

export const secondTask = {
  ...task,
  id: '01994706-857c-76f1-8006-85cd9bd80891',
  key: 'FF-44',
  title: 'Verify the weekly signal',
  taskRank: 'a1',
  status: 'today' as const,
  path: 'Focus Flow/Tasks/FF-44 Verify the weekly signal.md',
} satisfies ProjectedManagedEntity;

export const doneTask = {
  ...task,
  id: '01994706-857c-76f1-8006-85cd9bd80892',
  key: 'FF-45',
  title: 'Archive the prior review',
  lifecycle: 'done' as const,
  status: 'done' as const,
  completedAt: '2026-08-23T18:00:00Z',
  path: 'Focus Flow/Tasks/FF-45 Archive the prior review.md',
} satisfies ProjectedManagedEntity;

export const candidate = {
  id: '01994770-0000-7000-8000-000000000001',
  key: 'FF-48',
  title: 'Explore calmer handoffs',
  type: 'candidate' as const,
  lifecycle: 'inbox' as const,
  createdAt: '2026-08-30T12:00:00Z',
  tags: ['idea'],
  effectiveTags: ['idea'],
  path: 'Focus Flow/Inbox/FF-48 Explore calmer handoffs.md',
} satisfies ProjectedManagedEntity;

export const distraction = {
  ...candidate,
  lifecycle: 'rejected' as const,
  rejectedAt: '2026-08-30T13:00:00Z',
  rejectionReason: 'Interesting, but not aligned with the Mission.',
  path: 'Focus Flow/Distractions/FF-48 Explore calmer handoffs.md',
} satisfies ProjectedManagedEntity;

const sprintId = '01994744-a401-759a-b582-4418f2f2405f';

export const draftSprint = {
  id: sprintId,
  type: 'sprint' as const,
  lifecycle: 'draft' as const,
  path: 'Focus Flow/Sprints/DRAFT.md',
} satisfies ProjectedManagedEntity;

export const draftStory = {
  ...story,
  lifecycle: 'draft_sprint' as const,
  sprintId,
  sprintRank: 'a0',
} satisfies ProjectedManagedEntity;

export const activeSprint = {
  id: sprintId,
  type: 'sprint' as const,
  lifecycle: 'active' as const,
  code: 'SPR-001',
  sequence: 1,
  startsOn: '2026-08-24',
  dueOn: '2026-08-30',
  startedAt: '2026-08-24T08:30:00Z',
  provisionalStoryOutcomes: [],
  startSnapshot: {
    capturedAt: '2026-08-24T08:30:00Z',
    stories: [
      {
        id: story.id,
        key: story.key,
        title: story.title,
        epicId: story.epicId,
        sprintRank: 'a0',
        acceptanceCriteriaHash: `sha256:${'0'.repeat(64)}`,
        acceptanceCriteria: story.acceptanceCriteria,
        effectiveTags: story.effectiveTags,
        tasks: [
          {
            id: task.id,
            key: task.key,
            title: task.title,
            taskRank: task.taskRank,
            status: 'done' as const,
            completedBeforeSprint: true,
            effectiveTags: task.effectiveTags,
          },
        ],
      },
    ],
  },
  closedAt: null,
  closeSnapshot: null,
  pendingClose: null,
  path: 'Focus Flow/Sprints/SPR-001.md',
} satisfies ProjectedManagedEntity;

export const activeStory = {
  ...draftStory,
  lifecycle: 'active_sprint' as const,
} satisfies ProjectedManagedEntity;

export const closedSprint = {
  ...activeSprint,
  lifecycle: 'closed' as const,
  closedAt: '2026-08-30T18:00:00Z',
  closeSnapshot: {
    operationId: '01994a8a-0371-7a2d-a3e9-247990391600',
    capturedAt: '2026-08-30T18:00:00Z',
    stories: [
      {
        id: story.id,
        key: story.key,
        title: story.title,
        epicId: story.epicId,
        outcome: 'achieved' as const,
        evidence: 'Verified.',
        acceptanceExceptionReason: null,
        acceptanceCriteria: story.acceptanceCriteria,
        effectiveTags: story.effectiveTags,
      },
    ],
    tasks: [],
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
      tasksAtClose: 0,
      tasksAdded: 0,
      tasksRemoved: 0,
      completedDuringSprint: 1,
      openAtClose: 0,
      exceptionCount: 0,
    },
    effectiveTagSummary: [{ tag: 'focus', completedTasks: 1 }],
  },
  retrospectiveItems: [
    { kind: 'improvement' as const, text: 'Automate the review checklist' },
  ],
} satisfies ProjectedManagedEntity;

export const readyFocusEntities = [
  activeSprint,
  activeStory,
  secondTask,
  doneTask,
] satisfies readonly ProjectedManagedEntity[];

export const readyPlanEntities = [
  task,
  story,
  secondStory,
  secondEpic,
  epic,
] satisfies readonly ProjectedManagedEntity[];
