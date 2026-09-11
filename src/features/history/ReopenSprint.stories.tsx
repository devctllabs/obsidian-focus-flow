import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { ReopenSprint } from './ReopenSprint';
import { withHostFrame } from '../../test/storybook/host-frames';

const meta = {
  title: 'Features/History/Reopen Sprint', component: ReopenSprint, decorators: [withHostFrame('leaf')],
  args: { sprintId: 'sprint', code: 'SPR-014', resuming: false, lifecycle: { previewReopen: fn(async () => ({ path: 'Focus Flow/Sprints/SPR-014.md', code: 'SPR-014', resuming: false })), reopen: fn(async () => undefined) } },
} satisfies Meta<typeof ReopenSprint>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Confirm: Story = { play: async ({ canvasElement }) => { const page = within(canvasElement.ownerDocument.body); await waitFor(() => expect(page.getByRole('button', { name: 'Reopen SPR-014' })).toBeEnabled()); await userEvent.click(page.getByRole('button', { name: 'Reopen SPR-014' })); await waitFor(() => expect(page.getByRole('dialog')).toBeVisible()); } };
export const DraftConflict: Story = { args: { blocked: 'Cancel the Draft before reopening SPR-014.' } };
export const ChangedNote: Story = { args: { lifecycle: { previewReopen: fn(async () => { throw new Error('Work changed after this Sprint closed, so it cannot be reopened safely.'); }), reopen: fn(async () => undefined) } }, play: async ({ canvasElement }) => { const page = within(canvasElement); await expect(await page.findByRole('alert')).toHaveTextContent('Work changed'); await expect(page.getByRole('button', { name: 'Reopen SPR-014' })).toBeDisabled(); } };
