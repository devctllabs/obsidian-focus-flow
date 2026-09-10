import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { buildReviewHistory } from '../../application/history/review-history';
import { closedSprint } from '../../test/storybook/fixtures';
import { historyReports } from './history-reports';
import { ReportVisuals } from './ReportVisuals';
import { TagCatalogService } from '../../application/tags/tag-catalog';
import { TagCatalogProvider } from '../ui/TagCatalog';

it('recolors historical tag bars live without changing captured facts', async () => {
  let markdown: string | null = null;
  const catalog = new TagCatalogService({ read: async () => markdown, update: async (transform) => { markdown = transform(markdown); } });
  const reviews = historyReports(buildReviewHistory([closedSprint]), 'sprint')[0]!.reviews;
  const original = JSON.stringify(reviews);
  const tag = reviews[0]!.sprint.closeSnapshot.effectiveTagSummary[0]!.tag;
  render(<TagCatalogProvider service={catalog}><ReportVisuals reviews={reviews} /></TagCatalogProvider>);
  const row = screen.getByText(tag).closest('li')!;
  const bar = row.querySelector('.focus-flow__tag-bar > span')!;
  expect(bar).not.toHaveStyle({ backgroundColor: '#6750A4' });
  await act(() => catalog.upsert(tag, { color: '#6750A4' }));
  expect(bar).toHaveStyle({ backgroundColor: '#6750A4' });
  expect(JSON.stringify(reviews)).toBe(original);
  await act(() => catalog.upsert(tag, { color: null }));
  expect(bar).not.toHaveStyle({ backgroundColor: '#6750A4' });
});

it('makes the counted entity explicit without mixing Tasks, Stories and Epics', async () => {
  const user = userEvent.setup();
  const reviews = historyReports(buildReviewHistory([closedSprint]), 'sprint')[0]!.reviews;
  const review = reviews[0]!;
  const story = review.stories[0]!;
  render(<ReportVisuals reviews={[{ ...review,
    stories: [
      { ...story, outcome: 'achieved', effectiveTags: ['focus', 'focus'] },
      { ...story, id: 'second-story', outcome: 'achieved', effectiveTags: ['focus'] },
      { ...story, id: 'unfinished-story', outcome: 'not_achieved', effectiveTags: ['focus'] },
    ],
    finalizedEpics: [{ id: 'epic', key: 'FF-1', title: 'A finished Epic', lifecycle: 'done', finalizedAt: review.sprint.closedAt, path: 'Epics/FF-1.md', tags: ['focus', 'focus'] }],
    sprint: { ...review.sprint, closeSnapshot: { ...review.sprint.closeSnapshot, effectiveTagSummary: [{ tag: 'focus', completedTasks: 7 }] } },
  }]} />);
  expect(screen.getByRole('region', { name: 'Completed Tasks by Effective Tag' })).toBeInTheDocument();
  expect(within(screen.getByRole('region', { name: 'Completed Tasks by Effective Tag' })).getByRole('listitem')).toHaveTextContent('focus7');
  await user.click(screen.getByRole('button', { name: 'Stories' }));
  expect(screen.getByRole('region', { name: 'Achieved Story Attempts by Effective Tag' })).toBeInTheDocument();
  expect(within(screen.getByRole('region', { name: 'Achieved Story Attempts by Effective Tag' })).getByRole('listitem')).toHaveTextContent('focus2');
  await user.click(screen.getByRole('button', { name: 'Epics' }));
  expect(screen.getByRole('region', { name: 'Completed Epics by own tag' })).toBeInTheDocument();
  expect(within(screen.getByRole('region', { name: 'Completed Epics by own tag' })).getByRole('listitem')).toHaveTextContent('focus1');
  expect(screen.getByText(/current note tags/i)).toBeInTheDocument();
});
