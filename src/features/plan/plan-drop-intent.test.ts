import { describe, expect, it } from 'vitest';
import { createPlanDropIntent } from './plan-drop-intent';

describe('createPlanDropIntent', () => {
  it('maps Month to Active Sprint and Active Sprint to Month with exact neighbours', () => {
    const lists = {
      monthIds: ['month-a', 'month-b'],
      sprintIds: ['sprint-a', 'sprint-b'],
      sprintLifecycle: 'active' as const,
    };

    expect(createPlanDropIntent({ storyId: 'month-a', initialGroup: 'month', targetGroup: 'sprint', targetIndex: 1, lists })).toEqual({
      kind: 'add-active-story',
      storyId: 'month-a',
      position: { beforeStoryId: 'sprint-a', afterStoryId: 'sprint-b' },
    });
    expect(createPlanDropIntent({ storyId: 'sprint-a', initialGroup: 'sprint', targetGroup: 'month', targetIndex: 2, lists })).toEqual({
      kind: 'remove-active-story',
      storyId: 'sprint-a',
      position: { beforeStoryId: 'month-b', afterStoryId: null },
    });
  });

  it('keeps same-list movement as an ordinary reorder', () => {
    expect(createPlanDropIntent({ storyId: 'month-a', initialGroup: 'month', targetGroup: 'month', targetIndex: 1, lists: {
      monthIds: ['month-a', 'month-b'],
      sprintIds: [],
      sprintLifecycle: null,
    } })).toEqual({ kind: 'reorder', storyId: 'month-a', targetIndex: 1 });
  });
});
