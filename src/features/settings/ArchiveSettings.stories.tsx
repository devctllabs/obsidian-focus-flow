import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { ArchiveSettings } from './ArchiveSettings';
import { withHostFrame } from '../../test/storybook/host-frames';

const entry = { id: 'story', before: { path: 'Focus Flow/Stories/FF-42 Weekly review.md', managed: { id: 'story' } }, after: { path: 'Focus Flow/Stories/Archive/2026/09/FF-42 Weekly review.md', managed: { id: 'story' } } };
const meta = {
  title: 'Features/Settings/Terminal archive', component: ArchiveSettings, decorators: [withHostFrame('settings')],
  args: { lifecycle: { previewArchive: fn(async () => ({ entries: [entry], diagnostics: [], resuming: false })), organize: fn(async () => undefined) } },
} satisfies Meta<typeof ArchiveSettings>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Preview: Story = { play: async ({ canvasElement }) => { const page = within(canvasElement.ownerDocument.body); await userEvent.click(page.getByRole('button', { name: 'Review terminal notes' })); await waitFor(() => expect(page.getByRole('dialog')).toBeVisible()); } };
export const Empty: Story = { ...Preview, args: { lifecycle: { previewArchive: fn(async () => ({ entries: [], diagnostics: [], resuming: false })), organize: fn(async () => undefined) } } };
export const Collision: Story = { ...Preview, args: { lifecycle: { previewArchive: fn(async () => ({ entries: [entry], diagnostics: ['Destination already exists. Rename the conflicting note and inspect again.'], resuming: false })), organize: fn(async () => undefined) } } };
export const Interrupted: Story = { ...Preview, args: { lifecycle: { previewArchive: fn(async () => ({ entries: [entry], diagnostics: [], resuming: true })), organize: fn(async () => undefined) } } };
