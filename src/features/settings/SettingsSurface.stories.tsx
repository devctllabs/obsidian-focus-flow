import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { createRejectingSettingsController, createSettingsController } from '../../test/storybook/fakes';
import { withHostFrame } from '../../test/storybook/host-frames';
import { SettingsSurface } from './SettingsSurface';
import { useState } from 'react';
import { TagCatalogService } from '../../application/tags/tag-catalog';
import { TagCatalogProvider } from '../ui/TagCatalog';

const meta = {
  title: 'Features/Settings/SettingsSurface',
  component: SettingsSurface,
  decorators: [withHostFrame('settings')],
  args: { controller: createSettingsController() },
} satisfies Meta<typeof SettingsSurface>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Configured: Story = {
  args: { controller: createSettingsController({ setupCompleted: true }) },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('heading', { name: 'Terminal notes' })).toBeVisible();
  },
};

export const CollapsedSections: Story = {
  args: { controller: createSettingsController({ setupCompleted: true }) },
  render: function Render(args) {
    const [catalog] = useState(() => {
      let markdown: string | null = '---\nfocus_flow:\n  schema_version: 1\n  type: tag_catalog\n  tags:\n    focus:\n      description: Deep-work topic\n      color: "#6750A4"\n    learning:\n      color: "#0F766E"\n---\n';
      const service = new TagCatalogService({ read: async () => markdown, update: async (transform) => { markdown = transform(markdown); } });
      void service.refresh();
      return service;
    });
    return <TagCatalogProvider service={catalog}><SettingsSurface controller={{ ...args.controller, tagCatalog: catalog, listTags: () => ['focus', 'learning', 'work', 'home', 'weekly-review', 'personal'] }} /></TagCatalogProvider>;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Tags' })).toHaveAttribute('aria-expanded', 'false');
    await expect(canvas.getByText('2 cataloged · 2 custom colors')).toBeVisible();
    await expect(canvas.getByText('Candidate, Task and Retrospective note bodies')).toBeVisible();
    await expect(canvas.queryByRole('searchbox')).not.toBeInTheDocument();
    const headers = canvasElement.querySelectorAll('.focus-flow__settings-disclosure');
    const [catalogHeader, templatesHeader] = [...headers].map((node) => node.getBoundingClientRect());
    await expect(Math.abs(catalogHeader!.left - templatesHeader!.left)).toBeLessThan(1);
    await expect(Math.abs(catalogHeader!.width - templatesHeader!.width)).toBeLessThan(1);
  },
};

export const TerminalNotesLast: Story = {
  args: { controller: createSettingsController({ setupCompleted: true }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const templates = canvas.getByText('Templates', { exact: true }).closest('details')!;
    const terminalNotes = canvas.getByRole('heading', { name: 'Terminal notes' }).closest('section')!;
    await expect(templates.compareDocumentPosition(terminalNotes) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await expect(terminalNotes.nextElementSibling).toBeNull();
  },
};

export const FirstUseSetup: Story = {
  args: { controller: createSettingsController() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Set up' }));
    // eslint-disable-next-line @typescript-eslint/unbound-method -- inspect the controller method as a Storybook spy
    await expect(args.controller.requestRootSetup).toHaveBeenCalledWith('Focus Flow');
    await expect(canvas.getByText('Focus Flow')).toBeVisible();
  },
};

export const PendingRootMove: Story = {
  args: { controller: { ...createSettingsController({ setupCompleted: true }), hasPendingRootMove: () => true } },
};

export const SaveError: Story = {
  args: { controller: createRejectingSettingsController('Settings could not be saved.') },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Tuesday' }));
    await expect(canvas.getByText('Settings could not be saved.')).toBeVisible();
  },
};

export const RootActionError: Story = {
  args: { controller: createRejectingSettingsController('Root move could not be completed.') },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Change…' }));
    const dialog = within(canvasElement.ownerDocument.body);
    await userEvent.clear(dialog.getByRole('textbox', { name: 'Folder name' }));
    await userEvent.type(dialog.getByRole('textbox', { name: 'Folder name' }), 'My workspace');
    await userEvent.click(dialog.getByRole('button', { name: 'Move folder' }));
    await waitFor(() => expect(within(canvasElement.ownerDocument.body).getByText('Root move could not be completed.')).toBeVisible());
  },
};

export const SavePending: Story = {
  args: {
    controller: { ...createSettingsController(), updateSettings: fn(() => new Promise<void>(() => undefined)) },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Tuesday' }));
    await expect(canvas.getByRole('button', { name: 'Tuesday' })).toBeDisabled();
  },
};

export const AllWipModes: Story = {
  args: {
    controller: createSettingsController({
      setupCompleted: true,
      wip: {
        sprintScope: { mode: 'hard', limit: 3 },
        tomorrow: { mode: 'off', limit: 2 },
        today: { mode: 'soft', limit: 4 },
        inProgress: { mode: 'hard', limit: 1 },
      },
    }),
  },
};

export const LongTemplateContent: Story = {
  play: async ({ canvasElement }) => { await userEvent.click(within(canvasElement).getByText('Templates', { exact: true })); },
  args: {
    controller: createSettingsController({
      setupCompleted: true,
      templates: { candidate: `Focus Flow/Templates/${'Candidate-'.repeat(12)}Template.md`, task: 'Focus Flow/Templates/Task.md', retrospective: 'Focus Flow/Templates/Retrospective.md' },
    }),
  },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
