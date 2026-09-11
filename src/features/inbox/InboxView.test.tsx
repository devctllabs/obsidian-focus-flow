import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ProjectedManagedEntity } from '../../application/indexing/work-index';
import { InboxView } from './InboxView';

function candidate(
  id: string,
  key: string,
  tags: string[],
): Extract<ProjectedManagedEntity, { type: 'candidate'; lifecycle: 'inbox' }> {
  return {
    id,
    key,
    title: `${key} Candidate`,
    type: 'candidate',
    lifecycle: 'inbox',
    createdAt: '2026-08-30T12:00:00Z',
    tags,
    effectiveTags: tags,
    path: `Focus Flow/Inbox/${key} Candidate.md`,
  };
}

describe('InboxView tag filtering', () => {
  it('keeps Candidate capture out of the search toolbar', () => {
    render(<InboxView entities={[]} />);
    expect(screen.getByRole('searchbox', { name: 'Search Candidates' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'New Candidate' })).not.toBeInTheDocument();
  });

  it('offers deletion for an accidental Candidate without rejecting it', async () => {
    const user = userEvent.setup();
    const note = candidate('1', 'FF-1', []);
    const onRequestDelete = vi.fn();
    const onReject = vi.fn();
    render(<InboxView entities={[note]} onRequestDelete={onRequestDelete} onReject={onReject} />);
    await user.click(screen.getByRole('button', { name: 'More actions for FF-1' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete…' }));
    expect(onRequestDelete).toHaveBeenCalledWith(note);
    expect(onReject).not.toHaveBeenCalled();
  });
  it('shows useful row context without an expand control and reviews Epic fields before accepting', async () => {
    const user = userEvent.setup();
    const onAcceptAsEpic = vi.fn();
    render(<InboxView entities={[{ ...candidate('1', 'FF-1', []), bodyFields: { Description: 'A useful thought' } }]} onAcceptAsEpic={onAcceptAsEpic} />);
    expect(screen.getByText('A useful thought')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Expand FF-1' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'More actions for FF-1' }));
    await user.click(screen.getByRole('menuitem', { name: 'Accept as Epic' }));
    expect(onAcceptAsEpic).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Intent')).toHaveValue('A useful thought');
    await user.click(screen.getByRole('button', { name: 'Create Epic' }));
    expect(onAcceptAsEpic).toHaveBeenCalledWith('1', expect.objectContaining({ title: 'FF-1 Candidate' }));
  });
  it('edits the existing Candidate title and tags in one dialog', async () => {
    const user = userEvent.setup();
    const onEditCandidate = vi.fn().mockResolvedValue(undefined);
    render(<InboxView entities={[candidate('1', 'FF-1', ['idea'])]} onEditCandidate={onEditCandidate} />);
    await user.click(screen.getByRole('button', { name: 'More actions for FF-1' }));
    await user.click(screen.getByRole('menuitem', { name: 'Edit…' }));
    expect(screen.getByLabelText('Candidate title')).toHaveValue('FF-1 Candidate');
    await user.clear(screen.getByLabelText('Candidate title'));
    await user.type(screen.getByLabelText('Candidate title'), 'A clearer intention');
    await user.click(screen.getByRole('button', { name: 'Remove tag idea' }));
    await user.type(screen.getByRole('combobox', { name: 'Tags' }), 'focus{Enter}');
    await user.type(screen.getByLabelText('Description'), 'A **clear** intention');
    await user.type(screen.getByLabelText('Entry Review'), 'Aligned with my mission');
    await user.click(screen.getByRole('button', { name: 'Add criterion' }));
    await user.type(screen.getByLabelText('Criterion 1'), 'An observable result');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(onEditCandidate).toHaveBeenCalledWith({ candidateId: '1', title: 'A clearer intention', tags: ['focus'], expectedTitle: 'FF-1 Candidate', expectedTags: ['idea'], bodyFields: { Description: 'A **clear** intention', 'Entry Review': 'Aligned with my mission', 'Acceptance Criteria': '- [ ] An observable result' }, expectedBodyFields: {} });
  });

  it('trashes a Distraction only after explicit confirmation', async () => {
    const onDeleteDistraction = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<InboxView entities={[{ ...candidate('1', 'FF-1', ['idea']), lifecycle: 'rejected', rejectedAt: '2026-09-01T12:00:00Z', rejectionReason: null }]} section="distractions" onDeleteDistraction={onDeleteDistraction} />);
    await user.click(screen.getByRole('button', { name: 'More actions for FF-1' }));
    await user.click(screen.getByRole('menuitem', { name: 'Move to trash…' }));
    expect(onDeleteDistraction).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onDeleteDistraction).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'More actions for FF-1' }));
    await user.click(screen.getByRole('menuitem', { name: 'Move to trash…' }));
    await user.click(screen.getByRole('button', { name: 'Move to trash' }));
    expect(onDeleteDistraction).toHaveBeenCalledWith('1');
  });

  it('keeps many tags behind a compact picker', async () => {
    const user = userEvent.setup();
    render(
      <InboxView
        entities={[
          candidate('1', 'FF-1', ['alpha', 'shared']),
          candidate('2', 'FF-2', ['beta', 'shared']),
          candidate('3', 'FF-3', ['gamma']),
        ]}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Filter by tags (0 active)' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Filter by tags' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Filter by tags (0 active)' }));

    const picker = screen.getByRole('dialog', { name: 'Filter by tags' });
    expect(within(picker).getByRole('checkbox', { name: '#alpha, 1 Candidate' })).toBeInTheDocument();
    expect(within(picker).getByRole('checkbox', { name: '#shared, 2 Candidates' })).toBeInTheDocument();
  });

  it('applies multiple tag filters immediately with AND semantics and clears them', async () => {
    const user = userEvent.setup();
    render(
      <InboxView
        entities={[
          candidate('1', 'FF-1', ['alpha', 'shared']),
          candidate('2', 'FF-2', ['beta', 'shared']),
          candidate('3', 'FF-3', ['alpha']),
        ]}
      />,
    );

    const trigger = screen.getByRole('button', { name: 'Filter by tags (0 active)' });
    await user.click(trigger);
    const picker = screen.getByRole('dialog', { name: 'Filter by tags' });

    await user.click(within(picker).getByRole('checkbox', { name: '#alpha, 2 Candidates' }));
    expect(screen.getByText('2 Candidates', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filter by tags (1 active)' })).toBeInTheDocument();
    expect(within(picker).getByText('Matches all selected tags')).toBeInTheDocument();

    await user.click(within(picker).getByRole('checkbox', { name: '#shared, 1 Candidate' }));
    expect(screen.getByText('1 Candidate', { selector: 'p' })).toBeInTheDocument();

    await user.click(within(picker).getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByText('3 Candidates', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filter by tags (0 active)' })).toBeInTheDocument();
  });

  it('keeps row tags passive and opens the picker from the row action menu', async () => {
    const user = userEvent.setup();
    render(<InboxView entities={[candidate('1', 'FF-1', ['alpha'])]} />);

    expect(screen.queryByRole('button', { name: '#alpha' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'More actions for FF-1' }));
    await user.click(screen.getByRole('menuitem', { name: 'Filter by tag…' }));

    const picker = screen.getByRole('dialog', { name: 'Filter by tags' });
    expect(within(picker).getByRole('checkbox', { name: '#alpha, 1 Candidate' })).toBeChecked();
  });

  it('returns focus to the trigger after Done', async () => {
    const user = userEvent.setup();
    render(<InboxView entities={[candidate('1', 'FF-1', ['alpha'])]} />);

    const trigger = screen.getByRole('button', { name: 'Filter by tags (0 active)' });
    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'Done' }));

    expect(screen.queryByRole('dialog', { name: 'Filter by tags' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('keeps active filters when the picker is reopened', async () => {
    const user = userEvent.setup();
    render(<InboxView entities={[candidate('1', 'FF-1', ['alpha'])]} />);

    const trigger = screen.getByRole('button', { name: 'Filter by tags (0 active)' });
    await user.click(trigger);
    const picker = screen.getByRole('dialog', { name: 'Filter by tags' });
    await user.click(within(picker).getByRole('checkbox', { name: '#alpha, 1 Candidate' }));
    await user.click(screen.getByRole('button', { name: 'Done' }));
    await user.click(screen.getByRole('button', { name: 'Filter by tags (1 active)' }));

    expect(within(screen.getByRole('dialog', { name: 'Filter by tags' })).getByRole('checkbox', { name: '#alpha, 1 Candidate' })).toBeChecked();
  });

  it('searches tags and disables incompatible zero-count options', async () => {
    const user = userEvent.setup();
    render(
      <InboxView
        entities={[
          candidate('1', 'FF-1', ['alpha']),
          candidate('2', 'FF-2', ['shared']),
        ]}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Filter by tags (0 active)' }));
    const picker = screen.getByRole('dialog', { name: 'Filter by tags' });
    await user.type(within(picker).getByRole('searchbox', { name: 'Find a tag' }), 'shared');
    expect(within(picker).queryByRole('checkbox', { name: '#alpha, 1 Candidate' })).not.toBeInTheDocument();
    await user.clear(within(picker).getByRole('searchbox', { name: 'Find a tag' }));
    await user.click(within(picker).getByRole('checkbox', { name: '#alpha, 1 Candidate' }));

    expect(within(picker).getByRole('checkbox', { name: '#shared, 0 Candidates' })).toBeDisabled();
  });

  it('uses the section name in the search label for Distractions', () => {
    render(
      <InboxView
        entities={[
          {
            ...candidate('1', 'FF-1', []),
            lifecycle: 'rejected',
            rejectedAt: '2026-08-31T12:00:00Z',
            rejectionReason: 'Not now',
          },
        ]}
        section="distractions"
      />,
    );

    expect(screen.getByRole('searchbox', { name: 'Search Distractions' })).toBeInTheDocument();
  });
});
