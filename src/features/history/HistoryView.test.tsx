import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ProjectedManagedEntity } from '../../application/indexing/work-index';
import { HistoryView } from './HistoryView';

function sprint(
  code: string,
  date: string,
  epicId: string,
  tag: string,
): Extract<ProjectedManagedEntity, { type: 'sprint'; lifecycle: 'closed' }> {
  return {
    id: code === 'SPR-013'
      ? '01994744-a401-759a-b582-4418f2f24050'
      : '01994744-a401-759a-b582-4418f2f24051',
    type: 'sprint',
    lifecycle: 'closed',
    code,
    sequence: Number(code.slice(4)),
    startsOn: date,
    dueOn: date,
    startedAt: `${date}T08:00:00Z`,
    closedAt: `${date}T18:00:00Z`,
    provisionalStoryOutcomes: [],
    startSnapshot: { capturedAt: `${date}T08:00:00Z`, stories: [] },
    closeSnapshot: {
      operationId: code === 'SPR-013'
        ? '01994a8a-0371-7a2d-a3e9-247990391600'
        : '01994a8a-0371-7a2d-a3e9-247990391601',
      capturedAt: `${date}T18:00:00Z`,
      stories: [
        {
          id: code === 'SPR-013'
            ? '019946f1-8d2a-7f05-87b1-1eebbb476300'
            : '019946f1-8d2a-7f05-87b1-1eebbb476301',
          key: 'FF-42',
          title: `Story for ${code}`,
          epicId,
          outcome: 'achieved',
          evidence: 'Verified.',
          acceptanceExceptionReason: null,
          acceptanceCriteria: [],
          effectiveTags: [tag],
        },
      ],
      tasks: [],
      summary: {
        attemptedStories: 1,
        storiesAtStart: 1,
        storiesAtClose: 1,
        storiesAdded: 0,
        storiesRemoved: 0,
        achievedStories: 1,
        notAchievedStories: 0,
        closedStories: 0,
        committedOpenTasks: 2,
        tasksAtStart: 2,
        tasksAtClose: 3,
        tasksAdded: 1,
        tasksRemoved: 0,
        completedDuringSprint: 2,
        openAtClose: 0,
        exceptionCount: 0,
      },
      effectiveTagSummary: [{ tag, completedTasks: 2 }],
    },
    retrospectiveItems: [
      { kind: 'win', text: `Win ${code}` },
      { kind: 'friction', text: `Friction ${code}` },
      { kind: 'improvement', text: `Improve ${code}` },
    ],
    path: `Focus Flow/Sprints/${code}.md`,
  };
}

const epicA = '019946c9-5f97-7196-8483-73469275ff90';
const epicB = '019946c9-5f97-7196-8483-73469275ff91';
const entities = [
  sprint('SPR-013', '2026-08-17', epicA, 'area/mobile'),
  sprint('SPR-014', '2026-08-24', epicB, 'area/desktop'),
];

