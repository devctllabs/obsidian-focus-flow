import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WorkTitleButton } from './WorkTitleButton';

describe('work tags', () => {
  it('shows compact own and inherited tags without changing the note action', () => {
    render(<WorkTitleButton item={{ key: 'FF-1', title: 'Review', path: 'Review.md', tags: ['weekly'], effectiveTags: ['focus', 'weekly', 'writing'] }} />);
    const note = screen.getByRole('button', { name: 'Open FF-1 Review' });
    expect(screen.getByText('#weekly')).toBeInTheDocument();
    expect(screen.getByText('#focus')).toBeInTheDocument();
    expect(screen.getByText('+1')).toBeInTheDocument();
    expect(note).toHaveAttribute('aria-description', 'Tags: #weekly, #focus, #writing');
  });
});
