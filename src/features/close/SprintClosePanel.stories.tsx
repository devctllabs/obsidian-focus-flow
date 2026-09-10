import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { SprintClosePlan } from '../../domain/sprint-close';
import { activeSprint, activeStory, doneTask, epic, task } from '../../test/storybook/fixtures';
import { withHostFrame } from '../../test/storybook/host-frames';
import { SprintClosePanel } from './SprintClosePanel';
import { expectChildrenInside } from '../../test/storybook/layout-assertions';

const baseEntities = [activeSprint, activeStory, doneTask, epic];

const meta = {
  title: 'Features/Close/SprintClosePanel',
  component: SprintClosePanel,
  decorators: [withHostFrame('leaf')],
  args: { entities: baseEntities, onEvaluateStory: fn(), onCloseSprint: fn(), onResumeClose: fn(), onBack: fn() },
} satisfies Meta<typeof SprintClosePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('heading', { name: 'A moment to look back.' })).toBeVisible();
    for (const button of canvasElement.querySelectorAll<HTMLElement>('.focus-flow__review-checklist button')) await expectChildrenInside(button);
  },
};

export const OptionalReflection: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Outcomes' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Closed' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Save evaluation for FF-42' }));
    await expect(args.onEvaluateStory).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'closed', evidence: '' }));
  },
};

export const MultipleStories: Story = {
  args: { entities: [...baseEntities, { ...activeStory, id: 'review-story-2', key: 'FF-52', title: 'Make space for deeper work', sprintRank: 'a2' }, task] },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Outcomes' }));
    for (const button of canvasElement.querySelectorAll<HTMLElement>('.focus-flow__outcome-stories button')) await expectChildrenInside(button);
  },
};

export const NarrowReadableSteps: Story = {
  decorators: [(Story) => <div style={{ width: 250 }}><Story /></div>],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const nav = canvas.getByRole('navigation', { name: 'Sprint Close progress' });
    for (const label of ['Overview', 'Outcomes', 'Tasks', 'Retrospective', 'Review']) {
      await userEvent.click(within(nav).getByRole('button', { name: label }));
      await expect(nav.scrollWidth).toBeLessThanOrEqual(nav.clientWidth);
      const bounds = nav.getBoundingClientRect();
      for (const button of within(nav).getAllByRole('button')) {
        await expect(button.getBoundingClientRect().left).toBeGreaterThanOrEqual(bounds.left);
        await expect(button.getBoundingClientRect().right).toBeLessThanOrEqual(bounds.right);
      }
    }
  },
};

export const OutcomesWithAcceptanceException: Story = {
  args: { entities: [activeSprint, { ...activeStory, acceptanceCriteria: [{ text: 'Portrait works', checked: true }, { text: 'Landscape works', checked: false }] }, doneTask, epic] },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /Outcomes$/ }));
    await expect(canvas.getByText('Ready to evaluate')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Achieved' }));
    await userEvent.type(canvas.getByLabelText('Reflection for FF-42'), 'Verified in both supported layouts.');
    await userEvent.type(canvas.getByLabelText('Acceptance Criteria exception for FF-42'), 'Landscape is deferred.');
    await userEvent.click(canvas.getByRole('button', { name: 'Save evaluation for FF-42' }));
    await expect(args.onEvaluateStory).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'achieved', acceptanceExceptionReason: 'Landscape is deferred.' }));
  },
};

export const TasksEmpty: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /Tasks$/ }));
    await expect(canvas.getByRole('heading', { name: 'No unfinished Tasks' })).toBeVisible();
  },
};

export const TaskResolutionContinue: Story = {
  args: { entities: [activeSprint, activeStory, task, epic] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /Tasks$/ }));
    await userEvent.selectOptions(canvas.getByLabelText('Resolution for FF-43'), 'continue');
    await expect(canvas.getByLabelText('Continuation context for FF-43')).toBeVisible();
  },
};

