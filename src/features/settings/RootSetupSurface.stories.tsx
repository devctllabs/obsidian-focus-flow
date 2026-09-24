import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { DEFAULT_SETTINGS } from '../../settings';
import { RootSetupSurface, type RootSetupController } from './RootSetupSurface';

const controller: RootSetupController = {
  settings: DEFAULT_SETTINGS,
  folders: ['Personal', 'Personal/Focus'],
  files: ['Personal/Focus/Templates/Candidate.md', 'Personal/Focus/Templates/Task.md', 'Personal/Focus/Templates/Retrospective.md', 'Templates/My capture.md'],
  preview: async (_intent, root) => ({ root, missingFolders: root === 'Personal/Focus' ? [] : [root, `${root}/Inbox`], missingTemplates: root === 'Personal/Focus' ? [] : [`${root}/Templates/Candidate.md`, `${root}/Templates/Task.md`, `${root}/Templates/Retrospective.md`], warnings: [], errors: [] }),
  confirm: async () => undefined,
};
const meta = {
  title: 'Features/Settings/RootSetupSurface',
  component: RootSetupSurface,
  decorators: [(Story) => <div className="focus-flow-story-modal-stage"><section className="focus-flow focus-flow-story-native-modal" aria-label="Set up Focus Flow modal preview"><h2 className="focus-flow-story-modal-title">Set up Focus Flow</h2><Story /></section></div>],
  args: { controller, intent: 'create', onDone: fn(), onBack: fn() },
} satisfies Meta<typeof RootSetupSurface>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Loaded: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const modal = canvas.getByRole('region', { name: 'Set up Focus Flow modal preview' }).getBoundingClientRect();
    const heading = canvas.getByRole('heading', { name: 'Set up Focus Flow' }).getBoundingClientRect();
    const input = canvas.getByLabelText('Folder name').getBoundingClientRect();
    await expect(modal.width).toBeLessThanOrEqual(560);
    await expect(modal.height).toBeLessThan(700);
    await expect(Math.abs(heading.left - input.left)).toBeLessThan(2);
  },
};
export const NameConflict: Story = {
  args: { controller: { ...controller, folders: ['FocusFlow', ...controller.folders] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('status')).toHaveTextContent('That folder name is already in use here. Choose a different name.');
    await expect(canvas.getByRole('button', { name: 'Review setup' })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: 'Back' }).querySelector('svg')).not.toBeNull();
  },
};
export const ExistingWorkspace: Story = {
  args: { intent: 'open' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Open folder Personal' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Open folder Personal/Focus' }));
    await userEvent.click(canvas.getByText('Templates', { exact: true }));
    await userEvent.click(canvas.getByRole('button', { name: 'Review setup' }));
    await expect(canvas.getByRole('button', { name: 'Use this workspace' })).toBeEnabled();
  },
};
export const ValidationErrors: Story = {
  args: { controller: { ...controller, preview: async (_intent, root) => ({ root, missingFolders: [], missingTemplates: [], warnings: [], errors: ['Focus Flow/Tasks is a file. Rename it or choose another workspace folder.'] }) } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Review setup' }));
    await expect(canvas.getByRole('alert')).toBeVisible();
  },
};
export const SaveError: Story = {
  args: { controller: { ...controller, confirm: async () => { throw new Error('Could not save workspace settings. Check vault access, then try again.'); } } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Review setup' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Create workspace' }));
    await expect(canvas.getByRole('alert')).toBeVisible();
  },
};
export const SavePending: Story = {
  args: { controller: { ...controller, confirm: () => new Promise(() => undefined) } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Review setup' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Create workspace' }));
    await expect(canvas.getByRole('button', { name: 'Working…' })).toBeDisabled();
  },
};
