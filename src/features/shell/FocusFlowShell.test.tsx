import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FocusFlowShell } from './FocusFlowShell';

describe('FocusFlowShell', () => {
  it('keeps the top-level Candidate capture action available from Inbox', async () => {
    const user = userEvent.setup();
    const onOpenCapture = vi.fn();

    render(<FocusFlowShell mode="inbox" onModeChange={vi.fn()} onOpenCapture={onOpenCapture} />);

    expect(screen.queryByRole('button', { name: 'New Candidate' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Capture Candidate' }));
    expect(onOpenCapture).toHaveBeenCalledOnce();
  });

  it('refreshes from a named icon button with pending feedback', async () => {
    const user = userEvent.setup();
    const refresh = vi.fn();
    const view = render(<FocusFlowShell mode="inbox" onModeChange={vi.fn()} onRefresh={refresh} />);
    const button = screen.getByRole('button', { name: 'Refresh notes' });
    expect(button).toHaveTextContent(/^$/);
    expect(button).toHaveAttribute('title', 'Refresh notes');
    await user.click(button);
    expect(refresh).toHaveBeenCalledOnce();
    view.rerender(<FocusFlowShell mode="inbox" onModeChange={vi.fn()} onRefresh={refresh} refreshing />);
    expect(screen.getByRole('button', { name: 'Refreshing notes…' })).toBeDisabled();
  });
  it('shows an Inbox Candidate and offers its entry decisions', async () => {
    const user = userEvent.setup();
    const onAcceptCandidateAsEpic = vi.fn();

    render(
      <FocusFlowShell
        mode="inbox"
        onModeChange={vi.fn()}
        onAcceptCandidateAsEpic={onAcceptCandidateAsEpic}
        indexState={{
          phase: 'ready',
          diagnostics: [],
          entities: [
            {
              id: '019946e9-0ef0-7ca3-af0c-ec423d76efed',
              key: 'FF-41',
              title: 'Explore weekly focus',
              type: 'candidate',
              lifecycle: 'inbox',
              createdAt: '2026-08-30T08:45:00+04:00',
              tags: ['idea'],
              effectiveTags: ['idea'],
              path: 'Focus Flow/Inbox/FF-41 Explore weekly focus.md',
            },
          ],
        }}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Explore weekly focus' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'More actions for FF-41' }));
    expect(screen.getByRole('menuitem', { name: 'Accept as Story' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Reject' })).toBeInTheDocument();

    await user.click(
      screen.getByRole('menuitem', { name: 'Accept as Epic' }),
    );
    await user.click(screen.getByRole('button', { name: 'Create Epic' }));

    expect(onAcceptCandidateAsEpic).toHaveBeenCalledWith(
      '019946e9-0ef0-7ca3-af0c-ec423d76efed',
      expect.objectContaining({ title: 'Explore weekly focus' }),
    );
  });

  it('requires an Epic selection before accepting a Candidate as Story', async () => {
    const user = userEvent.setup();
    const onAcceptCandidateAsStory = vi.fn();
    const candidate = {
      id: '019946e9-0ef0-7ca3-af0c-ec423d76efed',
      key: 'FF-41',
      title: 'Explore weekly focus',
      type: 'candidate' as const,
      lifecycle: 'inbox' as const,
      createdAt: '2026-08-30T08:45:00+04:00',
      tags: [],
      effectiveTags: [],
      path: 'Focus Flow/Inbox/FF-41 Explore weekly focus.md',
    };
    const epic = {
      id: '019946c9-5f97-7196-8483-73469275ff90',
      key: 'FF-40',
      title: 'Build a calmer system',
      type: 'epic' as const,
      lifecycle: 'backlog' as const,
      createdAt: '2026-08-30T08:30:00+04:00',
      tags: [],
      effectiveTags: [],
      path: 'Focus Flow/Epics/FF-40 Build a calmer system.md',
      backlogRank: 'a0',
    };

    render(
      <FocusFlowShell
        mode="inbox"
        onModeChange={vi.fn()}
        onAcceptCandidateAsStory={onAcceptCandidateAsStory}
        indexState={{
          phase: 'ready',
          diagnostics: [],
          entities: [candidate, epic],
        }}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'More actions for FF-41' }));
    await user.click(screen.getByRole('menuitem', { name: 'Accept as Story' }));
    const accept = screen.getByRole('button', { name: 'Create Story' });
    expect(accept).toBeDisabled();

    await user.type(screen.getByLabelText('Parent Epic'), `${epic.title}{Enter}`);
    await user.click(accept);

    expect(onAcceptCandidateAsStory).toHaveBeenCalledWith(
      candidate.id,
      epic.id,
      expect.objectContaining({ title: candidate.title }),
    );
  });

  it('rejects a Candidate with an optional reason', async () => {
    const user = userEvent.setup();
    const onRejectCandidate = vi.fn();
    const candidate = {
      id: '019946e9-0ef0-7ca3-af0c-ec423d76efed',
      key: 'FF-41',
      title: 'Chase a visible metric',
      type: 'candidate' as const,
      lifecycle: 'inbox' as const,
      createdAt: '2026-08-30T08:45:00+04:00',
      tags: [],
      effectiveTags: [],
      path: 'Focus Flow/Inbox/FF-41 Chase a visible metric.md',
    };

    render(
      <FocusFlowShell
        mode="inbox"
        onModeChange={vi.fn()}
        onRejectCandidate={onRejectCandidate}
        indexState={{
          phase: 'ready',
          diagnostics: [],
          entities: [candidate],
        }}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'More actions for FF-41' }));
    await user.click(screen.getByRole('menuitem', { name: 'Reject' }));

    await user.type(
      screen.getByLabelText('Rejection reason for FF-41'),
      'Not aligned right now.',
    );
    await user.click(screen.getByRole('button', { name: 'Reject FF-41' }));

    expect(onRejectCandidate).toHaveBeenCalledWith(
      candidate.id,
      'Not aligned right now.',
    );
  });

  it('shows rejected Candidates as inspectable Distractions', async () => {
    render(
      <FocusFlowShell
        mode="inbox"
        inboxSection="distractions"
        onModeChange={vi.fn()}
        indexState={{
          phase: 'ready',
          diagnostics: [],
          entities: [
            {
              id: '019946e9-0ef0-7ca3-af0c-ec423d76efed',
              key: 'FF-41',
              title: 'Chase a visible metric',
              type: 'candidate',
              lifecycle: 'rejected',
              createdAt: '2026-08-30T08:45:00+04:00',
              tags: [],
              effectiveTags: [],
              path: 'Focus Flow/Distractions/FF-41 Chase a visible metric.md',
              rejectedAt: '2026-08-30T12:30:00Z',
              rejectionReason: 'Not aligned right now.',
            },
          ],
        }}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Chase a visible metric' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Not aligned right now.')).toBeInTheDocument();
  });

  it('shows the Focus empty state and lets the user choose Plan', async () => {
    const user = userEvent.setup();
    const onModeChange = vi.fn();

    render(<FocusFlowShell mode="focus" onModeChange={onModeChange} />);

    expect(
      screen.getByRole('heading', { name: 'No active sprint' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Plan a sprint to start moving tasks through Focus.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Plan' }));

    expect(onModeChange).toHaveBeenCalledWith('plan');
  });

  it('shows ordered Month and Epic backlogs with Story Tasks', async () => {
    const user = userEvent.setup();
    const onOpenNote = vi.fn();
    const epic = {
      id: '019946c9-5f97-7196-8483-73469275ff90',
      key: 'FF-40',
      title: 'Build a calmer system',
      type: 'epic' as const,
      lifecycle: 'backlog' as const,
      backlogRank: 'a0',
      createdAt: '2026-08-30T08:30:00+04:00',
      tags: [],
      effectiveTags: [],
      path: 'Focus Flow/Epics/FF-40 Build a calmer system.md',
    };
    const story = {
      id: '019946f1-8d2a-7f05-87b1-1eebbb476300',
      key: 'FF-42',
      title: 'Improve weekly focus',
      type: 'story' as const,
      lifecycle: 'backlog' as const,
      epicId: epic.id,
      epicLink: '[[Focus Flow/Epics/FF-40 Build a calmer system]]',
      backlogRank: 'a0',
      sprintId: null,
      sprintRank: null,
      acceptanceCriteria: [],
      createdAt: '2026-08-30T09:00:00+04:00',
      tags: [],
      effectiveTags: [],
      path: 'Focus Flow/Stories/FF-42 Improve weekly focus.md',
    };
    const task = {
      id: '01994706-857c-76f1-8006-85cd9bd80890',
      key: 'FF-43',
      title: 'Prepare the review',
      type: 'task' as const,
      lifecycle: 'active' as const,
      storyId: story.id,
      storyLink: '[[Focus Flow/Stories/FF-42 Improve weekly focus]]',
      taskRank: 'a0',
      status: 'todo' as const,
      startedAt: null,
      completedAt: null,
      createdAt: '2026-08-30T09:15:00+04:00',
      tags: [],
      effectiveTags: [],
      path: 'Focus Flow/Tasks/FF-43 Prepare the review.md',
    };

    render(
      <FocusFlowShell
        mode="plan"
        onModeChange={vi.fn()}
        onOpenNote={onOpenNote}
        indexState={{
          phase: 'ready',
          diagnostics: [],
          entities: [task, story, epic],
        }}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Next Sprint' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Month backlog')).toBeInTheDocument();
    expect(screen.getByText('Epic backlog')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Expand FF-42' })[0]!);
    await user.click(screen.getByText('Epic backlog'));
    expect(
      screen.getAllByRole('button', { name: 'Open FF-42 Improve weekly focus' }),
    ).not.toHaveLength(0);
    expect(screen.getAllByText('Prepare the review')).not.toHaveLength(0);

    await user.click(
      screen.getAllByRole('button', {
        name: 'Open FF-42 Improve weekly focus',
      })[0]!,
    );
    expect(onOpenNote).toHaveBeenCalledWith(story.path, expect.anything());
  });

  it('creates a Task only from its parent Story in Plan', async () => {
    const user = userEvent.setup();
    const onCreateTask = vi.fn();
    const story = {
      id: '019946f1-8d2a-7f05-87b1-1eebbb476300',
      key: 'FF-42',
      title: 'Improve weekly focus',
      type: 'story' as const,
      lifecycle: 'backlog' as const,
      epicId: '019946c9-5f97-7196-8483-73469275ff90',
      epicLink: '[[Focus Flow/Epics/FF-40 Build a calmer system]]',
      backlogRank: 'a0',
      sprintId: null,
      sprintRank: null,
      acceptanceCriteria: [],
      createdAt: '2026-08-30T09:00:00+04:00',
      tags: [],
      effectiveTags: [],
      path: 'Focus Flow/Stories/FF-42 Improve weekly focus.md',
    };

    render(
      <FocusFlowShell
        mode="plan"
        onModeChange={vi.fn()}
        onCreateTask={onCreateTask}
        indexState={{
          phase: 'ready',
          diagnostics: [],
          entities: [story],
        }}
      />,
    );

    await user.click(screen.getAllByRole('button', { name: 'Expand FF-42' })[0]!);
    await user.click(screen.getByRole('button', { name: 'Create Task for FF-42' }));
    await user.type(
      screen.getByLabelText('New Task for FF-42'),
      'Draft the review',
    );
    await user.click(
      screen.getByRole('button', { name: 'Add Task to FF-42' }),
    );

    expect(onCreateTask).toHaveBeenCalledWith(
      story.id,
      'Draft the review',
      false,
    );
  });

  it('offers a keyboard-accessible reorder menu backed by the shared workflow', async () => {
    const user = userEvent.setup();
    const onReorder = vi.fn();
    const epics = [
      {
        id: '019946c9-5f97-7196-8483-73469275ff90',
        key: 'FF-40',
        title: 'First Epic',
        type: 'epic' as const,
        lifecycle: 'backlog' as const,
        backlogRank: 'a0',
        createdAt: '2026-08-30T08:30:00Z',
        tags: [],
        effectiveTags: [],
        path: 'Focus Flow/Epics/FF-40 First Epic.md',
      },
      {
        id: '019946c9-5f97-7196-8483-73469275ff91',
        key: 'FF-41',
        title: 'Second Epic',
        type: 'epic' as const,
        lifecycle: 'backlog' as const,
        backlogRank: 'a1',
        createdAt: '2026-08-30T08:31:00Z',
        tags: [],
        effectiveTags: [],
        path: 'Focus Flow/Epics/FF-41 Second Epic.md',
      },
    ];

    render(
      <FocusFlowShell
        mode="plan"
        onModeChange={vi.fn()}
        onReorder={onReorder}
        indexState={{ phase: 'ready', diagnostics: [], entities: epics }}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Expand FF-41' }));
    await user.click(screen.getByLabelText('Actions for FF-41'));
    await user.click(screen.getByRole('menuitem', { name: 'Move to top' }));

    expect(onReorder).toHaveBeenCalledWith(epics[1]!.id, 0);
  });

  it('keeps the selected mode visible while reporting damaged notes', async () => {
    const user = userEvent.setup();
    render(
      <FocusFlowShell
        mode="plan"
        onModeChange={vi.fn()}
        indexState={{
          phase: 'ready',
          diagnostics: [
            {
              code: 'invalid-managed-data',
              message: 'Task lifecycle and status must agree.',
              path: 'Focus Flow/Tasks/FF-43 Broken task.md',
            },
          ],
        }}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Plan' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '1 notes need attention' }));
    expect(screen.getByRole('dialog', { name: 'Attention center' })).toHaveTextContent(
      'Focus Flow/Tasks/FF-43 Broken task.md',
    );
    expect(screen.getByRole('dialog', { name: 'Attention center' })).toHaveTextContent(
      'Task lifecycle and status must agree.',
    );
  });

  it('does not show an empty workflow before the initial index is ready', () => {
    render(
      <FocusFlowShell
        mode="focus"
        onModeChange={vi.fn()}
        indexState={{ phase: 'loading', diagnostics: [] }}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Loading Focus Flow' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'No active sprint' }),
    ).not.toBeInTheDocument();
  });

  it('keeps stale content visible when refreshing the index fails', () => {
    render(
      <FocusFlowShell
        mode="plan"
        onModeChange={vi.fn()}
        indexState={{
          phase: 'error',
          diagnostics: [],
          errorMessage: 'Focus Flow could not read managed notes.',
        }}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Plan' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Focus Flow could not read managed notes.',
    );
  });

  it('offers the diagnostic repair plan to the connected root', async () => {
    const user = userEvent.setup();
    const repair = {
      kind: 'replace-parent-link' as const,
      path: 'Focus Flow/Stories/FF-42 Improve weekly focus.md',
      parentId: '019946c9-5f97-7196-8483-73469275ff90',
      field: 'epic_link' as const,
      expectedValue: '[[FF-99 Wrong Epic]]',
      replacementValue: '[[Focus Flow/Epics/FF-40 Build a calmer system]]',
    };
    const onRepairDiagnostic = vi.fn();

    render(
      <FocusFlowShell
        mode="plan"
        onModeChange={vi.fn()}
        onRepairDiagnostic={onRepairDiagnostic}
        indexState={{
          phase: 'ready',
          diagnostics: [
            {
              code: 'parent-link-mismatch',
              message: 'Parent link does not match Epic FF-40.',
              path: repair.path,
              repair,
            },
          ],
        }}
      />,
    );

    await user.click(screen.getByRole('button', { name: '1 notes need attention' }));

    await user.click(
      screen.getByRole('button', {
        name: `Repair parent link for ${repair.path}`,
      }),
    );

    expect(onRepairDiagnostic).toHaveBeenCalledWith(repair);
  });

  it('disables the repair action while that note is being repaired', async () => {
    const user = userEvent.setup();
    const repair = {
      kind: 'replace-parent-link' as const,
      path: 'Focus Flow/Stories/FF-42 Improve weekly focus.md',
      parentId: '019946c9-5f97-7196-8483-73469275ff90',
      field: 'epic_link' as const,
      expectedValue: '[[FF-99 Wrong Epic]]',
      replacementValue: '[[Focus Flow/Epics/FF-40 Build a calmer system]]',
    };

    render(
      <FocusFlowShell
        mode="plan"
        onModeChange={vi.fn()}
        onRepairDiagnostic={vi.fn()}
        repairing
        indexState={{
          phase: 'ready',
          diagnostics: [
            {
              code: 'parent-link-mismatch',
              message: 'Parent link does not match Epic FF-40.',
              path: repair.path,
              repair,
            },
          ],
        }}
      />,
    );

    await user.click(screen.getByRole('button', { name: '1 notes need attention' }));

    expect(screen.getByRole('button', { name: 'Repairing parent link' })).toBeDisabled();
  });

  it('announces a repair failure without hiding the diagnostic', async () => {
    const user = userEvent.setup();
    render(
      <FocusFlowShell
        mode="plan"
        onModeChange={vi.fn()}
        repairError="Focus Flow could not repair the parent link. Refresh and try again."
        indexState={{
          phase: 'ready',
          diagnostics: [
            {
              code: 'parent-link-mismatch',
              message: 'Parent link does not match Epic FF-40.',
              path: 'Focus Flow/Stories/FF-42 Improve weekly focus.md',
            },
          ],
        }}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Focus Flow could not repair the parent link. Refresh and try again.',
    );
    await user.click(screen.getByRole('button', { name: '1 notes need attention' }));
    expect(screen.getByRole('dialog', { name: 'Attention center' })).toHaveTextContent(
      'Parent link does not match Epic FF-40.',
    );
  });

  it('offers a rank rebalance plan for its owning collection', async () => {
    const user = userEvent.setup();
    const repair = {
      kind: 'rebalance-ranks' as const,
      collectionLabel: 'the Epic Backlog',
      entries: [],
    };
    const onRepairDiagnostic = vi.fn();

    render(
      <FocusFlowShell
        mode="plan"
        onModeChange={vi.fn()}
        onRepairDiagnostic={onRepairDiagnostic}
        indexState={{
          phase: 'ready',
          diagnostics: [
            {
              code: 'duplicate-rank',
              message: 'Rank a0 is duplicated in the Epic Backlog.',
              path: 'Focus Flow/Epics/FF-40 Build a calmer system.md',
              repair,
            },
          ],
        }}
      />,
    );

    await user.click(screen.getByRole('button', { name: '1 notes need attention' }));

    await user.click(
      screen.getByRole('button', {
        name: 'Rebalance ranks for the Epic Backlog',
      }),
    );

    expect(onRepairDiagnostic).toHaveBeenCalledWith(repair);
  });

  it('offers to move a misplaced note into its typed folder', async () => {
    const user = userEvent.setup();
    const repair = {
      kind: 'move-note' as const,
      path: 'Focus Flow/Tasks/FF-41 Explore weekly focus.md',
      id: '019946e9-0ef0-7ca3-af0c-ec423d76efed',
      targetFolder: 'Inbox' as const,
    };
    const onRepairDiagnostic = vi.fn();

    render(
      <FocusFlowShell
        mode="plan"
        onModeChange={vi.fn()}
        onRepairDiagnostic={onRepairDiagnostic}
        indexState={{
          phase: 'ready',
          diagnostics: [
            {
              code: 'wrong-folder',
              message: 'Candidate notes with lifecycle inbox belong in Inbox.',
              path: repair.path,
              repair,
            },
          ],
        }}
      />,
    );

    await user.click(screen.getByRole('button', { name: '1 notes need attention' }));

    await user.click(
      screen.getByRole('button', { name: 'Move note to Inbox' }),
    );

    expect(onRepairDiagnostic).toHaveBeenCalledWith(repair);
  });

  it('offers one repair for duplicate human keys', async () => {
    const user = userEvent.setup();
    const repair = {
      kind: 'repair-duplicate-keys' as const,
      entries: [],
      links: [],
    };
    const onRepairDiagnostic = vi.fn();

    render(
      <FocusFlowShell
        mode="plan"
        onModeChange={vi.fn()}
        onRepairDiagnostic={onRepairDiagnostic}
        indexState={{
          phase: 'ready',
          diagnostics: [
            {
              code: 'duplicate-key',
              message: 'Key FF-40 is used by multiple notes.',
              path: 'Focus Flow/Epics/FF-40 Make reviews repeatable.md',
              repair,
            },
          ],
        }}
      />,
    );

    await user.click(screen.getByRole('button', { name: '1 notes need attention' }));

    await user.click(
      screen.getByRole('button', { name: 'Repair duplicate keys' }),
    );

    expect(onRepairDiagnostic).toHaveBeenCalledWith(repair);
  });

  it('offers one repair for duplicate UUIDs', async () => {
    const user = userEvent.setup();
    const repair = {
      kind: 'repair-duplicate-ids' as const,
      entries: [],
      references: [],
    };
    const onRepairDiagnostic = vi.fn();

    render(
      <FocusFlowShell
        mode="plan"
        onModeChange={vi.fn()}
        onRepairDiagnostic={onRepairDiagnostic}
        indexState={{
          phase: 'ready',
          diagnostics: [
            {
              code: 'duplicate-id',
              message: 'A UUID is used by multiple notes.',
              path: 'Focus Flow/Epics/FF-41 Make reviews repeatable.md',
              repair,
            },
          ],
        }}
      />,
    );

    await user.click(screen.getByRole('button', { name: '1 notes need attention' }));

    await user.click(
      screen.getByRole('button', { name: 'Repair duplicate UUIDs' }),
    );

    expect(onRepairDiagnostic).toHaveBeenCalledWith(repair);
  });
});
