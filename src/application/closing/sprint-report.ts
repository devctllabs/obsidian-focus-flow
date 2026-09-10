import type { SprintCloseSnapshot } from '../../domain/sprint-close';
import type { RetrospectiveDraft } from '../../domain/sprint-close';
import type { SprintDelta } from '../../domain/sprint-delta';
import { findMarkdownHeadings, sectionEnd } from '../../domain/markdown-sections';

export const REPORT_START = '<!-- focus-flow:report:start -->';
export const REPORT_END = '<!-- focus-flow:report:end -->';
const RETROSPECTIVE_TITLES = ['Wins', 'Friction', 'Improvements'] as const;

export function renderSprintReport(
  sprintCode: string,
  snapshot: SprintCloseSnapshot,
  delta: SprintDelta,
): string {
  const { summary } = snapshot;
  const storyLines = snapshot.stories.map(
    (story) =>
      `- ${story.key} ${story.title}: ${outcomeLabel(story.outcome)}${
        story.acceptanceExceptionReason
          ? ` — exception: ${story.acceptanceExceptionReason}`
          : ''
      }`,
  );
  const taskLines = snapshot.tasks.map((task) => {
    const elapsed = elapsedLabel(task.startedAt, task.completedAt);
    return `- ${task.key} ${task.title}: ${task.resolution} — ${elapsed}`;
  });
  const deltaLines = [
    ...delta.addedStories.map((story) => deltaLine('Story added', story)),
    ...delta.removedStories.map((story) => deltaLine('Story removed', story)),
    ...delta.addedTasks.map((task) => deltaLine('Task added', task)),
    ...delta.removedTasks.map((task) => deltaLine('Task removed', task)),
    ...delta.changedAcceptanceCriteriaStories.map((story) =>
      deltaLine('Acceptance Criteria changed', story),
    ),
  ];
  const tagLines = snapshot.effectiveTagSummary.map(
    (entry) => `- ${entry.tag}: ${entry.completedTasks}`,
  );

  return `## Sprint report

### ${sprintCode} summary

- Stories achieved: ${summary.achievedStories} / ${summary.attemptedStories}
- Stories at start / close: ${summary.storiesAtStart} / ${summary.storiesAtClose}
- Stories not achieved: ${summary.notAchievedStories}
- Stories closed: ${summary.closedStories}
- Committed open Tasks at start: ${summary.committedOpenTasks}
- Tasks at start / close: ${summary.tasksAtStart} / ${summary.tasksAtClose}
- Tasks completed during Sprint: ${summary.completedDuringSprint}
- Open Tasks at close: ${summary.openAtClose}
- Acceptance Criteria exceptions: ${summary.exceptionCount}

### Story outcomes

${storyLines.length > 0 ? storyLines.join('\n') : '- None'}

### Task elapsed time

${taskLines.length > 0 ? taskLines.join('\n') : '- None'}
${deltaLines.length > 0 ? `\n\n### Sprint Delta\n\n${deltaLines.join('\n')}` : ''}

### Effective Tags

${tagLines.length > 0 ? tagLines.join('\n') : '- None'}`;
}

function deltaLine(
  label: string,
  item: { key: string; title: string },
): string {
  return `- ${label}: ${item.key} ${item.title}`;
}

export function replaceManagedSprintReport(
  body: string,
  report: string,
  retrospectiveTemplate: string,
): string {
  const managed = `${REPORT_START}\n${report.trim()}\n${REPORT_END}`;
  const start = body.indexOf(REPORT_START);
  const end = body.indexOf(REPORT_END, start + REPORT_START.length);
  if ((start >= 0) !== (end >= 0)) {
    throw new Error('Sprint report markers are incomplete.');
  }
  if (start >= 0 && end >= 0) {
    return `${body.slice(0, start)}${managed}${body.slice(end + REPORT_END.length)}`;
  }

  const lines = body.split(/\r?\n/);
  const hasRetrospectiveSection = RETROSPECTIVE_TITLES.some(
    (title) => findMarkdownHeadings(lines, title).length > 0,
  );
  const suffix = hasRetrospectiveSection ? '' : retrospectiveTemplate.trim();
  return `${body.trimEnd()}\n\n${managed}${suffix === '' ? '' : `\n\n${suffix}`}\n`;
}

export function replaceRetrospectiveItems(
  body: string,
  retrospective: RetrospectiveDraft,
): string {
  const sections: Array<[string, readonly string[]]> = [
    ['Wins', retrospective.wins],
    ['Friction', retrospective.friction],
    ['Improvements', retrospective.improvements],
  ];
  let lines = body.split(/\r?\n/);
  for (const [title, items] of sections) {
    if (items.length === 0) continue;
    const heading = findMarkdownHeadings(lines, title)[0];
    if (heading === undefined) continue;
    const end = sectionEnd(lines, heading.index, heading.level);
    const rendered = items.map((item) => `- ${item.replace(/\r?\n/g, '\n  ')}`);
    lines = [
      ...lines.slice(0, heading.index + 1),
      ...rendered,
      '',
      ...lines.slice(end),
    ];
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n');
}

function outcomeLabel(outcome: SprintCloseSnapshot['stories'][number]['outcome']) {
  switch (outcome) {
    case 'achieved':
      return 'Achieved';
    case 'not_achieved':
      return 'Not achieved';
    case 'closed':
      return 'Closed';
  }
}

function elapsedLabel(startedAt: string | null, completedAt: string | null) {
  if (startedAt === null || completedAt === null) return 'not completed';
  const milliseconds = Date.parse(completedAt) - Date.parse(startedAt);
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return 'invalid dates';
  const hours = Math.round(milliseconds / 3_600_000);
  return `${hours}h`;
}
