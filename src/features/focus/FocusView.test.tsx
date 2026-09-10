import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { WorkIndexSnapshot } from '../../application/indexing/work-index';
import { FocusView } from './FocusView';

const sprintId = '01994744-a401-759a-b582-4418f2f2405f';
const storyId = '019946f1-8d2a-7f05-87b1-1eebbb476300';

it.each([false, true])('edits a Task from its menu (desktop board: %s)', async (dragEnabled) => {
  const user = userEvent.setup();
  const onEditOutcome = vi.fn().mockResolvedValue(undefined);
  render(<FocusView entities={entities} dragEnabled={dragEnabled} onEditOutcome={onEditOutcome} />);
  if (!dragEnabled) await user.selectOptions(screen.getByLabelText('Task column'), 'todo');
  await user.click(screen.getByRole('button', { name: 'More actions for FF-43' }));
  await user.click(screen.getByRole('menuitem', { name: 'Edit…' }));
  const dialog = screen.getByRole('dialog', { name: 'Edit FF-43' });
  await user.clear(within(dialog).getByLabelText('Title'));
  await user.type(within(dialog).getByLabelText('Title'), 'A clearer task');
  await user.type(within(dialog).getByLabelText('Description'), 'Keep **context**');
  await user.type(within(dialog).getByRole('combobox', { name: 'Tags' }), 'ux{Enter}');
  await user.click(within(dialog).getByRole('button', { name: 'Add criterion' }));
  await user.type(within(dialog).getByLabelText('Criterion 1'), 'Works\n- On mobile');
  await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));
  expect(onEditOutcome).toHaveBeenCalledWith(expect.objectContaining({ id: todo.id, type: 'task', title: 'A clearer task', tags: ['ux'], bodyFields: { Description: 'Keep **context**' }, acceptanceCriteria: [{ text: 'Works\n- On mobile', checked: false }] }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('creates a Task with Description, criteria and own tags', async () => {
  const user = userEvent.setup();
  const onCreateTask = vi.fn().mockResolvedValue({ kind: 'created', path: 'Task.md' });
  render(<FocusView entities={entities} dragEnabled={false} onCreateTask={onCreateTask} />);
  await user.click(screen.getByRole('button', { name: 'Create Task for FF-42' }));
  await user.type(screen.getByRole('textbox', { name: 'New Task' }), 'Check the flow');
  await user.type(screen.getByLabelText('Description'), 'A **small** action');
  await user.click(screen.getByRole('button', { name: 'Add criterion' }));
  await user.type(screen.getByLabelText('Criterion 1'), 'Verified');
  await user.type(screen.getByRole('combobox', { name: 'Tags' }), 'ux{Enter}');
  await user.click(screen.getByRole('button', { name: 'Add Task' }));
  expect(onCreateTask).toHaveBeenCalledWith(storyId, 'Check the flow', false, { tags: ['ux'], bodyFields: { Description: 'A **small** action', 'Acceptance Criteria': '- [ ] Verified' } });
});

it('opens the active Story editor without leaving Focus', async () => {
  const user = userEvent.setup();
  const onEditOutcome = vi.fn().mockResolvedValue(undefined);
  render(<FocusView entities={entities} dragEnabled={false} onEditOutcome={onEditOutcome} />);
  await user.click(screen.getByRole('button', { name: 'Actions for FF-42' }));
  await user.click(screen.getByRole('menuitem', { name: 'Edit…' }));
  const dialog = screen.getByRole('dialog', { name: 'Edit FF-42' });
  expect(within(dialog).getByRole('group', { name: 'Acceptance Criteria' })).toBeInTheDocument();
  await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));
  expect(onEditOutcome).toHaveBeenCalledWith(expect.objectContaining({ id: storyId, type: 'story' }));
});

function task(
  id: string,
  key: string,
  status: 'todo' | 'today' | 'in_progress' | 'done',
  rank: string,
) {
  return {
    id,
    key,
    title: `${key} task`,
    type: 'task' as const,
    lifecycle: status === 'done' ? ('done' as const) : ('active' as const),
    storyId,
    storyLink: '[[Focus Flow/Stories/FF-42 Weekly focus]]',
    taskRank: rank,
    status,
    startedAt: null,
    completedAt: status === 'done' ? '2026-08-30T10:00:00.000Z' : null,
    createdAt: '2026-08-30T09:15:00.000Z',
    tags: [],
    effectiveTags: [],
    path: `Focus Flow/Tasks/${key} task.md`,
  };
}

