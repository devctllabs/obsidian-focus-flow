import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ProjectedManagedEntity } from '../../application/indexing/work-index';
import { PlanView } from './PlanView';
import { activeSprint as activeFixture, activeStory as selectedFixture, task as taskFixture } from '../../test/storybook/fixtures';

const epicId = '019946c9-5f97-7196-8483-73469275ff90';
const storyId = '019946f1-8d2a-7f05-87b1-1eebbb476300';
const draftId = '01994744-a401-759a-b582-4418f2f2405f';

it('keeps Sprint transfer compact and reveals criteria guidance on hover or click', async () => {
  const user = userEvent.setup();
  render(<PlanView entities={[epic, { ...story(), acceptanceCriteria: [] }, activeFixture]} onAddStoryToActive={vi.fn()} onEditOutcome={vi.fn()} />);
  expect(screen.getByRole('button', { name: 'Add FF-42 to Active Sprint' })).toBeDisabled();
  expect(screen.queryByText('Add at least one Acceptance Criterion before adding this Story to a Sprint.')).not.toBeInTheDocument();
  const help = screen.getByRole('button', { name: 'Why FF-42 cannot enter a Sprint' });
  await user.hover(help);
  expect(screen.getByRole('dialog', { name: 'Sprint requirement' })).toHaveTextContent('Add at least one Acceptance Criterion');
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await user.click(help);
  expect(screen.getByRole('dialog', { name: 'Sprint requirement' })).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Add criteria to FF-42' }));
  expect(screen.getByRole('dialog', { name: 'Edit FF-42' })).toBeVisible();
});

it('opens Task edit from the trailing row menu in Plan', async () => {
  const user = userEvent.setup();
  const onEditOutcome = vi.fn().mockResolvedValue(undefined);
  render(<PlanView entities={[epic, story(), taskFixture]} onEditOutcome={onEditOutcome} />);
  await user.click(screen.getByRole('button', { name: 'Expand FF-42' }));
  await user.click(screen.getByRole('button', { name: 'Reorder FF-43' }));
  await user.click(screen.getByRole('menuitem', { name: 'Edit…' }));
  expect(screen.getByLabelText('Description')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(onEditOutcome).toHaveBeenCalledWith(expect.objectContaining({ id: taskFixture.id, type: 'task' }));
});

it('explicitly selects an Epic Story into Month and can return it to its Epic', async () => {
  const user = userEvent.setup();
  const onSetMonthMembership = vi.fn();
  const deferred = { ...story(), lifecycle: 'epic_backlog' as const, backlogRank: null };
  const view = render(<PlanView entities={[epic, deferred]} onSetMonthMembership={onSetMonthMembership} />);
  await user.click(screen.getByRole('button', { name: 'Expand FF-40' }));
  await user.click(screen.getByRole('button', { name: 'Add FF-42 to Month backlog' }));
  expect(onSetMonthMembership).toHaveBeenCalledWith(storyId, true);
  view.rerender(<PlanView entities={[epic, story()]} onSetMonthMembership={onSetMonthMembership} />);
  await user.click(screen.getByRole('button', { name: 'Reorder FF-42' }));
  await user.click(screen.getByRole('menuitem', { name: 'Return to Epic' }));
  expect(onSetMonthMembership).toHaveBeenCalledWith(storyId, false);
});

it('edits Story and Epic typed fields from their existing row menus', async () => {
  const user = userEvent.setup();
  const onEditOutcome = vi.fn().mockResolvedValue(undefined);
  render(<PlanView entities={[epic, story()]} onEditOutcome={onEditOutcome} />);
  for (const [key, menu] of [['FF-42', 'Reorder FF-42'], ['FF-40', 'Actions for FF-40']]) {
    await user.click(screen.getByRole('button', { name: menu }));
    await user.click(screen.getByRole('menuitem', { name: 'Edit…' }));
    const dialog = screen.getByRole('dialog', { name: `Edit ${key}` });
    await user.clear(within(dialog).getByRole('textbox', { name: 'Title' }));
    await user.type(within(dialog).getByRole('textbox', { name: 'Title' }), 'A clearer result');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    expect(onEditOutcome).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'A clearer result', type: key === 'FF-42' ? 'story' : 'epic' }));
  }
});

