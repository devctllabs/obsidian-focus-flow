import type { SprintClosePlan, SprintCloseSnapshot } from '../../domain/sprint-close';

export function serializePlan(plan: SprintClosePlan) {
  return {
    operation_id: plan.operationId,
    decisions_hash: plan.decisionsHash,
    captured_at: plan.capturedAt,
    sprint_id: plan.sprintId,
    sprint_path: plan.sprintPath,
    stories: plan.stories.map((story) => ({
      id: story.id,
      path: story.path,
      expected_sprint_rank: story.expectedSprintRank,
      outcome: story.outcome,
      evidence: story.evidence,
      acceptance_exception_reason: story.acceptanceExceptionReason,
      backlog_rank: story.backlogRank,
    })),
    tasks: plan.tasks.map((task) => ({
      id: task.id,
      path: task.path,
      expected_story_id: task.expectedStoryId,
      expected_status: task.expectedStatus,
      resolution: task.resolution,
      target_story_id: task.targetStoryId,
      target_story_link: task.targetStoryLink,
      target_epic_id: task.targetEpicId,
      target_epic_link: task.targetEpicLink,
      target_rank: task.targetRank,
      continuation_context: task.continuationContext,
    })),
    delta: serializeDelta(plan.delta),
    close_snapshot: serializeSnapshot(plan.closeSnapshot),
    retrospective: plan.retrospective,
  };
}

export function serializeSnapshot(snapshot: SprintCloseSnapshot) {
  return {
    operation_id: snapshot.operationId,
    captured_at: snapshot.capturedAt,
    stories: snapshot.stories.map((story) => ({
      id: story.id,
      key: story.key,
      title: story.title,
      epic_id: story.epicId,
      outcome: story.outcome,
      evidence: story.evidence,
      acceptance_exception_reason: story.acceptanceExceptionReason,
      acceptance_criteria: story.acceptanceCriteria,
      effective_tags: story.effectiveTags,
    })),
    tasks: snapshot.tasks.map((task) => ({
      id: task.id,
      key: task.key,
      title: task.title,
      story_id: task.storyId,
      status: task.status,
      started_at: task.startedAt,
      completed_at: task.completedAt,
      effective_tags: task.effectiveTags,
      resolution: task.resolution,
      target_story_id: task.targetStoryId,
      target_epic_id: task.targetEpicId,
      continuation_context: task.continuationContext,
    })),
    summary: {
      attempted_stories: snapshot.summary.attemptedStories,
      stories_at_start: snapshot.summary.storiesAtStart,
      stories_at_close: snapshot.summary.storiesAtClose,
      stories_added: snapshot.summary.storiesAdded,
      stories_removed: snapshot.summary.storiesRemoved,
      achieved_stories: snapshot.summary.achievedStories,
      not_achieved_stories: snapshot.summary.notAchievedStories,
      closed_stories: snapshot.summary.closedStories,
      committed_open_tasks: snapshot.summary.committedOpenTasks,
      tasks_at_start: snapshot.summary.tasksAtStart,
      tasks_at_close: snapshot.summary.tasksAtClose,
      tasks_added: snapshot.summary.tasksAdded,
      tasks_removed: snapshot.summary.tasksRemoved,
      completed_during_sprint: snapshot.summary.completedDuringSprint,
      open_at_close: snapshot.summary.openAtClose,
      exception_count: snapshot.summary.exceptionCount,
    },
    effective_tag_summary: snapshot.effectiveTagSummary.map((entry) => ({
      tag: entry.tag,
      completed_tasks: entry.completedTasks,
    })),
  };
}

function serializeDelta(delta: SprintClosePlan['delta']) {
  const story = (entry: SprintClosePlan['delta']['addedStories'][number]) => ({
    id: entry.id,
    key: entry.key,
    title: entry.title,
    acceptance_criteria: entry.acceptanceCriteria,
  });
  const task = (entry: SprintClosePlan['delta']['addedTasks'][number]) => ({
    id: entry.id,
    key: entry.key,
    title: entry.title,
  });
  return {
    added_stories: delta.addedStories.map(story),
    removed_stories: delta.removedStories.map(story),
    added_tasks: delta.addedTasks.map(task),
    removed_tasks: delta.removedTasks.map(task),
    changed_acceptance_criteria_stories:
      delta.changedAcceptanceCriteriaStories.map(story),
  };
}
