import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { activeSprint, activeStory, doneTask, readyFocusEntities, secondTask, story, task } from '../../test/storybook/fixtures';
import { withHostFrame } from '../../test/storybook/host-frames';
import type { MoveTaskRequest, MoveTaskResult } from '../../application/focus/focus-board';
import type { ProjectedManagedEntity } from '../../application/indexing/work-index';
import type { CreateTaskResult } from '../../application/work/create-work';
import { FocusView } from './FocusView';
import { expectChildrenInside } from '../../test/storybook/layout-assertions';

const created: CreateTaskResult = { kind: 'created', path: 'Focus Flow/Tasks/FF-49 New task.md' };

const meta = {
  title: 'Features/Focus/FocusView',
  component: FocusView,
  decorators: [withHostFrame('leaf')],
  args: {
    entities: readyFocusEntities,
    dragEnabled: true,
    onMoveTask: fn<(request: MoveTaskRequest) => Promise<MoveTaskResult>>(),
    onCreateTask: fn<(storyId: string, title: string, confirmWipExcess: boolean) => Promise<CreateTaskResult>>(),
    onOpenNote: fn(),
    onEditOutcome: fn(async () => undefined),
  },
} satisfies Meta<typeof FocusView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loaded: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await expect(canvas.getByRole('heading', { name: 'SPR-001' })).toBeVisible();
    await expect(canvas.getByRole('region', { name: 'Sprint kanban board' })).toBeVisible();
    for (const title of canvasElement.querySelectorAll<HTMLElement>('.focus-flow__board-task .focus-flow__title-link')) await expectChildrenInside(title);
    for (const button of canvasElement.querySelectorAll<HTMLElement>('.focus-flow__task-next')) {
      const bounds = button.getBoundingClientRect();
      await expect(Math.abs(bounds.width - bounds.height)).toBeLessThan(1);
      await expect(getComputedStyle(button).getPropertyValue('corner-shape')).toBe('round');
    }
    const toggle = canvas.getByRole('checkbox', { name: 'All statuses' });
    await userEvent.click(toggle);
    await expect(getComputedStyle(toggle, '::after').display).toBe('none');
  },
};

export const SmoothCrossColumnDragRegression: Story = {
  render: () => <SmoothTaskDragHarness />,
  tags: ['!autodocs'],
  play: async ({ canvasElement }) => {
    const { document, target, targetBounds, view } = await dragSecondTaskToTodo(canvasElement);
    const handoff = observeDragHandoff(document, target, view, secondTask.id);
    try {
      const overlay = document.querySelector<HTMLElement>(`[data-board-drag-overlay="${secondTask.id}"]`);
      await expect(overlay).toBeVisible();
      await expect(overlay).toHaveAttribute('data-board-drag-target-group', `${activeStory.id}:todo`);
      await new Promise((resolve) => view.setTimeout(resolve, 300));
      const landedOverlay = document.querySelector<HTMLElement>(`[data-board-drag-overlay="${secondTask.id}"]`)!;
      const overlayBounds = landedOverlay.getBoundingClientRect();
      await expect(overlayBounds.left).toBeGreaterThanOrEqual(targetBounds.left - 1);
      await expect(overlayBounds.right).toBeLessThanOrEqual(targetBounds.right + 1);

      await waitFor(async () => {
        await expect(document.querySelector(`[data-board-drag-overlay="${secondTask.id}"]`)).not.toBeInTheDocument();
        await expect(within(target).getByText('Verify the weekly signal')).toBeVisible();
      });
      await new Promise((resolve) => view.requestAnimationFrame(resolve));
    } finally {
      handoff.stop();
    }

    await expect(handoff.frames.length).toBeGreaterThan(0);
    await expect(handoff.frames.every((frame) => frame.visibleCopies === 1)).toBe(true);
    await expect(handoff.frames.some((frame) => frame.slot && frame.canonicalInTarget)).toBe(false);
    await expect(Math.max(...handoff.frames.map((frame) => frame.rowHeight))).toBeLessThanOrEqual(handoff.initialRowHeight + 1);
  },
};

export const SmoothDragSoftWipCancel: Story = {
  render: () => <FocusView dragEnabled entities={readyFocusEntities} onMoveTask={async () => ({ kind: 'confirmation-required', message: 'Moving to TODO exceeds its WIP limit by 1.' })} />,
  tags: ['!autodocs'],
  play: async ({ canvasElement }) => {
    const { document, target, user } = await dragSecondTaskToTodo(canvasElement);
    const body = within(document.body);
    const dialog = await body.findByRole('dialog', { name: 'Move FF-44 despite WIP limit?' });
    await expect(dialog).toHaveTextContent('exceeds its WIP limit');
    await expect(document.querySelector(`[data-board-drag-overlay="${secondTask.id}"]`)).toBeVisible();
    await expect(within(target).queryByText('Verify the weekly signal')).not.toBeInTheDocument();

    await user.keyboard('{Escape}');

    await waitFor(async () => {
      await expect(body.queryByRole('dialog')).not.toBeInTheDocument();
      await expect(document.querySelector(`[data-board-drag-overlay="${secondTask.id}"]`)).not.toBeInTheDocument();
      await expect(body.getByRole('region', { name: 'FF-42 Today tasks' })).toHaveTextContent('Verify the weekly signal');
    });
  },
};

