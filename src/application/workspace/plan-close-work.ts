import type { SprintClosePlan } from '../../domain/sprint-close';
import type { ManagedReplacement, ManagedState } from '../../domain/managed-replacement';
import { planArchive } from './plan-archive';

export function planCloseWork(root: string, notes: readonly ManagedState[], plan: SprintClosePlan): ManagedReplacement[] {
  const changes: ManagedReplacement[] = [];
  for (const story of plan.stories) {
    changes.push(closeStory(sourceNote(notes, story.id, story.path), story, plan));
  }
  for (const task of plan.tasks) {
    changes.push(closeTask(root, sourceNote(notes, task.id, task.path), task, plan));
  }
  return planArchive(root, notes, changes);
}

type StoryClose = SprintClosePlan['stories'][number];
type TaskClose = SprintClosePlan['tasks'][number];

function sourceNote(notes: readonly ManagedState[], id: string, path: string): ManagedState {
  const matches = notes.filter((note) => note.managed.id === id);
  if (matches.length !== 1 || matches[0]!.path !== path) throw new Error('Work changed after close review. Refresh and review this Sprint again.');
  return matches[0]!;
}

function closeStory(before: ManagedState, story: StoryClose, plan: SprintClosePlan): ManagedReplacement {
  const managed = { ...before.managed };
  if (!storyMatchesClose(managed, story, plan.sprintId)) throw new Error('Story changed after close review.');
  for (const field of ['sprint_id', 'sprint_rank', 'completed_at', 'closed_at', 'outcome', 'acceptance_exception_reason', 'close_reason', 'backlog_rank']) delete managed[field];
  applyStoryOutcome(managed, story, plan.capturedAt);
  return { id: story.id, before, after: { path: before.path, managed } };
}

function storyMatchesClose(managed: Record<string, unknown>, story: StoryClose, sprintId: string): boolean {
  return managed.type === 'story' && managed.lifecycle === 'active_sprint' && managed.sprint_id === sprintId && managed.sprint_rank === story.expectedSprintRank;
}

function applyStoryOutcome(managed: Record<string, unknown>, story: StoryClose, capturedAt: string): void {
  if (story.outcome === 'not_achieved') {
    managed.lifecycle = 'backlog'; managed.backlog_rank = story.backlogRank;
  } else if (story.outcome === 'achieved') {
    managed.lifecycle = 'done'; managed.completed_at = capturedAt; managed.outcome = 'achieved'; managed.acceptance_exception_reason = story.acceptanceExceptionReason;
  } else {
    managed.lifecycle = 'closed'; managed.closed_at = capturedAt; managed.outcome = 'closed'; managed.close_reason = story.evidence;
  }
}

function closeTask(root: string, before: ManagedState, task: TaskClose, plan: SprintClosePlan): ManagedReplacement {
  const managed = { ...before.managed };
  if (!taskMatchesClose(managed, task)) throw new Error('Task changed after close review.');
  const path = applyTaskResolution({ root, path: before.path, managed, task, capturedAt: plan.capturedAt });
  return { id: task.id, before, after: { path, managed } };
}

function taskMatchesClose(managed: Record<string, unknown>, task: TaskClose): boolean {
  return managed.type === 'task' && managed.lifecycle === 'active' && managed.story_id === task.expectedStoryId && managed.status === task.expectedStatus;
}

function applyTaskResolution({ root, path, managed, task, capturedAt }: { root: string; path: string; managed: Record<string, unknown>; task: TaskClose; capturedAt: string }): string {
  if (task.resolution === 'reclassify') return reclassifyTask(root, path, managed, task);
  if (task.resolution === 'irrelevant') {
    managed.lifecycle = 'closed'; managed.closed_at = capturedAt; managed.resolution = 'irrelevant';
    return path;
  }
  managed.lifecycle = 'active'; managed.status = continuedStatus(task.expectedStatus); managed.completed_at = null;
  managed.story_id = task.targetStoryId; managed.story_link = task.targetStoryLink; managed.task_rank = task.targetRank; managed.continuation_context = task.continuationContext;
  delete managed.closed_at; delete managed.resolution;
  return path;
}

function reclassifyTask(root: string, path: string, managed: Record<string, unknown>, task: TaskClose): string {
  managed.type = 'story'; managed.lifecycle = 'backlog'; managed.epic_id = task.targetEpicId; managed.epic_link = task.targetEpicLink; managed.backlog_rank = task.targetRank;
  for (const field of ['story_id', 'story_link', 'task_rank', 'status', 'started_at', 'completed_at', 'closed_at', 'resolution', 'continuation_context']) delete managed[field];
  return `${root}/Stories/${path.split('/').at(-1)!}`;
}

function continuedStatus(status: string): string {
  return ['external_in_progress', 'on_hold'].includes(status) ? status : 'todo';
}
