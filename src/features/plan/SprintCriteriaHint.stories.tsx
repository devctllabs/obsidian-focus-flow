import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { withHostFrame } from '../../test/storybook/host-frames';
import { SprintCriteriaHint } from './SprintCriteriaHint';

const meta = {
  title: 'Features/Plan/SprintCriteriaHint', component: SprintCriteriaHint,
  decorators: [withHostFrame('sidebar')],
  args: { storyKey: 'FF-42', disabled: false, onEdit: fn() },
} satisfies Meta<typeof SprintCriteriaHint>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Loaded: Story = {};
export const HelpOpen: Story = {
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const trigger = page.getByRole('button', { name: 'Why FF-42 cannot enter a Sprint' });
    trigger.focus();
    await userEvent.keyboard('{Enter}');
    await expect(page.getByRole('dialog', { name: 'Sprint requirement' })).toHaveFocus();
    await userEvent.tab();
    await expect(page.getByRole('button', { name: 'Add criteria to FF-42' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    await expect(trigger).toHaveFocus();
    await userEvent.click(trigger);
    await expect(page.getByRole('dialog', { name: 'Sprint requirement' })).toBeVisible();
  },
};
export const ReadOnly: Story = { ...HelpOpen, args: { onEdit: undefined }, play: async ({ canvasElement }) => {
  await userEvent.click(within(canvasElement).getByRole('button', { name: 'Why FF-42 cannot enter a Sprint' }));
} };
