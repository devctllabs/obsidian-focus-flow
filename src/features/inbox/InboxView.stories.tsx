import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within, waitFor } from 'storybook/test';
import { useState } from 'react';
import { generateNKeysBetween } from 'fractional-indexing';
import type { ComponentProps } from 'react';
import type { ProjectedManagedEntity } from '../../application/indexing/work-index';
import { distractions, inboxCandidates } from '../../domain/inbox-order';
import { candidate, distraction, epic } from '../../test/storybook/fixtures';
import { withHostFrame } from '../../test/storybook/host-frames';
import { InboxView } from './InboxView';

const meta = {
  title: 'Features/Inbox/InboxView',
  component: InboxView,
  decorators: [withHostFrame('leaf')],
  beforeEach: async () => {
    // Viewport changes can deliver resize after setup, closing menus or cancelling keyboard drag.
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
    });
  },
  args: {
    entities: [candidate, epic],
    onAcceptAsEpic: fn(),
    onAcceptAsStory: fn(),
    onReject: fn(),
    onReconsider: fn(),
    onCreateMission: fn(),
    onReorder: fn(),
    onEditCandidate: fn(async () => undefined),
    dragEnabled: true,
  },
} satisfies Meta<typeof InboxView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loaded: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'More actions for FF-48' }));
    const menu = body.getByRole('menu');
    await expect(within(menu).getAllByRole('menuitem')[0]).toHaveAccessibleName('Edit…');
    const itemHeights = within(menu).getAllByRole('menuitem').map((item) => item.getBoundingClientRect().height);
    await expect(Math.max(...itemHeights)).toBeLessThan(100);
  },
};

export const HostStyleParity: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const styles = (element: Element) => getComputedStyle(element);
    const segments = canvas.getByRole('button', { name: /Candidates/ });
    const search = canvas.getByRole('searchbox', { name: 'Search Candidates' });
    const root = canvasElement.querySelector<HTMLElement>('.focus-flow');
    if (root === null) throw new Error('Focus Flow root was not found.');
    const textColor = styles(root).color;

    // Flex items report their inline-flex display as flex in computed styles.
    await expect(styles(segments).display).toBe('flex');
    await expect(styles(segments).alignItems).toBe('center');
    const trigger = canvas.getByRole('button', { name: 'Filter by tags (0 active)' });
    await expect(trigger.getBoundingClientRect().width).toBeGreaterThanOrEqual(42);
    await userEvent.click(trigger);
    const picker = within(canvasElement.ownerDocument.body).getByRole('dialog', { name: 'Filter by tags' });
    const tag = within(picker).getByRole('checkbox', { name: '#idea, 1 Candidate' });
    const tagOption = tag.closest('label');
    if (tagOption === null) throw new Error('Tag option was not found.');
    await expect(styles(tagOption).display).toBe('grid');
    await expect(styles(tagOption).alignItems).toBe('center');
    await expect(styles(tagOption).color).toBe(textColor);

    await userEvent.click(within(picker).getByRole('button', { name: 'Done' }));
    const searchIdle = { borderColor: styles(search).borderColor, boxShadow: styles(search).boxShadow };
    search.focus();
    const searchFocus = styles(search);
    await expect(searchFocus.borderColor).not.toBe(searchIdle.borderColor);
    await expect(searchFocus.boxShadow).not.toBe(searchIdle.boxShadow);
    search.blur();

    await expect(canvas.queryByRole('button', { name: 'New Candidate' })).not.toBeInTheDocument();
  },
};

export const EmptyCandidates: Story = { args: { entities: [] } };

export const SearchNoResults: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole('searchbox', { name: 'Search Candidates' }), 'nothing matches');
    await expect(canvas.getByRole('heading', { name: 'Nothing matches' })).toBeVisible();
  },
};

export const TagFiltered: Story = {
  args: { entities: [candidate, { ...candidate, id: '01994770-0000-7000-8000-000000000002', key: 'FF-49', title: 'A different idea', tags: ['later'], effectiveTags: ['later'] }, epic] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Filter by tags (0 active)' }));
    const picker = within(canvasElement.ownerDocument.body).getByRole('dialog', { name: 'Filter by tags' });
    await userEvent.click(within(picker).getByRole('checkbox', { name: '#idea, 1 Candidate' }));
    await expect(canvas.getByText('1 Candidate', { selector: 'p' })).toBeVisible();
  },
};

