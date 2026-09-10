import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { activeStory, epic, task } from '../../test/storybook/fixtures';
import { withHostFrame } from '../../test/storybook/host-frames';
import { OutcomeEditor } from './OutcomeEditor';

const meta = {
  title: 'Features/Work/OutcomeEditor',
  component: OutcomeEditor,
  decorators: [withHostFrame('leaf')],
  args: { item: activeStory, suggestions: ['focus', 'weekly', 'writing'], onSave: fn(async () => undefined), onClose: fn() },
} satisfies Meta<typeof OutcomeEditor>;
export default meta;
type Story = StoryObj<typeof meta>;

export const ActiveStory: Story = {
  play: async ({ canvasElement, args }) => {
    const dialog = within(canvasElement.ownerDocument.body).getByRole('dialog', { name: 'Edit FF-42' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add criterion' }));
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Criterion 2' }), 'Progress is visible at a glance');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    await expect(args.onSave).toHaveBeenCalledWith(expect.objectContaining({ type: 'story', acceptanceCriteria: [...activeStory.acceptanceCriteria, { text: 'Progress is visible at a glance', checked: false }] }));
  },
};
export const Epic: Story = { args: { item: epic } };
export const Task: Story = {
  args: { item: { ...task, tags: ['writing'], effectiveTags: ['writing', 'focus'], bodyFields: { Description: 'Prepare the **smallest useful** version.', 'Acceptance Criteria': '- [ ] Clear next action\n  - Works on mobile' } } },
  play: async ({ canvasElement, args }) => {
    const page = within(canvasElement.ownerDocument.body);
    await expect(page.getByLabelText('Description')).toHaveValue('Prepare the **smallest useful** version.');
    await expect(page.getByLabelText('Criterion 1')).toHaveValue('Clear next action\n- Works on mobile');
    await userEvent.clear(page.getByLabelText('Title'));
    await userEvent.type(page.getByLabelText('Title'), 'Prepare the useful version');
    await userEvent.click(page.getByRole('button', { name: 'Save changes' }));
    await expect(args.onSave).toHaveBeenCalledWith(expect.objectContaining({ type: 'task', title: 'Prepare the useful version', acceptanceCriteria: [{ text: 'Clear next action\n- Works on mobile', checked: false }], bodyFields: { Description: 'Prepare the **smallest useful** version.' } }));
  },
};
export const SaveError: Story = {
  args: { onSave: fn(async () => { throw new Error('This item changed. Reopen the editor to load its latest fields.'); }) },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(page.getByRole('button', { name: 'Save changes' }));
    await expect(page.getByRole('alert')).toHaveTextContent('This item changed');
    await expect(page.getByRole('textbox', { name: 'Title' })).toHaveValue(activeStory.title);
  },
};
