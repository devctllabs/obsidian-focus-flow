import type { StoryPosition } from '../../application/planning/active-story-membership';

export type PlanDropIntent =
  | { kind: 'reorder'; storyId: string; targetIndex: number }
  | { kind: 'add-draft-story'; storyId: string; position: StoryPosition }
  | { kind: 'remove-draft-story'; storyId: string; position: StoryPosition }
  | { kind: 'add-active-story'; storyId: string; position: StoryPosition }
  | { kind: 'remove-active-story'; storyId: string; position: StoryPosition };

interface PlanDropLists {
  monthIds: readonly string[];
  sprintIds: readonly string[];
  sprintLifecycle: 'draft' | 'active' | null;
}

export function createPlanDropIntent(
  { storyId, initialGroup, targetGroup, targetIndex, lists }: {
    storyId: string;
    initialGroup: string;
    targetGroup: string;
    targetIndex: number;
    lists: PlanDropLists;
  },
): PlanDropIntent | null {
  if (!['month', 'sprint'].includes(initialGroup) || !['month', 'sprint'].includes(targetGroup)) return null;
  if (initialGroup === targetGroup) {
    return { kind: 'reorder', storyId, targetIndex };
  }
  if (lists.sprintLifecycle === null) return null;
  const destination = targetGroup === 'month' ? lists.monthIds : lists.sprintIds;
  const position = positionAt(destination.filter((id) => id !== storyId), targetIndex);
  if (initialGroup === 'month') {
    return {
      kind: lists.sprintLifecycle === 'active' ? 'add-active-story' : 'add-draft-story',
      storyId,
      position,
    };
  }
  return {
    kind: lists.sprintLifecycle === 'active' ? 'remove-active-story' : 'remove-draft-story',
    storyId,
    position,
  };
}

function positionAt(ids: readonly string[], index: number): StoryPosition {
  const target = Math.max(0, Math.min(index, ids.length));
  return {
    beforeStoryId: ids[target - 1] ?? null,
    afterStoryId: ids[target] ?? null,
  };
}
