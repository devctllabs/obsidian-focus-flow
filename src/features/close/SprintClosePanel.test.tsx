import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ProjectedManagedEntity } from '../../application/indexing/work-index';
import { SprintClosePanel } from './SprintClosePanel';

const sprintId = '01994744-a401-759a-b582-4418f2f2405f';
const storyId = '019946f1-8d2a-7f05-87b1-1eebbb476300';
const taskId = '01994706-857c-76f1-8006-85cd9bd80890';

function entities(checked = true): ProjectedManagedEntity[] {
  return [
    {
      id: sprintId,
      type: 'sprint',
      lifecycle: 'active',
      code: 'SPR-014',
      sequence: 14,
      startsOn: '2026-08-24',
      dueOn: '2026-08-30',
      startedAt: '2026-08-24T08:00:00Z',
      closedAt: null,
      provisionalStoryOutcomes: [],
      startSnapshot: { capturedAt: '2026-08-24T08:00:00Z', stories: [] },
      closeSnapshot: null,
      pendingClose: null,
      path: 'Focus Flow/Sprints/SPR-014.md',
    },
    {
      id: storyId,
      key: 'FF-42',
      title: 'Mobile board',
      type: 'story',
      lifecycle: 'active_sprint',
      epicId: '019946c9-5f97-7196-8483-73469275ff90',
      epicLink: '[[Focus Flow/Epics/FF-40 Product]]',
      backlogRank: 'a0',
      sprintId,
      sprintRank: 'a0',
      acceptanceCriteria: [{ text: 'Works', checked }],
      createdAt: '2026-08-20T09:00:00Z',
      tags: [],
      effectiveTags: [],
      path: 'Focus Flow/Stories/FF-42 Mobile board.md',
    },
    {
      id: taskId,
      key: 'FF-43',
      title: 'Verify mobile',
      type: 'task',
      lifecycle: 'done',
      storyId,
      storyLink: '[[Focus Flow/Stories/FF-42 Mobile board]]',
      taskRank: 'a0',
      status: 'done',
      startedAt: null,
      completedAt: '2026-08-30T16:00:00Z',
      createdAt: '2026-08-20T09:00:00Z',
      tags: [],
      effectiveTags: [],
      path: 'Focus Flow/Tasks/FF-43 Verify mobile.md',
    },
  ];
}

