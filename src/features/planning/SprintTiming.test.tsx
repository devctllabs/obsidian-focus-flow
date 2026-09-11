import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { activeSprint } from '../../test/storybook/fixtures';
import { SprintTiming } from './SprintTiming';

it('counts time since the actual start, not the planned week boundary', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-05T12:00:00Z'));
  render(<SprintTiming sprint={{ ...activeSprint, startedAt: '2026-09-02T12:00:00Z' }} />);
  expect(screen.getByText('Open 3 days')).toBeInTheDocument();
  expect(screen.getByTitle(/Planned week/)).toHaveTextContent('Open 3 days');
  vi.useRealTimers();
});
