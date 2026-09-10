import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { withHostFrame } from '../../test/storybook/host-frames';
import { WorkTitleButton } from './WorkTitleButton';

const meta = {
  title: 'Shared/Work/WorkTitleButton',
  component: WorkTitleButton,
  decorators: [withHostFrame('sidebar')],
  args: { item: { key: 'FF-42', title: 'Improve weekly focus', path: 'Focus Flow/Stories/FF-42 Improve weekly focus.md' }, onOpenNote: fn() },
} satisfies Meta<typeof WorkTitleButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: /Open FF-42/ });
    const key = button.querySelector('.focus-flow__key');
    const title = button.querySelector('.focus-flow__title-text');
    if (key === null) throw new Error('Work title key was not rendered.');
    if (title === null) throw new Error('Work title text was not separated from its key.');
    await expect(getComputedStyle(button).alignItems).toBe('baseline');
    await expect(getComputedStyle(button).justifyContent).toBe('flex-start');
    await expect(Number.parseFloat(getComputedStyle(button).gap)).toBeGreaterThan(0);
    await expect(getComputedStyle(key).fontFamily).toBe(getComputedStyle(button).fontFamily);
    await expect(Number.parseFloat(getComputedStyle(key).fontSize)).toBeLessThan(Number.parseFloat(getComputedStyle(button).fontSize));
    await userEvent.hover(button);
    await expect(getComputedStyle(button).backgroundColor).toBe('rgba(0, 0, 0, 0)');
    await userEvent.click(button);
    await expect(args.onOpenNote).toHaveBeenCalled();
  },
};

export const LongUnbrokenText: Story = {
  args: { item: { key: 'FF-999', title: 'A very long unbroken-reference-identifier-2026-09-04-that-must-wrap', path: 'Focus Flow/Stories/FF-999.md' } },
};

export const CompactTags: Story = {
  args: { item: { key: 'FF-42', title: 'Improve weekly focus with a clear next step', path: 'Story.md', tags: ['focus', 'weekly-review'] } },
  play: async ({ canvasElement }) => {
    const chip = within(canvasElement).getByText('#focus');
    await expect(chip.clientWidth).toBeGreaterThanOrEqual(chip.scrollWidth);
  },
};
