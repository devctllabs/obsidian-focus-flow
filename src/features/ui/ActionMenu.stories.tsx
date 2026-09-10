import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { withHostFrame } from '../../test/storybook/host-frames';
import { ActionMenu, MenuAction } from './ActionMenu';

const meta = {
  title: 'Shared/Menus/ActionMenu',
  component: ActionMenu,
  decorators: [withHostFrame('sidebar')],
  args: { label: 'More actions', children: <MenuAction onClick={fn()}>Open note</MenuAction> },
} satisfies Meta<typeof ActionMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {};

export const Open: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'More actions' }));
    await expect(within(canvasElement.ownerDocument.body).getByRole('menu')).toBeInTheDocument();
  },
};

export const DisabledAndDestructiveActions: Story = {
  args: {
    children: <><MenuAction disabled>Unavailable</MenuAction><MenuAction destructive>Delete note</MenuAction></>,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'More actions' }));
    const menu = within(canvasElement.ownerDocument.body).getByRole('menu');
    await expect(within(menu).getByRole('menuitem', { name: 'Unavailable' })).toBeDisabled();
    await userEvent.keyboard('{Escape}');
  },
};