const todo = task('01994706-857c-76f1-8006-85cd9bd80890', 'FF-43', 'todo', 'a0');
const today = task('01994706-857c-76f1-8006-85cd9bd80891', 'FF-44', 'today', 'a1');
const oldDone = task('01994706-857c-76f1-8006-85cd9bd80892', 'FF-45', 'done', 'a2');

const entities: WorkIndexSnapshot['entities'] = [
  {
    id: sprintId,
    type: 'sprint',
    lifecycle: 'active',
    code: 'SPR-001',
    sequence: 1,
    startsOn: '2026-08-31',
    dueOn: '2026-09-06',
    startedAt: '2026-08-31T08:00:00.000Z',
    provisionalStoryOutcomes: [],
    startSnapshot: {
      capturedAt: '2026-08-31T08:00:00.000Z',
      stories: [
        {
          id: storyId,
          key: 'FF-42',
          title: 'Weekly focus',
          epicId: '019946c9-5f97-7196-8483-73469275ff90',
          sprintRank: 'a0',
          acceptanceCriteriaHash: `sha256:${'0'.repeat(64)}`,
          acceptanceCriteria: [{ text: 'Board is useful', checked: false }],
          effectiveTags: [],
          tasks: [
            {
              id: oldDone.id,
              key: oldDone.key,
              title: oldDone.title,
              taskRank: oldDone.taskRank,
              status: 'done',
              completedBeforeSprint: true,
              effectiveTags: [],
            },
          ],
        },
      ],
    },
    closedAt: null,
    closeSnapshot: null,
    path: 'Focus Flow/Sprints/SPR-001.md',
  },
  {
    id: storyId,
    key: 'FF-42',
    title: 'Weekly focus',
    type: 'story',
    lifecycle: 'active_sprint',
    epicId: '019946c9-5f97-7196-8483-73469275ff90',
    epicLink: '[[Focus Flow/Epics/FF-40 Calm system]]',
    backlogRank: null,
    sprintId,
    sprintRank: 'a0',
    acceptanceCriteria: [{ text: 'Board is useful', checked: false }],
    createdAt: '2026-08-30T09:00:00.000Z',
    tags: [],
    effectiveTags: [],
    path: 'Focus Flow/Stories/FF-42 Weekly focus.md',
  },
  todo,
  today,
  oldDone,
];

