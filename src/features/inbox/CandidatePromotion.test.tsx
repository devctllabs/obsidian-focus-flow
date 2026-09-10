import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { candidate, epic } from '../../test/storybook/fixtures';
import { CandidatePromotion } from './CandidatePromotion';
import type { CandidateAcceptanceFields } from '../../application/work/triage-candidate';

it.each(['epic', 'story'] as const)('reviews the target %s fields before accepting a Candidate', async (target) => {
  const user = userEvent.setup();
  const onAccept = vi.fn<(fields: CandidateAcceptanceFields, epicId?: string) => Promise<unknown>>().mockResolvedValue(undefined);
  const bodyFields = { Description: 'Original **idea**', 'Entry Review': 'WANT', 'Acceptance Criteria': '- [ ] Observable' };
  render(<CandidatePromotion candidate={{ ...candidate, bodyFields }} target={target} epics={[epic]} suggestions={['idea']} onAccept={onAccept} onClose={vi.fn()} />);
  expect(screen.getByLabelText(target === 'epic' ? 'Intent' : 'Description')).toHaveValue('Original **idea**');
  expect(screen.getByLabelText('Criterion 1')).toHaveValue('Observable');
  expect(onAccept).not.toHaveBeenCalled();
  if (target === 'story') {
    await user.type(screen.getByRole('combobox', { name: 'Parent Epic' }), epic.title.slice(0, 8));
    await user.keyboard('{ArrowDown}{Enter}');
  }
  await user.click(screen.getByRole('button', { name: target === 'epic' ? 'Create Epic' : 'Create Story' }));
  expect(onAccept.mock.calls[0]![0]).toMatchObject({ title: candidate.title, tags: candidate.tags, bodyFields: target === 'epic' ? { Intent: 'Original **idea**', 'Entry Review': 'WANT' } : bodyFields });
  expect(onAccept.mock.calls[0]![1]).toBe(target === 'story' ? epic.id : undefined);
});

it('excludes finalized Epics and explains an empty search', async () => {
  const user = userEvent.setup();
  render(<CandidatePromotion candidate={candidate} target="story" epics={[epic, { ...epic, id: 'closed', title: 'Old direction', lifecycle: 'closed', backlogRank: null, completedAt: null, closedAt: '2026-09-01T00:00:00Z', closeReason: null }]} suggestions={[]} onAccept={vi.fn()} onClose={vi.fn()} />);
  await user.type(screen.getByRole('combobox', { name: 'Parent Epic' }), 'Old direction');
  expect(screen.queryByRole('option')).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('No active Epics match');
});
