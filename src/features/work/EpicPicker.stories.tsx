import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';
import { epic, secondEpic } from '../../test/storybook/fixtures';
import { withHostFrame } from '../../test/storybook/host-frames';
import { EpicPicker } from './EpicPicker';
const meta = {
  title: 'Features/Work/EpicPicker', component: EpicPicker, decorators: [withHostFrame('sidebar')],
  args: { epics: [epic, secondEpic], value: '', onChange: fn() },
  render: function Controlled(args) { const [value, setValue] = useState(args.value); return <EpicPicker {...args} value={value} onChange={setValue} />; },
} satisfies Meta<typeof EpicPicker>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Loaded: Story = {};
export const SearchNoResults: Story = { play: async ({ canvasElement }) => { const canvas = within(canvasElement); await userEvent.type(canvas.getByRole('combobox'), 'Unknown'); await expect(canvas.getByRole('status')).toBeVisible(); } };
export const KeyboardSelection: Story = { play: async ({ canvasElement }) => { const canvas = within(canvasElement); await userEvent.type(canvas.getByRole('combobox'), 'repeatable{Enter}'); await expect(canvas.getByRole('combobox')).toHaveValue(`${secondEpic.key} ${secondEpic.title}`); } };