describe('FocusView', () => {
  it('finds a Story without a dropdown and clears the filter in one click', async () => {
    const user = userEvent.setup();
    const original = entities.find((entity) => entity.type === 'story')!;
    render(<FocusView dragEnabled entities={[...entities, { ...original, id: 'other-story', key: 'FF-50', title: 'Deep work', sprintRank: 'a1' }]} />);
    expect(screen.queryByRole('combobox', { name: 'Filter by Story' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Filter by Story' }));
    await user.type(screen.getByRole('searchbox', { name: 'Find a Story' }), 'Deep');
    await user.click(screen.getByRole('button', { name: 'Show FF-50 Deep work' }));
    expect(screen.queryByRole('region', { name: 'FF-42 Today tasks' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear Story filter' }));
    expect(screen.getByRole('region', { name: 'FF-42 Today tasks' })).toBeInTheDocument();
  });
  it('shows a kanban flow and reveals empty secondary columns on request', async () => {
    const user = userEvent.setup();
    render(<FocusView dragEnabled entities={entities} />);

    expect(screen.getByRole('heading', { name: 'SPR-001' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Sprint kanban board' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'FF-42 TODO tasks' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'FF-42 Today tasks' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'FF-42 In Progress tasks' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show Done tasks' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'FF-42 Done tasks' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'FF-42 On Hold tasks' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'All statuses' }));
    expect(screen.getByRole('region', { name: 'FF-42 On Hold tasks' })).toBeInTheDocument();
  });

  it('starts a Today Task directly through the normal movement contract', async () => {
    const user = userEvent.setup();
    const onMoveTask = vi.fn().mockResolvedValue({ kind: 'moved' });
    render(<FocusView dragEnabled={false} entities={entities} onMoveTask={onMoveTask} />);
    await user.click(screen.getByRole('button', { name: 'Start FF-44' }));
    expect(onMoveTask).toHaveBeenCalledWith(expect.objectContaining({
      taskId: today.id, targetStatus: 'in_progress', confirmWipExcess: false,
    }));
  });

  it('shows one selected column on mobile and never mounts drag handles', async () => {
    const user = userEvent.setup();
    render(<FocusView dragEnabled={false} entities={entities} />);

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Drag / })).not.toBeInTheDocument();
    expect(screen.queryByText('FF-43 task')).not.toBeInTheDocument();
    expect(screen.getByText('FF-44 task')).toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Task column' }), 'todo');
    expect(screen.getByText('FF-43 task')).toBeInTheDocument();
    expect(screen.queryByText('FF-44 task')).not.toBeInTheDocument();
  });

  it('offers only valid Move destinations and sends canonical end neighbors', async () => {
    const user = userEvent.setup();
    const onMoveTask = vi.fn().mockResolvedValue({ kind: 'moved' });
    render(
      <FocusView
        dragEnabled={false}
        entities={entities}
        onMoveTask={onMoveTask}
      />,
    );

    await user.selectOptions(screen.getByRole('combobox', { name: 'Task column' }), 'todo');
    await user.click(screen.getByRole('button', { name: 'More actions for FF-43' }));
    const menu = screen.getByRole('menu');
    expect(within(menu).getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Move to Tomorrow', 'Move to Today']);
    await user.click(within(menu).getByRole('menuitem', { name: 'Move to Today' }));
    expect(onMoveTask).toHaveBeenCalledWith({
      taskId: todo.id,
      targetStatus: 'today',
      beforeTaskId: today.id,
      afterTaskId: null,
      confirmWipExcess: false,
    });
  });

  it('asks before confirming soft WIP and retries the same move', async () => {
    const user = userEvent.setup();
    const onMoveTask = vi
      .fn()
      .mockResolvedValueOnce({
        kind: 'confirmation-required',
        excess: 1,
        message: 'Moving to Today exceeds its WIP limit by 1.',
      })
      .mockResolvedValueOnce({ kind: 'moved' });
    render(
      <FocusView
        dragEnabled={false}
        entities={entities}
        onMoveTask={onMoveTask}
      />,
    );

    await user.selectOptions(screen.getByRole('combobox', { name: 'Task column' }), 'todo');
    await user.click(screen.getByRole('button', { name: 'More actions for FF-43' }));
    await user.click(screen.getByRole('menuitem', { name: 'Move to Today' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Moving to Today exceeds its WIP limit by 1.',
    );

    await user.click(screen.getByRole('button', { name: 'Move anyway' }));
    expect(onMoveTask).toHaveBeenLastCalledWith(
      expect.objectContaining({ confirmWipExcess: true }),
    );
  });

  it('creates a Task without a reason and confirms soft Sprint Scope WIP', async () => {
    const user = userEvent.setup();
    const onCreateTask = vi
      .fn()
      .mockResolvedValueOnce({
        kind: 'confirmation-required',
        excess: 1,
        message: 'Sprint scope exceeds its WIP limit by 1.',
      })
      .mockResolvedValueOnce({
        kind: 'created',
        path: 'Focus Flow/Tasks/FF-46 Test narrow screen.md',
      });
    render(
      <FocusView
        dragEnabled={false}
        entities={entities}
        onCreateTask={onCreateTask}
      />,
    );

    expect(screen.queryByLabelText('New Task')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create Task for FF-42' }));
    await user.type(screen.getByRole('textbox', { name: 'New Task' }), 'Test narrow screen');
    await user.click(screen.getByRole('button', { name: 'Add Task' }));
    expect(onCreateTask).toHaveBeenCalledWith(
      storyId,
      'Test narrow screen',
      false,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Sprint scope exceeds its WIP limit by 1.',
    );

    await user.click(screen.getByRole('button', { name: 'Add anyway' }));
    expect(onCreateTask).toHaveBeenLastCalledWith(
      storyId,
      'Test narrow screen',
      true,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows a hard Sprint Scope rejection without offering confirmation', async () => {
    const user = userEvent.setup();
    const onCreateTask = vi.fn().mockResolvedValue({
      kind: 'rejected',
      message: 'Sprint scope has a hard WIP limit of 3.',
    });
    render(
      <FocusView
        dragEnabled={false}
        entities={entities}
        onCreateTask={onCreateTask}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Create Task for FF-42' }));
    await user.type(screen.getByRole('textbox', { name: 'New Task' }), 'Blocked Task');
    await user.click(screen.getByRole('button', { name: 'Add Task' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Sprint scope has a hard WIP limit of 3.',
    );
    expect(
      screen.queryByRole('button', { name: 'Add anyway' }),
    ).not.toBeInTheDocument();
  });
});
