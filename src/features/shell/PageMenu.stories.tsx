import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { withHostFrame } from '../../test/storybook/host-frames';
import { PageMenu } from './PageMenu';

const meta = {
  title: 'Features/Shell/PageMenu',
  component: PageMenu,
  decorators: [withHostFrame('leaf')],
  args: { mode: 'focus' as const, inboxCount: 3, onModeChange: fn(), onCapture: fn() },
} satisfies Meta<typeof PageMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {};

export const OpenSettings: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Settings' }));
    await expect(args.onModeChange).toHaveBeenCalledWith('settings');
  },
};
export const Capture: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Capture Candidate' }));
    await expect(args.onCapture).toHaveBeenCalled();
  },
};