export const TaskResolutionMove: Story = {
  args: { entities: [activeSprint, activeStory, { ...task, id: '01994706-857c-76f1-8006-85cd9bd80891', key: 'FF-44', title: 'Move this task' }, { ...activeStory, id: '019946f1-8d2a-7f05-87b1-1eebbb476301', key: 'FF-45', title: 'Target story', sprintRank: 'a1' }, epic] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /Tasks$/ }));
    await userEvent.selectOptions(canvas.getByLabelText('Resolution for FF-44'), 'move');
    await expect(canvas.getByLabelText('Target Story for FF-44')).toBeVisible();
  },
};

export const TaskResolutionReclassify: Story = {
  args: { entities: [activeSprint, activeStory, task, epic] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /Tasks$/ }));
    await userEvent.selectOptions(canvas.getByLabelText('Resolution for FF-43'), 'reclassify');
    await expect(canvas.getByLabelText('Parent Epic for FF-43')).toBeVisible();
  },
};

export const TaskResolutionIrrelevant: Story = {
  args: { entities: [activeSprint, activeStory, task, epic] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /Tasks$/ }));
    await userEvent.selectOptions(canvas.getByLabelText('Resolution for FF-43'), 'irrelevant');
    await expect(canvas.getByLabelText('Resolution for FF-43')).toHaveValue('irrelevant');
  },
};

export const RetrospectivePopulated: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /Retrospective$/ }));
    await userEvent.click(canvas.getByRole('button', { name: 'Add item to Wins' }));
    const wins = canvas.getByRole('textbox', { name: 'Wins' });
    await expect(wins.getBoundingClientRect().width).toBeGreaterThan(wins.parentElement!.getBoundingClientRect().width * .9);
    await userEvent.type(canvas.getByLabelText('Wins'), 'The review stayed focused.');
    await expect(canvas.getByLabelText('Wins')).toHaveValue('The review stayed focused.');
    await userEvent.click(canvas.getByRole('button', { name: 'Save Wins item' }));
    await expect(canvas.getByRole('button', { name: 'Edit Wins item 1' })).toBeVisible();
  },
};

export const ReviewReady: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /Review$/ }));
    await expect(canvas.getByRole('heading', { name: 'Review the close' })).toBeVisible();
  },
};

export const EarlyClose: Story = {
  args: { today: '2026-09-04', entities: [{ ...activeSprint, dueOn: '2026-09-06', provisionalStoryOutcomes: [{ storyId: activeStory.id, evaluatedAt: '2026-09-04T12:00:00Z', outcome: 'achieved', evidence: '', acceptanceExceptionReason: 'Reviewed' }] }, activeStory, doneTask, epic] },
  play: async ({ canvasElement, args }) => {
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(page.getByRole('button', { name: 'Review' }));
    await userEvent.click(page.getByRole('button', { name: 'Close Sprint' }));
    await expect(page.getByRole('dialog')).toHaveTextContent('another Sprint cannot start');
    await expect(args.onCloseSprint).not.toHaveBeenCalled();
  },
};

export const GuidedFlow: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const step of ['Outcomes', 'Tasks', 'Retrospective', 'Review']) {
      await userEvent.click(canvas.getByRole('button', { name: new RegExp(`${step}$`) }));
    }
    await expect(canvas.getByRole('heading', { name: 'Review the close' })).toBeVisible();
  },
};

export const Pending: Story = { args: { pending: true } };

const pendingClose = {
  operationId: '01994a8a-0371-7a2d-a3e9-247990391600',
  stories: [],
  tasks: [],
} as unknown as SprintClosePlan;

export const PendingCloseRecovery: Story = {
  args: { entities: [{ ...activeSprint, pendingClose }, activeStory, epic] },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { name: 'Sprint close needs recovery' })).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Inspect changes' }));
    await expect(canvas.getByText('01994a8a-0371-7a2d-a3e9-247990391600')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Resume close' }));
    await expect(args.onResumeClose).toHaveBeenCalled();
  },
};