async function dragSecondTaskToTodo(canvasElement: HTMLElement) {
  const document = canvasElement.ownerDocument;
  const view = document.defaultView!;
  const canvas = within(canvasElement);
  const handle = canvas.getByRole('button', { name: 'Drag FF-44 Verify the weekly signal' });
  const target = canvas.getByRole('region', { name: 'FF-42 TODO tasks' });
  const user = userEvent.setup();
  const handleBounds = handle.getBoundingClientRect();
  const targetBounds = target.getBoundingClientRect();

  await user.pointer({ keys: '[MouseLeft>]', target: handle, coords: { clientX: handleBounds.x + handleBounds.width / 2, clientY: handleBounds.y + handleBounds.height / 2 } });
  await user.pointer({ target, coords: { clientX: targetBounds.x + targetBounds.width / 2, clientY: targetBounds.y + 48 } });
  await new Promise((resolve) => view.requestAnimationFrame(() => view.requestAnimationFrame(resolve)));
  await user.pointer({ keys: '[/MouseLeft]', target, coords: { clientX: targetBounds.x + targetBounds.width / 2, clientY: targetBounds.y + 48 } });
  return { document, target, targetBounds, user, view };
}

function observeDragHandoff(document: Document, target: HTMLElement, view: Window, taskId: string) {
  const frames: Array<{ canonicalInTarget: boolean; rowHeight: number; slot: boolean; visibleCopies: number }> = [];
  const initialRowHeight = target.getBoundingClientRect().height;
  let active = true;
  const sample = () => {
    const copies = Array.from(document.querySelectorAll<HTMLElement>(`[data-board-drag-id="${taskId}"], [data-board-drag-overlay="${taskId}"]`));
    frames.push({
      canonicalInTarget: target.querySelector(`[data-board-drag-id="${taskId}"]`) !== null,
      rowHeight: target.getBoundingClientRect().height,
      slot: target.querySelector('[data-board-drop-slot]') !== null,
      visibleCopies: copies.filter((element) => {
        const style = getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0;
      }).length,
    });
    if (active) view.requestAnimationFrame(sample);
  };
  sample();
  return { frames, initialRowHeight, stop: () => { active = false; } };
}

function SmoothTaskDragHarness() {
  const [entities, setEntities] = useState<readonly ProjectedManagedEntity[]>(readyFocusEntities);
  const move = async (request: MoveTaskRequest): Promise<MoveTaskResult> => {
    await new Promise((resolve) => window.setTimeout(resolve, 800));
    setEntities((current) => current.map((entity) => entity.type === 'task' && entity.id === request.taskId
      ? { ...entity, status: request.targetStatus, lifecycle: request.targetStatus === 'done' ? 'done' : 'active' }
      : entity));
    return { kind: 'moved' };
  };
  return <FocusView dragEnabled entities={entities} onMoveTask={move} />;
}

export const NoActiveSprint: Story = { args: { entities: [], dragEnabled: false } };

export const MultipleActiveSprints: Story = {
  args: {
    entities: [
      activeSprint,
      activeStory,
      { ...activeSprint, id: '01994744-a401-759a-b582-4418f2f24060', code: 'SPR-002', path: 'Focus Flow/Sprints/SPR-002.md' },
    ],
    dragEnabled: false,
  },
};

export const EmptyStoryLanes: Story = { args: { entities: [activeSprint], dragEnabled: false } };

export const PriorDoneTask: Story = {
  args: { entities: [activeSprint, activeStory, { ...doneTask, id: '01994706-857c-76f1-8006-85cd9bd80890' }], dragEnabled: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await expect(canvas.getByText('Done before Sprint')).toBeVisible();
  },
};

export const ReopenedPriorDoneTask: Story = {
  args: { entities: [activeSprint, activeStory, task], dragEnabled: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await expect(canvas.getByText('Draft the review')).toBeVisible();
    await expect(canvas.queryByText('Done before Sprint')).not.toBeInTheDocument();
  },
};

export const MobileColumn: Story = {
  args: { dragEnabled: false },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await expect(canvas.getByRole('combobox', { name: 'Task column' })).toHaveValue('today');
    await expect(canvas.queryByRole('button', { name: /^Drag / })).not.toBeInTheDocument();
  },
};

export const MobileSingleStatus: Story = {
  args: { dragEnabled: false },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Task column' }), 'today');
    await expect(canvas.getByText('Verify the weekly signal')).toBeVisible();
  },
};

export const MoveSoftWipConfirmation: Story = {
  args: {
    onMoveTask: fn(async (_request: MoveTaskRequest) => ({ kind: 'confirmation-required' as const, message: 'Moving to In Progress exceeds its WIP limit by 1.' })),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'More actions for FF-44' }));
    await userEvent.click(within(canvasElement.ownerDocument.body).getByRole('menuitem', { name: 'Move to In Progress' }));
    const dialog = canvas.getByRole('dialog', { name: 'Move FF-44 despite WIP limit?' });
    await expect(dialog).toHaveTextContent('exceeds its WIP limit');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Move anyway' }));
    await expect(args.onMoveTask).toHaveBeenCalledTimes(2);
  },
};

