import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { candidate, story } from '../../test/storybook/fixtures';
import { withHostFrame } from '../../test/storybook/host-frames';
import { DeleteWorkDialog } from './DeleteWorkDialog';
const preview = { note: story, content: 'Research notes', warnings: ['This note contains content, criteria, or tags. Moving it to trash removes the entire note, including your own sections and properties.'], blockers: [] };
const meta = {
  title: 'Features/Work/DeleteWorkDialog', component: DeleteWorkDialog,
  decorators: [withHostFrame('modal')],
  args: { item: story, onPreview: async () => preview, onDelete: fn(async () => undefined), onClose: fn(), onOpenNote: fn() },
} satisfies Meta<typeof DeleteWorkDialog>;
export default meta;
type Story = StoryObj<typeof DeleteWorkDialog>;
export const Loaded: Story = {};
export const CandidateWithContent: Story = { args: { item: candidate, onPreview: async () => ({ ...preview, note: candidate }) } };
export const Loading: Story = { args: { onPreview: () => new Promise(() => undefined) } };
export const HasChildren: Story = { args: { onPreview: async () => ({ ...preview, blockers: ['FF-42 contains 2 Tasks. Move or delete those notes first; children are never deleted automatically.'] }) } };
export const DeleteError: Story = {
  args: { onDelete: async () => { throw new Error('This note changed. Cancel and reopen Delete to review it again.'); } },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(await body.findByRole('checkbox'));
    await userEvent.click(body.getByRole('button', { name: 'Move to trash' }));
    await waitFor(() => expect(body.getByRole('alert')).toBeVisible());
  },
};