describe('SprintClosePanel', () => {
  it('saves an outcome without a reflection and counts it as reviewed', async () => {
    const user = userEvent.setup();
    const onEvaluateStory = vi.fn();
    const data = entities();
    const view = render(<SprintClosePanel entities={data} onEvaluateStory={onEvaluateStory} />);
    await user.click(screen.getByRole('button', { name: 'Outcomes' }));
    expect(screen.getByLabelText('Reflection for FF-42')).not.toBeRequired();
    await user.click(screen.getByRole('button', { name: 'Closed' }));
    await user.click(screen.getByRole('button', { name: 'Save evaluation for FF-42' }));
    expect(onEvaluateStory).toHaveBeenCalledWith({ storyId, outcome: 'closed', evidence: '' });
    const sprint = data[0];
    if (sprint?.type !== 'sprint' || sprint.lifecycle !== 'active') throw new Error();
    sprint.provisionalStoryOutcomes = [{ storyId, outcome: 'closed', evidence: '', evaluatedAt: '2026-09-05T18:00:00Z', acceptanceExceptionReason: null }];
    view.rerender(<SprintClosePanel entities={[...data]} onEvaluateStory={onEvaluateStory} />);
    await user.click(screen.getByRole('button', { name: 'Review' }));
    expect(screen.queryByText('1 Story needs an outcome')).not.toBeInTheDocument();
  });
  it('uses named review steps and preserves unsaved evidence when navigating', async () => {
    const user = userEvent.setup();
    render(<SprintClosePanel entities={entities()} />);
    expect(screen.getByText('1 Story needs an outcome')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Overview' })).toHaveAttribute('aria-current', 'step');
    await user.click(screen.getByRole('button', { name: 'Outcomes' }));
    await user.type(screen.getByLabelText('Reflection for FF-42'), 'Tested on mobile');
    await user.click(screen.getByRole('button', { name: 'Retrospective' }));
    expect(screen.getByRole('button', { name: 'Retrospective' })).toHaveAttribute('aria-current', 'step');
    await user.click(screen.getByRole('button', { name: 'Outcomes' }));
    expect(screen.getByLabelText('Reflection for FF-42')).toHaveValue('Tested on mobile');
  });

  it('labels an all-Done Story Ready to evaluate without completing it', async () => {
    const user = userEvent.setup();
    render(<SprintClosePanel entities={entities()} />);

    await user.click(screen.getByRole('button', { name: /Outcomes/ }));

    expect(screen.getByText('Ready to evaluate')).toBeInTheDocument();
    expect(screen.getByText('FF-42 Mobile board')).toBeInTheDocument();
  });

  it('submits an Achieved evaluation with an explicit criteria exception', async () => {
    const user = userEvent.setup();
    const onEvaluateStory = vi.fn();
    render(
      <SprintClosePanel
        entities={entities(false)}
        onEvaluateStory={onEvaluateStory}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Outcomes/ }));

    await user.click(screen.getByRole('button', { name: 'Achieved' }));
    await user.type(screen.getByLabelText('Reflection for FF-42'), 'Main path verified');
    await user.type(
      screen.getByLabelText('Acceptance Criteria exception for FF-42'),
      'Landscape mode is deferred',
    );
    await user.click(screen.getByRole('button', { name: 'Save evaluation for FF-42' }));

    expect(onEvaluateStory).toHaveBeenCalledWith({
      storyId,
      outcome: 'achieved',
      evidence: 'Main path verified',
      acceptanceExceptionReason: 'Landscape mode is deferred',
    });
  });

  it('offers Resume close and Inspect changes for pending_close', async () => {
    const pendingEntities = entities();
    const sprint = pendingEntities[0];
    if (sprint?.type !== 'sprint' || sprint.lifecycle !== 'active') throw new Error();
    sprint.pendingClose = {
      operationId: '01994a8a-0371-7a2d-a3e9-247990391600',
      decisionsHash: 'sha256:reviewed',
      capturedAt: '2026-08-30T18:00:00Z',
      sprintId,
      sprintPath: sprint.path,
      stories: [],
      tasks: [],
      delta: {
        addedStories: [],
        removedStories: [],
        addedTasks: [],
        removedTasks: [],
        changedAcceptanceCriteriaStories: [],
      },
    closeSnapshot: {
        operationId: '01994a8a-0371-7a2d-a3e9-247990391600',
        capturedAt: '2026-08-30T18:00:00Z',
        stories: [],
        tasks: [],
        summary: {
          attemptedStories: 0, storiesAtStart: 0, storiesAtClose: 0,
          storiesAdded: 0, storiesRemoved: 0, achievedStories: 0,
          notAchievedStories: 0, closedStories: 0, committedOpenTasks: 0,
          tasksAtStart: 0, tasksAtClose: 0, tasksAdded: 0,
          tasksRemoved: 0, completedDuringSprint: 0, openAtClose: 0,
          exceptionCount: 0,
        },
        effectiveTagSummary: [],
      },
      retrospective: { wins: [], friction: [], improvements: [] },
    };
    const onResumeClose = vi.fn();
    const user = userEvent.setup();
    render(
      <SprintClosePanel entities={pendingEntities} onResumeClose={onResumeClose} />,
    );

    await user.click(screen.getByRole('button', { name: 'Inspect changes' }));
    expect(screen.getByText(/01994a8a-0371/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Resume close' }));
    expect(onResumeClose).toHaveBeenCalledOnce();
  });

  it('keeps Task triage selection in React state after the change event', async () => {
    const open = entities();
    const task = open[2];
    if (task?.type !== 'task') throw new Error();
    task.lifecycle = 'active';
    task.status = 'in_progress';
    task.completedAt = null;
    const user = userEvent.setup();
    render(<SprintClosePanel entities={open} />);

    await user.click(screen.getByRole('button', { name: /Tasks/ }));

    await user.selectOptions(
      screen.getByLabelText('Resolution for FF-43'),
      'reclassify',
    );

    expect(screen.getByLabelText('Parent Epic for FF-43')).toBeInTheDocument();
  });

  it('reviews one Story at a time while keeping evidence for other Stories', async () => {
    const work = entities();
    const story = work[1];
    if (story?.type !== 'story') throw new Error();
    work.push({ ...story, id: 'second-story', key: 'FF-44', title: 'Write the guide', sprintRank: 'a1' });
    const user = userEvent.setup();
    render(<SprintClosePanel entities={work} />);
    await user.click(screen.getByRole('button', { name: 'Outcomes' }));
    await user.type(screen.getByLabelText('Reflection for FF-42'), 'First evidence');
    expect(screen.queryByLabelText('Reflection for FF-44')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Review FF-44' }));
    await user.type(screen.getByLabelText('Reflection for FF-44'), 'Second evidence');
    await user.click(screen.getByRole('button', { name: 'Review FF-42' }));
    expect(screen.getByLabelText('Reflection for FF-42')).toHaveValue('First evidence');
  });

  it('offers freeform reflection and points back to missing work before closing', async () => {
    const user = userEvent.setup();
    render(<SprintClosePanel entities={entities()} onCloseSprint={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Retrospective' }));
    expect(screen.queryByRole('button', { name: 'Add win' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Wins')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add item to Wins' }));
    await user.type(screen.getByLabelText('Wins'), 'Protected mornings\nFinished the guide');
    await user.click(screen.getByRole('button', { name: 'Save Wins item' }));
    await user.click(screen.getByRole('button', { name: 'Add item to Wins' }));
    await user.type(screen.getByLabelText('Wins item 2'), '**Kept a rhythm**\n\n[[[[Weekly notes]]');
    await user.click(screen.getByRole('button', { name: 'Save Wins item' }));
    await user.click(screen.getByRole('button', { name: 'Review' }));
    expect(screen.getByRole('button', { name: 'Close Sprint' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Review Story outcomes' }));
    expect(screen.getByLabelText('Reflection for FF-42')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retrospective' }));
    expect(screen.getByRole('button', { name: 'Edit Wins item 1' })).toHaveTextContent('Protected mornings');
    expect(screen.getByRole('button', { name: 'Edit Wins item 2' })).toHaveTextContent('Kept a rhythm');
  });
});