export const MoveHardWipRejected: Story = {
  args: {
    onMoveTask: fn(async (_request: MoveTaskRequest) => ({ kind: 'rejected' as const, message: 'In Progress has a hard WIP limit of 1.' })),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'More actions for FF-44' }));
    await userEvent.click(within(canvasElement.ownerDocument.body).getByRole('menuitem', { name: 'Move to In Progress' }));
    await expect(canvas.getByRole('alert')).toHaveTextContent('hard WIP limit');
  },
};

export const MoveFailure: Story = {
  args: { onMoveTask: fn(async (_request: MoveTaskRequest) => { throw new Error('writer failed'); }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'More actions for FF-44' }));
    await userEvent.click(within(canvasElement.ownerDocument.body).getByRole('menuitem', { name: 'Move to In Progress' }));
    await expect(canvas.getByRole('alert')).toHaveTextContent('writer failed');
  },
};

export const TaskCreation: Story = {
  args: { dragEnabled: false, onCreateTask: fn(async (_storyId: string, _title: string, _confirmWipExcess: boolean) => created) },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'Create Task for FF-42' }));
    await userEvent.type(canvas.getByRole('textbox', { name: 'New Task' }), 'Capture a useful next step');
    await userEvent.click(canvas.getByRole('button', { name: 'Add Task' }));
    await expect(args.onCreateTask).toHaveBeenCalledWith(activeStory.id, 'Capture a useful next step', false);
  },
};

export const TaskCreationSoftScopeConfirmation: Story = {
  args: {
    dragEnabled: false,
    onCreateTask: fn(async (_storyId: string, _title: string, confirmed: boolean) => confirmed ? created : { kind: 'confirmation-required' as const, excess: 1, message: 'Sprint scope exceeds its WIP limit by 1.' }),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'Create Task for FF-42' }));
    await userEvent.type(canvas.getByRole('textbox', { name: 'New Task' }), 'Add within scope');
    await userEvent.click(canvas.getByRole('button', { name: 'Add Task' }));
    await expect(canvas.getByRole('alert')).toHaveTextContent('Sprint scope exceeds');
    await userEvent.click(canvas.getByRole('button', { name: 'Add anyway' }));
    await expect(args.onCreateTask).toHaveBeenCalledTimes(2);
  },
};

export const TaskCreationRejected: Story = {
  args: {
    dragEnabled: false,
    onCreateTask: fn(async (_storyId: string, _title: string, _confirmWipExcess: boolean) => ({ kind: 'rejected' as const, message: 'Sprint scope has a hard WIP limit of 1.' })),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'Create Task for FF-42' }));
    await userEvent.type(canvas.getByRole('textbox', { name: 'New Task' }), 'Blocked task');
    await userEvent.click(canvas.getByRole('button', { name: 'Add Task' }));
    await expect(canvas.getByRole('alert')).toHaveTextContent('hard WIP limit');
  },
};

export const Pending: Story = { args: { pending: true } };

export const LongUnbrokenText: Story = {
  args: { dragEnabled: false, entities: [activeSprint, { ...activeStory, title: 'A very long unbroken-reference-identifier-2026-09-04-that-must-wrap' }, { ...secondTask, title: 'Verify a very long unbroken-reference-identifier-2026-09-04-that-must-wrap' }] },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};

export const StoryWithoutTasks: Story = { args: { entities: [activeSprint, story], dragEnabled: false } };

export const NarrowPanelAndPortal: Story = {
  globals: { theme: 'community' },
  render: (args) => <div style={{ width: 320, maxWidth: '100%' }}><FocusView {...args} /></div>,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByRole('combobox', { name: 'Task column' })).toBeVisible());
    await expect(canvas.queryByRole('button', { name: /^Drag / })).not.toBeInTheDocument();
    const board = canvasElement.querySelector<HTMLElement>('.focus-flow__focus-board')!;
    await expect(board.scrollWidth).toBeLessThanOrEqual(board.clientWidth);
    const trigger = canvas.getByRole('button', { name: 'Create Task for FF-42' });
    const expectedAccent = getComputedStyle(trigger).getPropertyValue('--ff-accent');
    await userEvent.click(trigger);
    const body = within(canvasElement.ownerDocument.body);
    const dialog = body.getByRole('dialog', { name: 'New Task' });
    await expect(getComputedStyle(dialog).getPropertyValue('--ff-accent')).toBe(expectedAccent);
    const input = body.getByRole('textbox', { name: 'New Task' });
    await expect(input).toHaveFocus();
    await userEvent.type(input, 'Keep my draft');
    await userEvent.keyboard('{Escape}');
    await expect(trigger).toHaveFocus();
    await userEvent.click(trigger);
    await expect(body.getByRole('textbox', { name: 'New Task' })).toHaveValue('Keep my draft');
  },
};
