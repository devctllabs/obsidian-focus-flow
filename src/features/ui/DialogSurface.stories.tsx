import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { withHostFrame } from '../../test/storybook/host-frames';
import { DialogSurface } from './DialogSurface';

const meta = {
  title: 'Shared/Dialogs/DialogSurface',
  component: DialogSurface,
  decorators: [withHostFrame('modal')],
  args: { title: 'Confirm action', description: 'This change can be reversed.', onClose: fn(), children: <p>Dialog content.</p> },
} satisfies Meta<typeof DialogSurface>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
  play: async ({ canvasElement }) => {
    const dialog = within(canvasElement.ownerDocument.body).getByRole('dialog', { name: 'Confirm action' });
    await expect(dialog).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
  },
};

export const WithoutDescription: Story = { args: { description: undefined } };

export const SearchHeader: Story = {
  args: { title: 'Stories', description: undefined, children: <input aria-label="Find a Story" type="search" placeholder="Find a Story…" /> },
  play: async ({ canvasElement }) => {
    const dialog = within(canvasElement.ownerDocument.body).getByRole('dialog', { name: 'Stories' });
    await waitFor(async () => {
      const close = within(dialog).getByRole('button', { name: 'Close dialog' }).getBoundingClientRect();
      const search = within(dialog).getByRole('searchbox').getBoundingClientRect();
      await expect(search.top - close.bottom).toBeGreaterThanOrEqual(12);
    });
  },
};

export const LongContent: Story = {
  args: { children: <p>{'A detailed explanation '.repeat(80)}</p> },
};