it('creates a Task from an Active Sprint Story in Plan with the existing WIP confirmation', async () => {
  const user = userEvent.setup();
  const onCreateTask = vi.fn().mockResolvedValueOnce({ kind: 'confirmation-required', message: 'Scope limit reached', excess: 1 }).mockResolvedValueOnce({ kind: 'created', path: 'Task.md' });
  render(<PlanView entities={[activeFixture, selectedFixture]} onCreateTask={onCreateTask} />);
  await user.click(screen.getByRole('button', { name: 'Expand FF-42' }));
  await user.click(screen.getByRole('button', { name: 'Create Task for FF-42' }));
  await user.type(screen.getByRole('textbox', { name: 'New Task for FF-42' }), 'Review the wording');
  await user.type(screen.getByLabelText('Description'), 'Check narrow screens');
  await user.click(screen.getByRole('button', { name: 'Add criterion' }));
  await user.type(screen.getByLabelText('Criterion 1'), 'No overflow');
  await user.type(screen.getByRole('combobox', { name: 'Tags' }), 'ux{Enter}');
  await user.click(screen.getByRole('button', { name: 'Add Task to FF-42' }));
  expect(screen.getByRole('dialog', { name: 'New Task' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Add anyway' }));
  expect(onCreateTask).toHaveBeenLastCalledWith(selectedFixture.id, 'Review the wording', true, { tags: ['ux'], bodyFields: { Description: 'Check narrow screens', 'Acceptance Criteria': '- [ ] No overflow' } });
});

const epic: Extract<
  ProjectedManagedEntity,
  { type: 'epic'; lifecycle: 'backlog' }
> = {
  id: epicId,
  key: 'FF-40',
  title: 'Build a calmer system',
  type: 'epic',
  lifecycle: 'backlog',
  backlogRank: 'a0',
  createdAt: '2026-08-30T08:30:00Z',
  tags: [],
  effectiveTags: [],
  path: 'Focus Flow/Epics/FF-40 Build a calmer system.md',
};

function story(
  overrides: Partial<Extract<ProjectedManagedEntity, { type: 'story' }>> = {},
): Extract<ProjectedManagedEntity, { type: 'story' }> {
  return {
    id: storyId,
    key: 'FF-42',
    title: 'Improve weekly focus',
    type: 'story',
    lifecycle: 'backlog',
    epicId,
    epicLink: '[[Focus Flow/Epics/FF-40 Build a calmer system]]',
    backlogRank: 'a0',
    sprintId: null,
    sprintRank: null,
    acceptanceCriteria: [
      { text: 'Weekly priorities are visible', checked: false },
    ],
    createdAt: '2026-08-30T09:00:00Z',
    tags: [],
    effectiveTags: [],
    path: 'Focus Flow/Stories/FF-42 Improve weekly focus.md',
    ...overrides,
  };
}

function task(
  overrides: Partial<Extract<ProjectedManagedEntity, { type: 'task' }>> = {},
): Extract<ProjectedManagedEntity, { type: 'task' }> {
  return {
    id: '01994706-857c-76f1-8006-85cd9bd80890',
    key: 'FF-43',
    title: 'Prepare the review',
    type: 'task',
    lifecycle: 'active',
    storyId,
    storyLink: '[[Focus Flow/Stories/FF-42 Improve weekly focus]]',
    taskRank: 'a0',
    status: 'todo',
    startedAt: null,
    completedAt: null,
    createdAt: '2026-08-30T09:15:00Z',
    tags: [],
    effectiveTags: [],
    path: 'Focus Flow/Tasks/FF-43 Prepare the review.md',
    ...overrides,
  };
}

const draft: Extract<ProjectedManagedEntity, { type: 'sprint' }> = {
  id: draftId,
  type: 'sprint',
  lifecycle: 'draft',
  path: 'Focus Flow/Sprints/DRAFT.md',
};

describe('PlanView Sprint planning', () => {
  it('closes the combined Epic menu after reordering', async () => {
    const user = userEvent.setup();
    const onReorder = vi.fn();
    const nextEpic = { ...epic, id: `${epicId}-next`, key: 'FF-41', backlogRank: 'a1' };
    render(<PlanView entities={[epic, nextEpic]} onReorder={onReorder} />);
    await user.click(screen.getByRole('button', { name: 'Actions for FF-41' }));
    await user.click(screen.getByRole('menuitem', { name: 'Move to top' }));
    expect(onReorder).toHaveBeenCalledWith(nextEpic.id, 0);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
  it('shows both named backlogs and exposes Draft selection without expanding a Story', async () => {
    const user = userEvent.setup();
    const onAddStoryToDraft = vi.fn();
    render(<PlanView entities={[epic, story(), draft]} onAddStoryToDraft={onAddStoryToDraft} />);
    expect(screen.getByRole('heading', { name: 'Month backlog' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Epic backlog' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Stories' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add FF-42 to Draft Sprint' }));
    expect(onAddStoryToDraft).toHaveBeenCalledWith(storyId);
    await user.click(screen.getByRole('button', { name: 'Expand FF-40' }));
    expect(within(screen.getByRole('region', { name: 'Epic backlog' })).getByRole('button', { name: 'Show FF-42 in Month backlog' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Actions for FF-40' }).closest('.focus-flow__planning-heading')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Reorder FF-42' }).closest('.focus-flow__planning-heading')).not.toBeNull();
    expect(screen.getByRole('region', { name: 'Epic backlog' }).querySelector('.focus-flow__planning-toolbar')).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Expand FF-42' })).toHaveLength(1);
  });
  it('keeps a Task draft for WIP confirmation and closes only after creation succeeds', async () => {
    const user = userEvent.setup();
    const onCreateTask = vi.fn()
      .mockResolvedValueOnce({ kind: 'confirmation-required', message: 'Sprint scope limit exceeded.', excess: 1 })
      .mockRejectedValueOnce(new Error('Offline'))
      .mockResolvedValueOnce({ kind: 'created', path: 'Task.md' });
    render(<PlanView entities={[epic, story(), draft]} onCreateTask={onCreateTask} />);
    await user.click(screen.getByRole('button', { name: 'Expand FF-42' }));
    await user.click(screen.getByRole('button', { name: 'Create Task for FF-42' }));
    await user.type(screen.getByLabelText('New Task for FF-42'), 'A useful next step');
    await user.click(screen.getByRole('button', { name: 'Add Task to FF-42' }));
    expect(screen.getByLabelText('New Task for FF-42')).toHaveValue('A useful next step');
    await user.click(screen.getByRole('button', { name: 'Add anyway' }));
    expect(onCreateTask).toHaveBeenLastCalledWith(storyId, 'A useful next step', true);
    expect(screen.getByRole('alert')).toHaveTextContent('Offline');
    await user.click(screen.getByRole('button', { name: 'Add Task to FF-42' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('starts with Story details folded and opens the work in place', async () => {
    const user = userEvent.setup();
    render(<PlanView entities={[epic, story()]} />);
    expect(screen.queryByLabelText('New Task for FF-42')).not.toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Expand FF-42' })[0]!);
    expect(screen.queryByLabelText('New Task for FF-42')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create Task for FF-42' }));
    expect(screen.getByRole('dialog', { name: 'New Task' })).toBeInTheDocument();
    expect(screen.getByLabelText('New Task for FF-42')).toHaveFocus();
  });
  it('creates the single Draft Sprint from an empty Next Sprint area', async () => {
    const user = userEvent.setup();
    const onCreateDraft = vi.fn();

    render(
      <PlanView
        entities={[epic, story()]}
        onCreateDraft={onCreateDraft}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: 'Create Draft Sprint' }),
    );

    expect(onCreateDraft).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole('button', { name: 'Add FF-42 to Draft Sprint' }),
    ).not.toBeInTheDocument();
  });

  it('transfers a ready Story into Draft and returns it without extra bookkeeping', async () => {
    const user = userEvent.setup();
    const onAddStoryToDraft = vi.fn();
    const onRemoveStoryFromDraft = vi.fn();
    const onCancelDraft = vi.fn();
    const selected = story({
      lifecycle: 'draft_sprint',
      sprintId: draftId,
      sprintRank: 'a0',
    });
    const available = story({
      id: '019946f1-8d2a-7f05-87b1-1eebbb476301',
      key: 'FF-44',
      title: 'Make review notes useful',
      path: 'Focus Flow/Stories/FF-44 Make review notes useful.md',
      backlogRank: 'a1',
    });

    render(
      <PlanView
        entities={[draft, epic, selected, available]}
        onAddStoryToDraft={onAddStoryToDraft}
        onCancelDraft={onCancelDraft}
        onRemoveStoryFromDraft={onRemoveStoryFromDraft}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Draft Sprint' }),
    ).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Expand FF-44' })[0]!);
    await user.click(screen.getAllByRole('button', { name: 'Expand FF-42' })[0]!);
    await user.click(
      screen.getByRole('button', { name: 'Add FF-44 to Draft Sprint' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Remove FF-42 from Draft Sprint' }),
    );
    await user.click(screen.getByRole('button', { name: 'Cancel Draft Sprint' }));

    expect(onAddStoryToDraft).toHaveBeenCalledWith(available.id);
    expect(onRemoveStoryFromDraft).toHaveBeenCalledWith(selected.id);
    expect(onCancelDraft).toHaveBeenCalledOnce();
  });

  it('blocks start when a selected Story has no Acceptance Criteria', () => {
    const selected = story({
      lifecycle: 'draft_sprint',
      sprintId: draftId,
      sprintRank: 'a0',
      acceptanceCriteria: [],
    });

    render(
      <PlanView entities={[draft, epic, selected]} onStartSprint={vi.fn()} />,
    );

    expect(screen.getByText('FF-42 needs Acceptance Criteria.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Start Sprint' })).toBeDisabled();
  });

  it('requires an explicit soft-scope confirmation before starting', async () => {
    const user = userEvent.setup();
    const onStartSprint = vi.fn();
    const selected = story({
      lifecycle: 'draft_sprint',
      sprintId: draftId,
      sprintRank: 'a0',
    });

    render(
      <PlanView
        entities={[
          draft,
          epic,
          selected,
          task(),
          task({
            id: '01994706-857c-76f1-8006-85cd9bd80891',
            key: 'FF-45',
            title: 'Verify the review',
            taskRank: 'a1',
            path: 'Focus Flow/Tasks/FF-45 Verify the review.md',
          }),
        ]}
        onStartSprint={onStartSprint}
        sprintScopePolicy={{ mode: 'soft', limit: 1 }}
      />,
    );

    expect(screen.getByText('Open scope: 2 / 1')).toBeVisible();
    expect(screen.getByText('Soft limit exceeded by 1.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Start anyway' }));

    expect(onStartSprint).toHaveBeenCalledWith(true);
  });

  it('shows an overdue Active Sprint and prior Done Tasks as context', async () => {
    const user = userEvent.setup();
    const active: Extract<ProjectedManagedEntity, { type: 'sprint' }> = {
      id: draftId,
      type: 'sprint',
      lifecycle: 'active',
      code: 'SPR-001',
      sequence: 1,
      startsOn: '2026-08-24',
      dueOn: '2026-08-30',
      startedAt: '2026-08-24T08:30:00Z',
      provisionalStoryOutcomes: [],
      startSnapshot: {
        capturedAt: '2026-08-24T08:30:00Z',
        stories: [],
      },
      closedAt: null,
      closeSnapshot: null,
      path: 'Focus Flow/Sprints/SPR-001.md',
    };
    const selected = story({
      lifecycle: 'active_sprint',
      sprintId: draftId,
      sprintRank: 'a0',
    });
    const priorDone = task({
      lifecycle: 'done',
      status: 'done',
      completedAt: '2026-08-23T18:00:00Z',
    });

    render(
      <PlanView
        entities={[active, epic, selected, priorDone]}
        today="2026-08-31"
      />,
    );

    expect(screen.getByRole('heading', { name: 'SPR-001' })).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('Review due');
    await user.click(screen.getAllByRole('button', { name: 'Expand FF-42' })[0]!);
    expect(screen.getAllByText('Prior Done')).not.toHaveLength(0);
    expect(screen.getAllByText('Prepare the review')).not.toHaveLength(0);
    expect(
      screen.queryByRole('button', { name: 'Create Draft Sprint' }),
    ).not.toBeInTheDocument();
  });

  it('changes Active Sprint Story membership only through explicit Plan positions', async () => {
    const user = userEvent.setup();
    const active: Extract<ProjectedManagedEntity, { type: 'sprint' }> = {
      id: draftId,
      type: 'sprint',
      lifecycle: 'active',
      code: 'SPR-001',
      sequence: 1,
      startsOn: '2026-08-24',
      dueOn: '2026-08-30',
      startedAt: '2026-08-24T08:30:00Z',
      provisionalStoryOutcomes: [],
      startSnapshot: { capturedAt: '2026-08-24T08:30:00Z', stories: [] },
      closedAt: null,
      closeSnapshot: null,
      path: 'Focus Flow/Sprints/SPR-001.md',
    };
    const selected = story({
      lifecycle: 'active_sprint',
      sprintId: draftId,
      sprintRank: 'a0',
      backlogRank: null,
    });
    const available = story({
      id: '019946f1-8d2a-7f05-87b1-1eebbb476301',
      key: 'FF-44',
      title: 'Make review notes useful',
      path: 'Focus Flow/Stories/FF-44 Make review notes useful.md',
      backlogRank: 'a1',
    });
    const secondEpic = {
      ...epic,
      id: '019946c9-5f97-7196-8483-73469275ff91',
      key: 'FF-45',
      title: 'Improve reviews',
      backlogRank: 'a1',
      path: 'Focus Flow/Epics/FF-45 Improve reviews.md',
    };
    const add = vi
      .fn()
      .mockResolvedValueOnce({
        kind: 'confirmation-required',
        excess: 2,
        message: 'Confirm.',
      })
      .mockResolvedValueOnce({ kind: 'changed' });
    const remove = vi.fn();
    const reparent = vi.fn();

    const view = render(
      <PlanView
        entities={[active, epic, secondEpic, selected, available]}
        onAddStoryToActive={add}
        onRemoveStoryFromActive={remove}
        onReparentActiveStory={reparent}
      />,
    );

    await user.click(screen.getByRole('button', { name: `Add ${available.key} to Active Sprint` }));
    expect(add).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(add).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: `Add ${available.key} to Active Sprint` }));
    await user.click(screen.getByRole('button', { name: 'Add to Sprint' }));
    expect(add).toHaveBeenLastCalledWith(
      available.id,
      { beforeStoryId: selected.id, afterStoryId: null },
      false,
    );
    await user.click(screen.getByRole('button', { name: 'Add anyway' }));
    expect(add).toHaveBeenLastCalledWith(
      available.id,
      { beforeStoryId: selected.id, afterStoryId: null },
      true,
    );

    await user.click(screen.getByRole('button', { name: `Return ${selected.key} to Month backlog` }));
    expect(remove).not.toHaveBeenCalled();
    await user.click(screen.getByText('Position in Month backlog'));
    await user.selectOptions(screen.getByLabelText('Story position'), available.id);
    await user.click(screen.getByRole('button', { name: 'Return to Month' }));
    expect(remove).toHaveBeenCalledWith(selected.id, {
      beforeStoryId: null,
      afterStoryId: available.id,
    });

    await user.click(screen.getByLabelText(`Reorder ${selected.key}`));
    await user.click(screen.getByRole('menuitem', { name: `Move to ${secondEpic.key} ${secondEpic.title}` }));
    expect(reparent).toHaveBeenCalledWith(selected.id, secondEpic.id);

    view.rerender(
      <PlanView
        entities={[active, epic, secondEpic, selected, available]}
        onAddStoryToActive={add}
        onRemoveStoryFromActive={remove}
        onReparentActiveStory={reparent}
        pending
      />,
    );
    expect(screen.getByRole('button', { name: `Add ${available.key} to Active Sprint` })).toBeDisabled();
    expect(screen.getByRole('button', { name: `Return ${selected.key} to Month backlog` })).toBeDisabled();
    await user.click(screen.getByLabelText(`Reorder ${selected.key}`));
    expect(screen.getByRole('menuitem', { name: `Move to ${secondEpic.key} ${secondEpic.title}` })).toBeDisabled();
  });

  it('completes or closes a ready Epic and blocks both actions for an active child', async () => {
    const user = userEvent.setup();
    const readyEpic = {
      ...epic,
      acceptanceCriteria: [{ text: 'Direction achieved', checked: true }],
    };
    const terminalChild = story({
      lifecycle: 'done',
      backlogRank: null,
      completedAt: '2026-09-01T12:00:00Z',
      outcome: 'achieved',
    });
    const complete = vi.fn();
    const close = vi.fn();
    const view = render(
      <PlanView
        entities={[readyEpic, terminalChild]}
        onCompleteEpic={complete}
        onCloseEpic={close}
      />,
    );

    if (screen.queryByRole('button', { name: 'Expand FF-40' })) await user.click(screen.getByRole('button', { name: 'Expand FF-40' }));
    await user.click(screen.getByRole('button', { name: 'Actions for FF-40' }));
    await user.click(screen.getByRole('menuitem', { name: 'Complete FF-40' }));
    expect(complete).toHaveBeenCalledWith(epic.id);
    if (screen.queryByRole('button', { name: 'Expand FF-40' })) await user.click(screen.getByRole('button', { name: 'Expand FF-40' }));
    await user.click(screen.getByRole('button', { name: 'Actions for FF-40' }));
    await user.click(screen.getByRole('menuitem', { name: 'Close FF-40…' }));
    await user.type(
      screen.getByLabelText('Close reason for FF-40'),
      'Direction changed.',
    );
    await user.click(screen.getByRole('button', { name: 'Close FF-40' }));
    expect(close).toHaveBeenCalledWith(epic.id, 'Direction changed.');

    view.rerender(
      <PlanView
        entities={[readyEpic, story()]}
        onCompleteEpic={complete}
        onCloseEpic={close}
      />,
    );
    if (screen.queryByRole('button', { name: 'Expand FF-40' })) await user.click(screen.getByRole('button', { name: 'Expand FF-40' }));
    await user.click(screen.getByRole('button', { name: 'Actions for FF-40' }));
    expect(screen.getByRole('menuitem', { name: 'Complete FF-40' })).toBeDisabled();
    expect(screen.getByRole('menuitem', { name: 'Close FF-40…' })).toBeDisabled();
  });

  it('keeps a reloaded terminal Epic out of planning targets', async () => {
    render(
      <PlanView
        entities={[
          {
            ...epic,
            lifecycle: 'done',
            backlogRank: null,
            completedAt: '2026-09-01T12:00:00Z',
            closedAt: null,
            closeReason: null,
          },
          story(),
        ]}
      />,
    );

    expect(
      screen.queryByRole('button', { name: 'Open FF-40 Epic' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('No active Epics.')).toBeInTheDocument();
  });
});
