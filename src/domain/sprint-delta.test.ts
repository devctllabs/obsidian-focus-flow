import { describe, expect, it } from 'vitest';
import { deriveSprintDelta, isEmptySprintDelta } from './sprint-delta';

describe('Sprint Delta', () => {
  it('derives Story and Task membership from the Start and Close boundaries', () => {
    const delta = deriveSprintDelta(
      {
        stories: [
          {
            id: 'story-1',
            key: 'FF-1',
            title: 'First Story',
            acceptanceCriteria: [{ text: 'Works on mobile', checked: false }],
          },
        ],
        tasks: [{ id: 'task-1', key: 'FF-2', title: 'First Task' }],
      },
      {
        stories: [
          {
            id: 'story-1',
            key: 'FF-1',
            title: 'First Story',
            acceptanceCriteria: [{ text: 'Works on mobile', checked: true }],
          },
          {
            id: 'story-2',
            key: 'FF-3',
            title: 'Second Story',
            acceptanceCriteria: [],
          },
        ],
        tasks: [{ id: 'task-2', key: 'FF-4', title: 'Second Task' }],
      },
    );

    expect(delta).toEqual({
      addedStories: [
        {
          id: 'story-2',
          key: 'FF-3',
          title: 'Second Story',
          acceptanceCriteria: [],
        },
      ],
      removedStories: [],
      addedTasks: [{ id: 'task-2', key: 'FF-4', title: 'Second Task' }],
      removedTasks: [{ id: 'task-1', key: 'FF-2', title: 'First Task' }],
      changedAcceptanceCriteriaStories: [],
    });
    expect(isEmptySprintDelta(delta)).toBe(false);
  });

  it('treats criterion text and order as scope while ignoring checkbox progress', () => {
    const start = {
      stories: [
        {
          id: 'story-1',
          key: 'FF-1',
          title: 'First Story',
          acceptanceCriteria: [
            { text: 'First', checked: false },
            { text: 'Second', checked: false },
          ],
        },
      ],
      tasks: [],
    };

    expect(
      deriveSprintDelta(start, {
        stories: [
          {
            id: 'story-1',
            key: 'FF-1',
            title: 'First Story',
            acceptanceCriteria: [
              { text: 'Second', checked: true },
              { text: 'First', checked: true },
            ],
          },
        ],
        tasks: [],
      }).changedAcceptanceCriteriaStories.map((story) => story.id),
    ).toEqual(['story-1']);

    expect(
      isEmptySprintDelta(
        deriveSprintDelta(start, {
          stories: [
            {
              id: 'story-1',
              key: 'FF-1',
              title: 'First Story',
              acceptanceCriteria: [
                { text: 'First', checked: true },
                { text: 'Second', checked: true },
              ],
            },
          ],
          tasks: [],
        }),
      ),
    ).toBe(true);
  });
});
