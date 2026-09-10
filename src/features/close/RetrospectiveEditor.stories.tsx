import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { withHostFrame } from '../../test/storybook/host-frames';
import { RetrospectiveEditor } from './RetrospectiveEditor';
const meta = {
  title: 'Features/Close/RetrospectiveEditor', component: RetrospectiveEditor, decorators: [withHostFrame('leaf')],
  args: { value: { wins: ['Protected two mornings for focused work.', 'The weekly review took less effort.'], friction: ['Too many small interruptions.'], improvements: ['Try one inbox review each afternoon.'] }, onChange: fn() },
  render: function Controlled(args) { const [value, setValue] = useState(args.value); return <RetrospectiveEditor value={value} onChange={setValue} />; },
} satisfies Meta<typeof RetrospectiveEditor>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Loaded: Story = {};
export const Empty: Story = { args: { value: { wins: [], friction: [], improvements: [] } } };
