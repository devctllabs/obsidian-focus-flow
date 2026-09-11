import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { closedSprint, epic } from '../../test/storybook/fixtures';
import { withHostFrame } from '../../test/storybook/host-frames';
import { HistoryView } from './HistoryView';
import { reportSprints } from '../../test/storybook/history-fixtures';

const meta = {
  title: 'Features/History/HistoryView',
  component: HistoryView,
  decorators: [withHostFrame('leaf')],
  args: { entities: [closedSprint, epic], onOpenNote: fn(), onPromoteImprovement: fn() },
} satisfies Meta<typeof HistoryView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loaded: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText('Outcomes & reflection'));
    await userEvent.click(canvas.getByText('Delivery evidence'));
    const latest = canvas.getByRole('article');
    await expect(within(latest).getByText('focus')).toBeVisible();
  },
};

export const EmptyHistory: Story = { args: { entities: [] } };

export const ReopenAvailable: Story = {
  args: {
    entities: [{
      ...closedSprint,
      reopenRecovery: { close_operation_id: closedSprint.closeSnapshot.operationId, provisional_story_outcomes: [], notes: [] },
    }, epic],
    lifecycle: {
      previewArchive: fn(),
      organize: fn(),
      previewReopen: fn(async () => ({ path: closedSprint.path, code: closedSprint.code, resuming: false })),
      reopen: fn(async () => undefined),
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const periods = canvas.getByRole('group', { name: 'Report period' });
    const reopen = canvas.getByRole('button', { name: `Reopen ${closedSprint.code}` });
    await expect(periods.compareDocumentPosition(reopen) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  },
};

export const VisualMonthReport: Story = {
  args: { entities: reportSprints },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Month' }));
    await expect(canvas.getByRole('heading', { name: 'Month 2 · Year 1' })).toBeVisible();
    await expect(canvas.getByRole('img', { name: /SPR-005: 11 Task completions/ })).toBeVisible();
    await userEvent.click(canvas.getByText('Explore Sprints'));
    await userEvent.click(canvas.getByRole('button', { name: 'Review SPR-005' }));
    await expect(canvas.getByRole('heading', { name: 'SPR-005' })).toBeVisible();
  },
};

export const FilterNoResults: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Filters' }));
    const filters = within(canvasElement.ownerDocument.body);
    await userEvent.click(filters.getByText('Closed date'));
    await userEvent.type(filters.getByLabelText('Closed from'), '2027-01-01');
    await userEvent.click(filters.getByRole('button', { name: 'Done' }));
    await expect(canvas.getByText('No Closed Sprints match these filters.')).toBeVisible();
  },
};

export const MultipleReviewCycles: Story = {
  args: {
    entities: [
      closedSprint,
      { ...closedSprint, id: '01994744-a401-759a-b582-4418f2f24061', code: 'SPR-002', sequence: 2, startsOn: '2026-08-31', dueOn: '2026-09-06', closedAt: '2026-09-06T18:00:00Z', path: 'Focus Flow/Sprints/SPR-002.md' },
      epic,
    ],
  },
};

export const NoCompletedTaskTags: Story = {
  args: { entities: [{ ...closedSprint, closeSnapshot: { ...closedSprint.closeSnapshot, effectiveTagSummary: [] } }, epic] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText('Outcomes & reflection'));
    await userEvent.click(canvas.getByText('Delivery evidence'));
    await expect(canvas.getByText('No completed Task tags.')).toBeVisible();
  },
};

export const PromoteImprovement: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText('Outcomes & reflection'));
    await userEvent.click(canvas.getByRole('button', { name: 'Promote Automate the review checklist' }));
    await expect(args.onPromoteImprovement).toHaveBeenCalledWith('Automate the review checklist', closedSprint.code);
  },
};

export const LongContent: Story = {
  args: { entities: [{ ...closedSprint, retrospectiveItems: [{ kind: 'friction' as const, text: 'A very long unbroken-reference-identifier-2026-09-04-that-must-wrap' }] }, epic] },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