describe('HistoryView', () => {
  it('browses reports without a dropdown and keeps the selected Sprint context across review levels', async () => {
    const user = userEvent.setup();
    render(<HistoryView entities={entities} />);
    expect(screen.queryByLabelText('Select report')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Previous Sprint' }));
    expect(screen.getByRole('heading', { name: 'SPR-013' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Month' }));
    expect(screen.getByRole('heading', { name: 'Month 4 · Year 1' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sprint' }));
    expect(screen.getByRole('heading', { name: 'SPR-013' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Browse history' }));
    expect(screen.getByRole('searchbox', { name: 'Find a period' })).toHaveFocus();
    await user.type(screen.getByRole('searchbox', { name: 'Find a period' }), 'SPR-014');
    await user.click(screen.getByRole('button', { name: /Open report SPR-014/ }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'SPR-014' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next Sprint' })).toBeDisabled();
  });

  it('keeps report periods on the left and shows Reopen only for the latest eligible Sprint', () => {
    const latest = {
      ...entities[1]!,
      reopenRecovery: {
        close_operation_id: '01994a8a-0371-7a2d-a3e9-247990391601',
        provisional_story_outcomes: [],
        notes: [],
      },
    };
    const lifecycle = {
      previewArchive: vi.fn(),
      organize: vi.fn(),
      previewReopen: vi.fn(async () => ({ path: latest.path, code: latest.code, resuming: false })),
      reopen: vi.fn(async () => undefined),
    };
    const { rerender } = render(<HistoryView entities={[entities[0]!, latest]} lifecycle={lifecycle} />);
    const periods = screen.getByRole('group', { name: 'Report period' });
    const reopen = screen.getByRole('button', { name: 'Reopen SPR-014' });
    expect(periods.compareDocumentPosition(reopen) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    rerender(<HistoryView entities={entities} lifecycle={lifecycle} />);
    expect(screen.queryByRole('button', { name: /Reopen SPR-/ })).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Report period' })).toBeVisible();
  });
  it('shows visual summaries with source evidence folded until requested', async () => {
    const user = userEvent.setup();
    render(<HistoryView entities={entities} />);

    expect(screen.getByText('Outcomes & reflection').closest('details')).not.toHaveAttribute('open');
    expect(screen.getByRole('region', { name: 'Story outcome chart' })).toBeInTheDocument();
    await user.click(screen.getByText('Outcomes & reflection'));
    const card = screen.getByRole('article');
    expect(screen.getByText('1 of 1 Story Attempts achieved their outcome.')).toBeInTheDocument();
    expect(within(card).getByText('area/desktop')).toBeInTheDocument();
    expect(within(card).getByText('Committed open')).toBeInTheDocument();
  });

  it('filters by date, Epic, and frozen Effective Tag', async () => {
    const user = userEvent.setup();
    render(<HistoryView entities={entities} />);

    expect(screen.queryByLabelText('Epic')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Filters' }));
    await user.click(screen.getByRole('checkbox', { name: epicA }));
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByRole('heading', { name: 'SPR-013' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'SPR-014' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: `Remove Epic filter ${epicA}` }));
    await user.click(screen.getByRole('button', { name: 'Filters' }));
    await user.type(screen.getByRole('searchbox', { name: 'Find Epics or tags' }), 'desktop');
    await user.click(screen.getByRole('checkbox', { name: '#area/desktop' }));
    await user.click(screen.getByText('Closed date'));
    await user.type(screen.getByLabelText('Closed from'), '2026-08-20');
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByRole('heading', { name: 'SPR-014' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'SPR-013' })).not.toBeInTheDocument();
  });

  it('opens the Sprint note and promotes only Improvement items', async () => {
    const user = userEvent.setup();
    const onOpenNote = vi.fn();
    const onPromoteImprovement = vi.fn();
    render(
      <HistoryView
        entities={[entities[0]!]}
        onOpenNote={onOpenNote}
        onPromoteImprovement={onPromoteImprovement}
      />,
    );

    await user.click(screen.getByText('Outcomes & reflection'));
    await user.click(screen.getByRole('link', { name: 'SPR-013' }));
    expect(onOpenNote).toHaveBeenCalledWith(
      'Focus Flow/Sprints/SPR-013.md',
      expect.anything(),
    );
    await user.click(
      screen.getByRole('button', { name: 'Promote Improve SPR-013' }),
    );
    expect(onPromoteImprovement).toHaveBeenCalledWith(
      'Improve SPR-013',
      'SPR-013',
    );
  });

  it('shows Review Cycles and opens terminal Epic and Story evidence', async () => {
    const user = userEvent.setup();
    const onOpenNote = vi.fn();
    const terminalEpic: ProjectedManagedEntity = {
      id: epicA,
      key: 'FF-40',
      title: 'Completed direction',
      type: 'epic',
      lifecycle: 'done',
      backlogRank: null,
      completedAt: '2026-08-20T10:00:00Z',
      closedAt: null,
      closeReason: null,
      acceptanceCriteria: [],
      createdAt: '2026-07-01T10:00:00Z',
      tags: [],
      effectiveTags: [],
      path: 'Focus Flow/Epics/FF-40 Completed direction.md',
    };
    const currentStory: ProjectedManagedEntity = {
      id: '019946f1-8d2a-7f05-87b1-1eebbb476300',
      key: 'FF-42',
      title: 'Story for SPR-013',
      type: 'story',
      lifecycle: 'done',
      epicId: epicA,
      epicLink: '[[Focus Flow/Epics/FF-40 Completed direction]]',
      backlogRank: null,
      sprintId: null,
      sprintRank: null,
      acceptanceCriteria: [],
      completedAt: '2026-08-17T18:00:00Z',
      outcome: 'achieved',
      createdAt: '2026-07-01T10:00:00Z',
      tags: [],
      effectiveTags: [],
      path: 'Focus Flow/Stories/FF-42 Story for SPR-013.md',
    };
    render(
      <HistoryView
        entities={[...entities, terminalEpic, currentStory]}
        onOpenNote={onOpenNote}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Year' }));
    expect(screen.getByRole('heading', { name: 'Year 1' })).toBeInTheDocument();
    expect(screen.getByText('2 / 48 Sprints · In progress')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Quarter' }));
    expect(screen.getByRole('heading', { name: 'Quarter 2 · Year 1' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Month' }));
    expect(screen.getByRole('heading', { name: 'Month 4 · Year 1' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /SPR-013: 2 Task completions/ })).toBeInTheDocument();
    await user.click(screen.getByText('Outcomes & reflection'));

    await user.click(screen.getByRole('link', { name: 'Open FF-40 Epic' }));
    expect(onOpenNote).toHaveBeenCalledWith(terminalEpic.path, expect.anything());
    await user.click(screen.getByRole('link', { name: 'Open FF-42 Story' }));
    expect(onOpenNote).toHaveBeenCalledWith(currentStory.path, expect.anything());
  });
});