const manyTagCandidates = Array.from({ length: 36 }, (_, index) => ({
  ...candidate,
  id: `01994770-0000-7000-8000-${String(index + 10).padStart(12, '0')}`,
  key: `FF-${index + 50}`,
  title: `Candidate with topic ${index + 1}`,
  tags: [`topic-${String(index + 1).padStart(2, '0')}`, ...(index % 3 === 0 ? ['shared'] : [])],
  path: `Focus Flow/Inbox/FF-${index + 50} Candidate with topic ${index + 1}.md`,
}));

export const ManyTags: Story = {
  args: { entities: [...manyTagCandidates, epic] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Filter by tags (0 active)' }));
    const picker = within(canvasElement.ownerDocument.body).getByRole('dialog', { name: 'Filter by tags' });
    await userEvent.type(within(picker).getByRole('searchbox', { name: 'Find a tag' }), 'topic-36');
    await expect(within(picker).getByRole('checkbox', { name: '#topic-36, 1 Candidate' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Filter by tags (0 active)' })).toBeVisible();
  },
};

export const MobileTagPicker: Story = {
  args: { entities: [...manyTagCandidates.slice(0, 12), epic], dragEnabled: false },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};

export const MissionReminder: Story = {
  args: { missionMissing: true },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Create and open' }));
    await expect(args.onCreateMission).toHaveBeenCalled();
    await userEvent.click(canvas.getByRole('button', { name: 'Not now' }));
    await expect(canvas.queryByRole('note')).not.toBeInTheDocument();
  },
};

export const NoParentEpic: Story = {
  args: { entities: [candidate] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'More actions for FF-48' }));
    await expect(body.queryByRole('menuitem', { name: 'Accept as Story' })).not.toBeInTheDocument();
  },
};

export const AcceptAsEpic: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'More actions for FF-48' }));
    await userEvent.click(body.getByRole('menuitem', { name: 'Accept as Epic' }));
    await userEvent.click(body.getByRole('button', { name: 'Create Epic' }));
    await expect(args.onAcceptAsEpic).toHaveBeenCalledWith(candidate.id, expect.objectContaining({ title: candidate.title }));
  },
};

export const AcceptAsStoryDialog: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'More actions for FF-48' }));
    await userEvent.click(body.getByRole('menuitem', { name: 'Accept as Story' }));
    const dialog = body.getByRole('dialog', { name: 'Create Story from FF-48' });
    await expect(within(dialog).getByRole('button', { name: 'Create Story' })).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText('Parent Epic'), `${epic.title}{Enter}`);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create Story' }));
    await expect(args.onAcceptAsStory).toHaveBeenCalledWith(candidate.id, epic.id, expect.objectContaining({ title: candidate.title }));
  },
};

export const RejectDialog: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'More actions for FF-48' }));
    await userEvent.click(body.getByRole('menuitem', { name: 'Reject' }));
    await userEvent.type(body.getByLabelText('Rejection reason for FF-48'), 'Not aligned right now.');
    await userEvent.click(body.getByRole('button', { name: 'Reject FF-48' }));
    await expect(args.onReject).toHaveBeenCalledWith(candidate.id, 'Not aligned right now.');
  },
};

export const DistractionsLoaded: Story = {
  args: { section: 'distractions', entities: [distraction] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Interesting, but not aligned with the Mission.')).toBeInTheDocument();
  },
};

export const DistractionsEmpty: Story = { args: { section: 'distractions', entities: [] } };

export const ReconsiderDialog: Story = {
  args: { section: 'distractions', entities: [distraction] },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'More actions for FF-48' }));
    await userEvent.click(body.getByRole('menuitem', { name: 'Reconsider' }));
    await userEvent.click(body.getByRole('button', { name: 'Return to Inbox' }));
    await expect(args.onReconsider).toHaveBeenCalledWith(distraction.id);
  },
};

export const Pending: Story = { args: { pending: true } };

export const LongUnbrokenText: Story = {
  args: { entities: [{ ...candidate, title: 'A very long unbroken-reference-identifier-2026-09-04-that-must-wrap' }, epic] },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};

const orderingCandidates = [candidate, {
  ...candidate, id: '01994770-0000-7000-8000-000000000002', key: 'FF-49', title: 'Review the next idea',
}, {
  ...candidate, id: '01994770-0000-7000-8000-000000000003', key: 'FF-50', title: 'Keep another intention',
}];

