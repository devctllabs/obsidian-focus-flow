import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { activeSprint, draftSprint, draftStory, epic, readyPlanEntities, secondStory, story, task } from '../../test/storybook/fixtures';
import { withHostFrame } from '../../test/storybook/host-frames';
import { PlanView } from './PlanView';
import { closedSprint } from '../../test/storybook/fixtures';

const meta = {
  title: 'Features/Plan/PlanView',
  component: PlanView,
  decorators: [withHostFrame('leaf')],
  args: {
    entities: readyPlanEntities,
    onOpenNote: fn(),
    onEditOutcome: fn(async () => undefined),
    onCreateTask: fn(async () => ({ kind: 'created' as const, path: 'preview.md' })),
    onReorder: fn(),
    onCreateDraft: fn(),
    onAddStoryToDraft: fn(),
    onRemoveStoryFromDraft: fn(),
    onCancelDraft: fn(),
    onStartSprint: fn(),
    onAddStoryToActive: fn(),
    onRemoveStoryFromActive: fn(),
    onReparentActiveStory: fn(),
    onCompleteEpic: fn(),
    onCloseEpic: fn(),
    today: '2026-08-30',
  },
} satisfies Meta<typeof PlanView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loaded: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: /Open FF-40/ })).toBeVisible();
    const month = canvas.getByRole('region', { name: 'Month backlog' }).getBoundingClientRect();
    const epics = canvas.getByRole('region', { name: 'Epic backlog' }).getBoundingClientRect();
    await expect(epics.top).toBeGreaterThan(month.bottom);
    await expect(epics.left).toBe(month.left);
  },
};

export const EmptyMonthDropZone: Story = {
  args: { entities: [activeSprint, { ...draftStory, lifecycle: 'active_sprint' as const }, epic], dragEnabled: true },
  play: async ({ canvasElement }) => {
    const month = within(canvasElement).getByRole('region', { name: 'Month backlog' });
    await expect(month.querySelector('.focus-flow__empty-drop-target')).toBeInTheDocument();
    await expect(month.querySelector('.focus-flow__empty-drop-target')!.getBoundingClientRect().height).toBeGreaterThan(24);
  },
};

export const NoDraftSprint: Story = {
  args: { entities: [story, epic] },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Create Draft Sprint' }));
    await expect(args.onCreateDraft).toHaveBeenCalled();
  },
};

export const EmptyBacklogs: Story = { args: { entities: [] } };

export const MissingCriteria: Story = { args: { entities: [epic, activeSprint, { ...story, acceptanceCriteria: [] }] } };
export const CriteriaHelpOpen: Story = {
  ...MissingCriteria,
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(page.getByRole('button', { name: 'Why FF-42 cannot enter a Sprint' }));
    await expect(page.getByRole('dialog', { name: 'Sprint requirement' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add FF-42 to Active Sprint' })).toBeDisabled();
  },
};

export const MultipleOpenSprints: Story = {
  args: {
    entities: [
      draftSprint,
      { ...draftSprint, id: '01994744-a401-759a-b582-4418f2f24060', path: 'Focus Flow/Sprints/DRAFT-2.md' },
    ],
  },
};

export const DraftReady: Story = {
  args: { entities: [draftSprint, draftStory, task, epic] },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Start Sprint' }));
    await expect(args.onStartSprint).toHaveBeenCalledWith(false);
  },
};

export const LateCalendarStart: Story = {
  args: { entities: [draftSprint, draftStory, task, epic], today: '2026-09-04' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/3 calendar days remaining/)).toBeVisible();
    await expect(canvas.getByText('2026-08-31 – 2026-09-06')).toBeVisible();
  },
};
export const OccupiedCalendarWeek: Story = {
  args: { entities: [draftSprint, draftStory, task, epic, { ...closedSprint, startsOn: '2026-08-31', dueOn: '2026-09-06' }], today: '2026-09-04' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Start Sprint' })).toBeDisabled();
    await expect(canvas.getByRole('status')).toHaveTextContent('you can start on 2026-09-07');
  },
};

export const MissingAcceptanceCriteria: Story = {
  args: { entities: [draftSprint, { ...draftStory, acceptanceCriteria: [] }, epic] },
};

export const SoftScopeExceeded: Story = {
  args: {
    entities: [draftSprint, draftStory, { ...task, status: 'today' as const }, { ...task, id: '01994706-857c-76f1-8006-85cd9bd80891', key: 'FF-44', taskRank: 'a1', title: 'Verify the weekly signal', status: 'today' as const }, epic],
    sprintScopePolicy: { mode: 'soft', limit: 1 },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Start anyway' }));
    await expect(args.onStartSprint).toHaveBeenCalledWith(true);
  },
};

export const HardScopeRejected: Story = {
  args: {
    entities: [draftSprint, draftStory, task, { ...task, id: '01994706-857c-76f1-8006-85cd9bd80891', key: 'FF-44', taskRank: 'a1', title: 'Verify the weekly signal' }, epic],
    sprintScopePolicy: { mode: 'hard', limit: 1 },
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: 'Start Sprint' })).toBeDisabled();
  },
};

export const ActiveSprintOverdue: Story = {
  args: { entities: [activeSprint, { ...draftStory, lifecycle: 'active_sprint' as const }, epic], today: '2026-09-01' },
};

export const EpicFinalizationBlocked: Story = {
  args: { entities: [epic, story] },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Expand FF-40' }));
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Actions for FF-40' }));
    await expect(within(canvasElement.ownerDocument.body).getByRole('menuitem', { name: 'Complete FF-40' })).toBeDisabled();
  },
};

export const EpicReadyToComplete: Story = {
  args: {
    entities: [
      { ...epic, acceptanceCriteria: [{ text: 'Outcome is complete', checked: true }] },
      { ...story, lifecycle: 'done' as const, backlogRank: null, sprintId: null, sprintRank: null, completedAt: '2026-08-30T18:00:00Z', outcome: 'achieved' as const },
    ],
  },
};

export const ActiveStoryMembershipConfirmation: Story = {
  args: {
    entities: [activeSprint, { ...story, lifecycle: 'active_sprint' as const, sprintId: activeSprint.id, sprintRank: 'a0' }, secondStory, epic],
    onAddStoryToActive: fn(async () => ({ kind: 'confirmation-required' as const, excess: 1, message: 'Sprint scope exceeds its WIP limit by 1.' })),
    sprintScopePolicy: { mode: 'soft', limit: 1 },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: `Add ${secondStory.key} to Active Sprint` }));
    const dialog = within(canvasElement.ownerDocument.body).getByRole('dialog', { name: 'Add to Active Sprint?' });
    await expect(args.onAddStoryToActive).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await expect(args.onAddStoryToActive).not.toHaveBeenCalled();
  },
};

export const Pending: Story = { args: { pending: true } };

export const MobileMenuOnly: Story = { args: { dragEnabled: false }, parameters: { viewport: { defaultViewport: 'mobile1' } } };

export const LongContent: Story = {
  args: { entities: [{ ...story, title: 'A very long unbroken-reference-identifier-2026-09-04-that-must-wrap' }, { ...epic, title: 'Build a calmer system with an unusually long strategic responsibility name' }] },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
