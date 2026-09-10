import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { withHostFrame } from '../../test/storybook/host-frames';
import { BoardDragAdapter } from './BoardDragAdapter';

const items = [
  { id: 'one', label: 'First item' },
  { id: 'two', label: 'Second item' },
];

const meta = {
  title: 'Shared/Planning/BoardDragAdapter',
  component: BoardDragAdapter,
  decorators: [withHostFrame('sidebar')],
  args: { items, enabled: true, group: 'stories', listClassName: 'focus-flow__planning-list', onMove: fn(), renderItem: (item) => <span>{item.label}</span> },
} satisfies Meta<typeof BoardDragAdapter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Sortable: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Drag First item' })).toBeVisible();
  },
};

export const StaticMobileList: Story = { args: { enabled: false } };

export const Disabled: Story = { args: { disabled: true } };

export const EmptyDropTarget: Story = { args: { items: [] } };

export const KeyboardReorder: Story = {
  play: async ({ canvasElement, args }) => {
    const handle = within(canvasElement).getByRole('button', { name: 'Drag Second item' });
    handle.focus();
    await userEvent.keyboard('[Space][ArrowUp][Space]');
    await expect(args.onMove).toHaveBeenCalledWith('two', 0);
  },
};

