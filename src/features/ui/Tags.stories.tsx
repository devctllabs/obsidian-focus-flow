import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { withHostFrame } from '../../test/storybook/host-frames';
import { TagChip } from './Tags';

const meta = {
  title: 'Shared/Tags/TagChip',
  component: TagChip,
  decorators: [withHostFrame('sidebar')],
  args: { tag: 'focus', onClick: fn() },
} satisfies Meta<typeof TagChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Selectable: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: '#focus' }));
    await expect(args.onClick).toHaveBeenCalled();
  },
};

export const Selected: Story = { args: { selected: true } };

export const Static: Story = { args: { onClick: undefined } };

export const LongTag: Story = { args: { tag: 'very-long-unbroken-project-identifier-2026-09-04' } };

