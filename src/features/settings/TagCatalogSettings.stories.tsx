import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { TagCatalogService } from '../../application/tags/tag-catalog';
import { TagCatalogProvider } from '../ui/TagCatalog';
import { TagCatalogSettings } from './TagCatalogSettings';
import { withHostFrame } from '../../test/storybook/host-frames';

function CatalogStory({ broken = false, empty = false, many = false, loaded = false, currentUses = 0 }: { broken?: boolean; empty?: boolean; many?: boolean; loaded?: boolean; currentUses?: number }) {
  const [service] = useState(() => {
    let markdown: string | null = broken
      ? '---\nfocus_flow:\n  schema_version: 1\n  type: tag_catalog\n  tags:\n    focus:\n      color: red\n    learning:\n      description: Keep growing\n---\n'
      : loaded
        ? '---\nfocus_flow:\n  schema_version: 1\n  type: tag_catalog\n  tags:\n    area/focus:\n      description: Work that needs uninterrupted attention.\n      color: "#6750A4"\n---\n'
        : null;
    const catalog = new TagCatalogService({ read: async () => markdown, update: async (transform) => { markdown = transform(markdown); } });
    void catalog.refresh();
    return catalog;
  });
  const observed = empty ? [] : many ? Array.from({ length: 128 }, (_, index) => `project/area-${String(index + 1).padStart(3, '0')}`) : ['area/focus', 'context/home', 'context/work', 'learning', 'project/a-long-tag-that-should-wrap-naturally'];
  return <TagCatalogProvider service={service}><TagCatalogSettings service={service} tags={observed} currentTagUsage={currentUses > 0 ? { 'area/focus': currentUses } : {}} /></TagCatalogProvider>;
}

const meta = { title: 'Features/Settings/Tags', component: CatalogStory, decorators: [withHostFrame('settings')] } satisfies Meta<typeof CatalogStory>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Collapsed: Story = { args: { many: true } };
export const DescriptionAndColor: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Tags' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Edit #area/focus' }));
    await userEvent.type(canvas.getByRole('textbox', { name: 'Description' }), 'Deep-work topic');
    await userEvent.click(canvas.getByRole('button', { name: 'Save description' }));
    await expect(canvas.getByRole('status')).toHaveTextContent('Description saved for #area/focus');
    const chip = canvas.getByText('#area/focus');
    const neutralBackground = getComputedStyle(chip).backgroundColor;
    await userEvent.click(canvas.getByRole('button', { name: 'Violet' }));
    await expect(canvas.getByRole('status')).toHaveTextContent('Color saved for #area/focus');
    await waitFor(() => expect(getComputedStyle(chip).backgroundColor).not.toBe(neutralBackground));
    await expect(canvas.getByRole('textbox', { name: 'Description' })).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Neutral' }));
    await expect(chip).not.toHaveClass('focus-flow__tag--colored');
    await waitFor(() => expect(getComputedStyle(chip).backgroundColor).toBe(neutralBackground));
    const neutralRect = chip.getBoundingClientRect();
    await userEvent.type(canvas.getByRole('textbox', { name: 'Custom HEX' }), '#123456');
    await userEvent.click(canvas.getByRole('button', { name: 'Save color' }));
    await waitFor(() => expect(chip).toHaveClass('focus-flow__tag--colored'));
    const customRect = chip.getBoundingClientRect();
    await expect(customRect.width).toBeCloseTo(neutralRect.width, 3);
    await expect(customRect.height).toBeCloseTo(neutralRect.height, 3);
  },
};
export const DescriptionTooltip: Story = {
  args: { loaded: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Tags' }));
    const row = canvas.getByRole('button', { name: 'Work that needs uninterrupted attention.' });
    await expect(row).toHaveAttribute('data-tooltip-position', 'top');
    await expect(row).toHaveAccessibleDescription('Edit #area/focus');
  },
};
export const RemoveConfirm: Story = {
  args: { loaded: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'Tags' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Work that needs uninterrupted attention.' }));
    await userEvent.click(canvas.getByRole('button', { name: 'More actions for #area/focus' }));
    await userEvent.click(page.getByRole('menuitem', { name: 'Remove from catalog…' }));
    await waitFor(() => expect(page.getByRole('dialog', { name: 'Remove #area/focus from catalog?' })).toBeVisible());
  },
};
export const RemoveBlocked: Story = {
  args: { loaded: true, currentUses: 2 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'Tags' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Work that needs uninterrupted attention.' }));
    await userEvent.click(canvas.getByRole('button', { name: 'More actions for #area/focus' }));
    await userEvent.click(page.getByRole('menuitem', { name: 'Remove from catalog…' }));
    await waitFor(() => expect(page.getByRole('dialog', { name: 'Remove #area/focus from current work first' })).toBeVisible());
  },
};
export const Empty: Story = { args: { empty: true }, play: async ({ canvasElement }) => { await userEvent.click(within(canvasElement).getByRole('button', { name: 'Tags' })); } };
export const InvalidEntry: Story = { args: { broken: true } };
export const Narrow: Story = { ...DescriptionAndColor, decorators: [(Story) => <div style={{ maxWidth: 300 }}><Story /></div>] };
export const ManyTags: Story = {
  args: { many: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Tags' }));
    await expect(canvas.getAllByRole('button', { name: /^Edit #/ })).toHaveLength(6);
    await userEvent.click(canvas.getByRole('button', { name: 'Next tags' }));
    await expect(canvas.getByText('7–12 of 128 tags')).toBeVisible();
  },
};
export const AddFromSearch: Story = {
  args: { many: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Tags' }));
    await userEvent.type(canvas.getByRole('searchbox'), 'new/topic');
    await userEvent.click(canvas.getByRole('button', { name: 'Add #new/topic to catalog' }));
    await expect(canvas.getByRole('status')).toHaveTextContent('Added #new/topic to the catalog');
  },
};
