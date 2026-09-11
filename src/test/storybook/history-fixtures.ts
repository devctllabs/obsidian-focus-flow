import { closedSprint } from './fixtures';

// Illustrative, deterministic report data; never persisted to a user's vault.
export const reportSprints = Array.from({ length: 8 }, (_, index) => {
  const sequence = index + 1;
  const start = new Date(Date.UTC(2026, 6, 13 + index * 7));
  const end = new Date(Date.UTC(2026, 6, 19 + index * 7));
  const startsOn = start.toISOString().slice(0, 10);
  const dueOn = end.toISOString().slice(0, 10);
  const completed = [8, 12, 9, 15, 11, 14, 10, 17][index]!;
  const achieved = [2, 3, 2, 4, 3, 3, 2, 3][index]!;
  return {
    ...closedSprint,
    id: `preview-closed-${sequence}`,
    code: `SPR-${String(sequence).padStart(3, '0')}`,
    sequence, startsOn, dueOn,
    closedAt: `${dueOn}T18:00:00Z`,
    path: `Focus Flow/Sprints/SPR-${String(sequence).padStart(3, '0')}.md`,
    closeSnapshot: {
      ...closedSprint.closeSnapshot,
      capturedAt: `${dueOn}T18:00:00Z`,
      stories: ['Make room for focused work', 'Build a repeatable weekly review', 'Keep commitments visible', 'Simplify the capture habit'].map((title, storyIndex) => ({
        ...closedSprint.closeSnapshot.stories[0]!, id: `preview-outcome-${storyIndex}`, key: `FF-${42 + storyIndex}`, title,
        outcome: storyIndex < achieved ? 'achieved' as const : 'not_achieved' as const,
      })),
      summary: { ...closedSprint.closeSnapshot.summary, attemptedStories: 4, achievedStories: achieved, notAchievedStories: 4 - achieved, storiesAtStart: 4, storiesAtClose: 4, completedDuringSprint: completed, committedOpenTasks: completed + 3, tasksAtStart: completed + 3, tasksAtClose: completed + 3, openAtClose: 3 },
      effectiveTagSummary: [{ tag: 'deep-work', completedTasks: Math.ceil(completed * .65) }, { tag: 'weekly-review', completedTasks: Math.ceil(completed * .45) }, { tag: 'learning', completedTasks: Math.ceil(completed * .25) }, { tag: 'personal', completedTasks: 2 }],
    },
    retrospectiveItems: [
      { kind: 'win' as const, text: 'Protected mornings made room for the work that mattered.' },
      { kind: 'friction' as const, text: 'Small incoming requests fragmented the afternoons.' },
      { kind: 'improvement' as const, text: 'Keep one afternoon free of meetings next Sprint.' },
    ],
  };
});