function InboxOrderingPreview(args: ComponentProps<typeof InboxView>) {
  const [entities, setEntities] = useState(args.entities);
  return <InboxView {...args} entities={entities} onReorder={(id, targetIndex) => {
    args.onReorder?.(id, targetIndex);
    setEntities((current) => {
      const ordered: Extract<ProjectedManagedEntity, { type: 'candidate' }>[] = args.section === 'distractions' ? distractions(current) : inboxCandidates(current);
      const [moving] = ordered.splice(ordered.findIndex((item) => item.id === id), 1);
      ordered.splice(targetIndex, 0, moving!);
      const ranks = generateNKeysBetween(null, null, ordered.length);
      const ranksById = new Map(ordered.map((item, index) => [item.id, ranks[index]!]));
      return current.map((item) => {
        const rank = ranksById.get(item.id);
        if (rank === undefined || item.type !== 'candidate') return item;
        return item.lifecycle === 'inbox' ? { ...item, inboxRank: rank } : { ...item, distractionRank: rank };
      });
    });
  }} />;
}

export const KeyboardReorder: Story = {
  args: { entities: orderingCandidates },
  render: (args) => <InboxOrderingPreview {...args} />,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const handle = canvas.getByRole('button', { name: 'Drag FF-49 Review the next idea' });
    handle.focus();
    await userEvent.keyboard('[Space]');
    await waitFor(() => expect(handle.closest('li')).toHaveAttribute('data-dragging', 'true'));
    await userEvent.keyboard('[ArrowUp]');
    await waitFor(() => expect(canvas.getAllByRole('heading', { level: 2 })[0]).toHaveAccessibleName('Review the next idea'));
    await userEvent.keyboard('[Space]');
    await waitFor(() => expect(args.onReorder).toHaveBeenCalledWith(orderingCandidates[1]!.id, 0));
    await waitFor(() => expect(canvas.getAllByRole('heading', { level: 2 })[0]).toHaveAccessibleName('Review the next idea'));
  },
};

export const PointerReorder: Story = {
  args: { entities: orderingCandidates },
  render: (args) => <InboxOrderingPreview {...args} />,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const handle = canvas.getByRole('button', { name: 'Drag FF-49 Review the next idea' });
    const target = canvas.getByRole('heading', { name: candidate.title }).closest('li')!;
    const from = handle.getBoundingClientRect();
    const to = target.getBoundingClientRect();
    const user = userEvent.setup();
    await user.pointer({ keys: '[MouseLeft>]', target: handle, coords: { clientX: from.x + from.width / 2, clientY: from.y + from.height / 2 } });
    await user.pointer({ target, coords: { clientX: to.x + 20, clientY: to.y + 10 } });
    await new Promise((resolve) => canvasElement.ownerDocument.defaultView!.requestAnimationFrame(() => canvasElement.ownerDocument.defaultView!.requestAnimationFrame(resolve)));
    await user.pointer({ keys: '[/MouseLeft]', target, coords: { clientX: to.x + 20, clientY: to.y + 10 } });
    await waitFor(() => expect(args.onReorder).toHaveBeenCalledWith(orderingCandidates[1]!.id, 0));
    await waitFor(() => expect(canvas.getAllByRole('heading', { level: 2 })[0]).toHaveAccessibleName('Review the next idea'));
  },
};

export const MenuOnlyReorder: Story = {
  args: { entities: orderingCandidates, dragEnabled: false },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  render: (args) => <InboxOrderingPreview {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button', { name: /^Drag / })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'More actions for FF-50' }));
    await userEvent.click(await within(canvasElement.ownerDocument.body).findByRole('menuitem', { name: 'Move to top' }));
    await waitFor(() => expect(canvas.getAllByRole('heading', { level: 2 })[0]).toHaveAccessibleName('Keep another intention'));
  },
};

const orderingDistractions = orderingCandidates.map((item) => ({ ...distraction, id: item.id, key: item.key, title: item.title }));

export const DistractionKeyboardReorder: Story = {
  ...KeyboardReorder,
  args: { entities: orderingDistractions, section: 'distractions' },
};

export const DistractionPointerReorder: Story = {
  ...PointerReorder,
  args: { entities: orderingDistractions, section: 'distractions' },
};

export const DistractionMenuOnlyReorder: Story = {
  ...MenuOnlyReorder,
  args: { entities: orderingDistractions, section: 'distractions', dragEnabled: false },
};
