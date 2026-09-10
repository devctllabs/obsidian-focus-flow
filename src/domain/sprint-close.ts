import type { AcceptanceCriterion, TaskStatus } from './work-note';
import type { SprintDelta } from './sprint-delta';
import type { StoryOutcome } from './sprint-note';

export type TaskCloseResolution =
  | 'completed'
  | 'continue'
  | 'move'
  | 'reclassify'
  | 'irrelevant';

export interface CloseSnapshotStory {
  id: string;
  key: string;
  title: string;
  epicId: string;
  outcome: StoryOutcome;
  evidence: string;
  acceptanceExceptionReason: string | null;
  acceptanceCriteria: readonly AcceptanceCriterion[];
  effectiveTags: readonly string[];
}

interface CloseSnapshotTask {
  id: string;
  key: string;
  title: string;
  storyId: string;
  status: TaskStatus;
  startedAt: string | null;
  completedAt: string | null;
  effectiveTags: readonly string[];
  resolution: TaskCloseResolution;
  targetStoryId: string | null;
  targetEpicId: string | null;
  continuationContext: string | null;
}

interface SprintCloseSummary {
  attemptedStories: number;
  storiesAtStart: number;
  storiesAtClose: number;
  storiesAdded: number;
  storiesRemoved: number;
  achievedStories: number;
  notAchievedStories: number;
  closedStories: number;
  committedOpenTasks: number;
  tasksAtStart: number;
  tasksAtClose: number;
  tasksAdded: number;
  tasksRemoved: number;
  completedDuringSprint: number;
  openAtClose: number;
  exceptionCount: number;
}

interface EffectiveTagCount {
  tag: string;
  completedTasks: number;
}

export interface SprintCloseSnapshot {
  operationId: string;
  capturedAt: string;
  stories: readonly CloseSnapshotStory[];
  tasks: readonly CloseSnapshotTask[];
  summary: SprintCloseSummary;
  effectiveTagSummary: readonly EffectiveTagCount[];
}

export interface StoryCloseMutation {
  id: string;
  path: string;
  expectedSprintRank: string;
  outcome: StoryOutcome;
  evidence: string;
  acceptanceExceptionReason: string | null;
  backlogRank: string | null;
}

export interface TaskCloseMutation {
  id: string;
  path: string;
  expectedStoryId: string;
  expectedStatus: TaskStatus;
  resolution: TaskCloseResolution;
  targetStoryId: string | null;
  targetStoryLink: string | null;
  targetEpicId: string | null;
  targetEpicLink: string | null;
  targetRank: string | null;
  continuationContext: string | null;
}

export interface SprintClosePlan {
  operationId: string;
  decisionsHash: string;
  capturedAt: string;
  sprintId: string;
  sprintPath: string;
  stories: readonly StoryCloseMutation[];
  tasks: readonly TaskCloseMutation[];
  delta: SprintDelta;
  closeSnapshot: SprintCloseSnapshot;
  retrospective: RetrospectiveDraft;
}

export interface RetrospectiveDraft {
  wins: readonly string[];
  friction: readonly string[];
  improvements: readonly string[];
}
