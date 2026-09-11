import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { useState, type ComponentProps } from 'react';
import { generateKeyBetween } from 'fractional-indexing';
import type { StoryPosition } from '../../application/planning/active-story-membership';
import { PlanningReorderService } from '../../application/planning/reorder-work';
import { MonthBacklogService } from '../../application/planning/month-backlog';
import type { CandidateAcceptanceFields } from '../../application/work/triage-candidate';
import { readBodyFields, writeBodyFields } from '../../application/work/work-body-fields';
import { readAcceptanceCriteria, replaceAcceptanceCriteria } from '../../domain/acceptance-criteria';
import { activeSprint, activeStory, candidate, distraction, epic, readyFocusEntities, secondEpic, secondStory, task } from '../../test/storybook/fixtures';
import { reportSprints } from '../../test/storybook/history-fixtures';
import { withHostFrame } from '../../test/storybook/host-frames';
import { FocusFlowShell } from './FocusFlowShell';
import type { FocusFlowMode } from './FocusFlowShell';
import { SettingsSurface } from '../settings/SettingsSurface';
import { createSettingsController } from '../../test/storybook/fakes';
import { TagCatalogService } from '../../application/tags/tag-catalog';
import { TagCatalogProvider } from '../ui/TagCatalog';
import { AppearanceProvider } from '../appearance/AppearanceRoot';

const parentLinkDiagnostic = {
  code: 'parent-link-mismatch' as const,
  message: 'Parent link does not match Epic FF-40.',
  path: 'Focus Flow/Stories/FF-42 Improve weekly focus.md',
  repair: {
    kind: 'replace-parent-link' as const,
    path: 'Focus Flow/Stories/FF-42 Improve weekly focus.md',
    parentId: epic.id,
    field: 'epic_link' as const,
    expectedValue: '[[FF-99 Wrong Epic]]',
    replacementValue: '[[Focus Flow/Epics/FF-40 Build a calmer system]]',
  },
};

const meta = {
  title: 'Features/Shell/FocusFlowShell',
  component: FocusFlowShell,
  decorators: [withHostFrame('leaf')],
  args: { mode: 'focus' as const, onModeChange: fn(), onOpenCapture: fn(), onRefresh: fn() },
} satisfies Meta<typeof FocusFlowShell>;

export default meta;
type Story = StoryObj<typeof meta>;

// Synthetic, deterministic work: a complete workspace for visual review.
export const Loaded: Story = {
  render: (args) => <WorkspacePreview {...args} />,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: 'Capture Candidate' })).toBeVisible();
  },
};

export const TagCatalog: Story = {
  render: (args) => <WorkspacePreview {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const navigation = within(canvas.getByRole('navigation', { name: 'Focus Flow pages' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Settings' }));
    const catalog = within(canvas.getByRole('region', { name: 'Tags' }));
    await userEvent.click(catalog.getByRole('button', { name: 'Tags' }));
    const search = catalog.getByRole('searchbox', { name: 'Find or add a tag' });
    await userEvent.type(search, 'focus');
    await userEvent.click(catalog.getByRole('button', { name: 'Edit #focus' }));
    await userEvent.click(catalog.getByRole('button', { name: 'Violet' }));
    await expect(catalog.getByRole('status')).toHaveTextContent('Color saved for #focus');
    await userEvent.click(navigation.getByRole('button', { name: 'Focus' }));
    await waitFor(() => expect(canvasElement.querySelector('[style*="--ff-tag-color: #6750A4"]')).not.toBeNull());
    await userEvent.click(canvas.getByRole('button', { name: 'Settings' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Tags' }));
    await expect(canvas.getByRole('button', { name: 'Edit #focus' })).toHaveTextContent('#6750A4');
  },
};

export const AccentColor: Story = {
  render: (args) => <WorkspacePreview {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Settings' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Accent color' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Teal' }));
    await waitFor(() => expect(canvasElement.querySelector('main.focus-flow')).toHaveAttribute('data-ff-accent', 'custom'));
    await expect(canvas.getByRole('button', { name: 'Teal' })).toHaveAttribute('aria-pressed', 'true');
    await expect(canvas.getByRole('textbox', { name: 'Custom accent HEX' })).toHaveValue('#0F766E');
  },
};

export const RefreshPending: Story = { args: { indexState: { phase: 'ready', entities: readyFocusEntities, diagnostics: [] }, refreshing: true } };

export const TaskEditing: Story = {
  render: (args) => <WorkspacePreview {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'More actions for FF-50' }));
    await userEvent.click(page.getByRole('menuitem', { name: 'Edit…' }));
    await userEvent.clear(page.getByLabelText('Title'));
    await userEvent.type(page.getByLabelText('Title'), 'Write a useful reflection');
    await userEvent.type(page.getByLabelText('Description'), 'Keep the **context**.');
    await userEvent.click(page.getByRole('button', { name: 'Add criterion' }));
    await userEvent.type(page.getByLabelText('Criterion 1'), 'One useful next step');
    await userEvent.click(page.getByRole('button', { name: 'Save changes' }));
    await expect(await canvas.findByRole('button', { name: 'Open FF-50 Write a useful reflection' })).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Plan' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Expand FF-42' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Reorder FF-50' }));
    await userEvent.click(page.getByRole('menuitem', { name: 'Edit…' }));
    await expect(page.getByLabelText('Description')).toHaveValue('Keep the **context**.');
    await expect(page.getByLabelText('Criterion 1')).toHaveValue('One useful next step');
    await userEvent.click(page.getByRole('button', { name: 'Close dialog' }));
  },
};

export const PageHeadingAlignment: Story = {
  render: (args) => <WorkspacePreview {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tops: number[] = [];
    for (const mode of ['Plan', 'Inbox', 'History']) {
      await userEvent.click(within(canvas.getByRole('navigation', { name: 'Focus Flow pages' })).getByRole('button', { name: new RegExp(`^${mode}`) }));
      tops.push(canvas.getByRole('heading', { name: mode }).getBoundingClientRect().top);
    }
    await expect(Math.max(...tops) - Math.min(...tops)).toBeLessThan(1);
  },
};

export const EpicBacklogReorder: Story = {
  render: (args) => <WorkspacePreview {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(within(canvas.getByRole('navigation', { name: 'Focus Flow pages' })).getByRole('button', { name: 'Plan' }));
    const backlog = canvas.getByRole('region', { name: 'Epic backlog' });
    await expect(within(backlog).getByRole('button', { name: /Drag FF-47/ })).toBeVisible();
    await userEvent.click(within(backlog).getByRole('button', { name: 'Actions for FF-47' }));
    await userEvent.click(page.getByRole('menuitem', { name: 'Move up' }));
    await waitFor(() => expect(backlog.querySelector('.focus-flow__planning-item')).toHaveTextContent('FF-47'));
    const handle = within(backlog).getByRole('button', { name: /Drag FF-47/ });
    handle.focus();
    await userEvent.keyboard(' {ArrowDown} ');
    await waitFor(() => expect(backlog.querySelector('.focus-flow__planning-item')).toHaveTextContent('FF-40'));
  },
};

export const PlanMembershipDrag: Story = {
  render: (args) => <WorkspacePreview {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'Plan' }));
    const dragToSprint = async () => {
      canvas.getByRole('button', { name: 'Drag FF-45 Summarize review notes' }).focus();
      await userEvent.keyboard('[Space][ArrowUp][Space]');
      await waitFor(() => expect(body.getByRole('dialog', { name: 'Add to Active Sprint?' })).toBeVisible());
    };
    await dragToSprint();
    await userEvent.click(body.getByRole('button', { name: 'Add to Sprint' }));
    await expect(await canvas.findByRole('button', { name: 'Return FF-45 to Month backlog' })).toBeVisible();
    await expect(canvas.getByRole('region', { name: 'Month backlog' }).querySelector('.focus-flow__empty-drop-target')).toBeInTheDocument();
  },
};

export const EpicToMonth: Story = {
  render: (args) => <WorkspacePreview {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'Plan' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Expand FF-40' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Add FF-55 to Month backlog' }));
    await expect(await canvas.findByRole('button', { name: 'Reorder FF-55' })).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Reorder FF-55' }));
    await userEvent.click(body.getByRole('menuitem', { name: 'Return to Epic' }));
    await expect(await canvas.findByRole('button', { name: 'Add FF-55 to Month backlog' })).toBeVisible();
  },
};

function WorkspacePreview(args: ComponentProps<typeof FocusFlowShell>) {
  const [mode, setMode] = useState<FocusFlowMode>('focus');
  const [section, setSection] = useState<'candidates' | 'distractions'>('candidates');
  const [entities, setEntities] = useState<NonNullable<ComponentProps<typeof FocusFlowShell>['indexState']>['entities']>([
      ...readyFocusEntities, epic, secondEpic, secondStory, candidate, { ...distraction, id: 'preview-distraction', key: 'FF-54' }, ...reportSprints,
      { ...secondStory, id: 'preview-deferred', key: 'FF-55', epicId: epic.id, lifecycle: 'epic_backlog', backlogRank: null, sprintId: null, sprintRank: null, title: 'Make the next review effortless' },
      { ...task, id: 'preview-in-progress', key: 'FF-50', status: 'in_progress', title: 'Write the weekly reflection' },
      { ...task, id: 'preview-task-1', key: 'FF-51', taskRank: 'a3', status: 'today', title: 'Choose one improvement to carry forward' },
      { ...activeStory, id: 'preview-story-2', key: 'FF-52', sprintRank: 'a2', title: 'Make space for deeper work' },
      { ...task, id: 'preview-task-2', key: 'FF-53', storyId: 'preview-story-2', status: 'today', title: 'Clear the notes waiting for a decision' },
    ]);
  const [tagCatalog] = useState(() => {
    let markdown: string | null = null;
    return new TagCatalogService({ read: async () => markdown, update: async (transform) => { markdown = transform(markdown); } });
  });
  const [baseSettingsController] = useState(() => createSettingsController({ setupCompleted: true }));
  const settingsController = {
    ...baseSettingsController,
    tagCatalog,
    listTags: () => [...new Set((entities ?? []).flatMap((entity) => entity.type === 'sprint' && entity.lifecycle === 'closed' ? entity.closeSnapshot.effectiveTagSummary.map((entry) => entry.tag) : 'effectiveTags' in entity ? entity.effectiveTags : []))],
  };
  const acceptPreview = (id: string, target: 'epic' | 'story', fields?: CandidateAcceptanceFields, epicId?: string) => setEntities((current) => acceptPreviewCandidate(current, { id, target, fields, epicId }));
  const movePreviewStory = (storyId: string, position: StoryPosition, adding: boolean) => setEntities((current) => {
    const rankOf = (id: string | null) => {
      const item = current?.find((entity) => entity.id === id);
      return item?.type === 'story' ? (adding ? item.sprintRank : item.backlogRank) : null;
    };
    const rank = generateKeyBetween(rankOf(position.beforeStoryId), rankOf(position.afterStoryId));
    return current?.map((entity) => entity.type === 'story' && entity.id === storyId ? {
      ...entity, lifecycle: adding ? 'active_sprint' as const : 'backlog' as const,
      sprintId: adding ? activeSprint.id : null, sprintRank: adding ? rank : null,
      backlogRank: adding ? entity.backlogRank : rank,
    } : entity);
  });
  return <AppearanceProvider appearance={baseSettingsController.appearance}><TagCatalogProvider service={tagCatalog}><FocusFlowShell {...args} mode={mode} onModeChange={setMode} inboxSection={section} onInboxSectionChange={setSection}
    dragEnabled
    onAcceptCandidateAsEpic={async (id, fields) => acceptPreview(id, 'epic', fields)}
    onAcceptCandidateAsStory={async (id, epicId, fields) => acceptPreview(id, 'story', fields, epicId)}
    onSetMonthMembership={(id, selected) => {
      const service = new MonthBacklogService({ refresh: async () => undefined, getSnapshot: () => ({ phase: 'ready', entities: entities ?? [], diagnostics: [] }) }, async (plan) => setEntities((current) => current?.map((entity) => entity.type === 'story' && entity.id === plan.note.id ? { ...entity, lifecycle: plan.selected ? 'backlog' : 'epic_backlog', backlogRank: plan.backlogRank } : entity)));
      void service.setSelected(id, selected);
    }}
    onReorder={(id, targetIndex) => {
      const reorder = new PlanningReorderService({ rebalanceRanks: async (plan) => setEntities((current) => current?.map((entity) => {
        const entry = plan.entries.find((entry) => entry.id === entity.id);
        if (!entry) return entity;
        if (entry.field === 'task_rank' && entity.type === 'task') return { ...entity, taskRank: entry.replacementValue };
        if (entry.field === 'sprint_rank' && entity.type === 'story') return { ...entity, sprintRank: entry.replacementValue };
        if (entry.field === 'backlog_rank' && (entity.type === 'story' || (entity.type === 'epic' && entity.lifecycle === 'backlog'))) return { ...entity, backlogRank: entry.replacementValue };
        return entity;
      })) }, { refresh: async () => undefined, getSnapshot: () => ({ phase: 'ready', entities: entities ?? [], diagnostics: [] }) });
      void reorder.execute(id, targetIndex);
    }}
    onDeleteDistraction={async (id) => setEntities((current) => current?.filter((entity) => entity.id !== id))}
    onEditCandidate={async (request) => setEntities((current) => current?.map((entity) => entity.type === 'candidate' && entity.id === request.candidateId ? { ...entity, title: request.title, tags: [...request.tags], effectiveTags: [...request.tags], bodyFields: request.bodyFields ?? entity.bodyFields } : entity))}
    onEditOutcome={async (request) => setEntities((current) => current?.map((entity) => {
      if ((entity.type !== 'story' && entity.type !== 'epic' && entity.type !== 'task') || entity.id !== request.id) return entity;
      const fields = { title: request.title, tags: [...request.tags], effectiveTags: [...new Set([...request.tags, ...entity.effectiveTags.filter((tag) => !entity.tags.includes(tag))])] };
      return entity.type === 'task'
        ? { ...entity, ...fields, bodyFields: readBodyFields(replaceAcceptanceCriteria(writeBodyFields('', request.bodyFields ?? entity.bodyFields ?? {}), request.acceptanceCriteria)) }
        : { ...entity, ...fields, acceptanceCriteria: [...request.acceptanceCriteria], bodyFields: request.bodyFields ?? entity.bodyFields };
    }))}
    onEvaluateStory={(request) => setEntities((current) => current?.map((entity) => entity.type === 'sprint' && entity.lifecycle === 'active' ? { ...entity, provisionalStoryOutcomes: [...entity.provisionalStoryOutcomes.filter((outcome) => outcome.storyId !== request.storyId), { ...request, evaluatedAt: '2026-09-05T12:00:00Z', acceptanceExceptionReason: request.acceptanceExceptionReason ?? null }] } : entity))}
    onAddStoryToActive={async (id, position) => { movePreviewStory(id, position, true); return { kind: 'changed' }; }}
    onRemoveStoryFromActive={(id, position) => movePreviewStory(id, position ?? { beforeStoryId: null, afterStoryId: null }, false)}
    onMoveTask={async (request) => {
      setEntities((current) => current?.map((entity) => entity.type === 'task' && entity.id === request.taskId
        ? { ...entity, status: request.targetStatus, lifecycle: request.targetStatus === 'done' ? 'done' : 'active', completedAt: request.targetStatus === 'done' ? '2026-09-05T12:00:00Z' : null }
        : entity));
      return { kind: 'moved', changed: true };
    }}
    onCreateTask={async (storyId, title, _confirmed, details) => {
      setEntities((current) => [...(current ?? []), { ...task, id: `preview-created-${current?.length ?? 0}`, key: `FF-${60 + (current?.length ?? 0)}`, title, storyId, status: 'todo', taskRank: 'b0', tags: [...(details?.tags ?? [])], bodyFields: details?.bodyFields }]);
      return { kind: 'created', path: 'preview.md' };
    }}
    settingsSurface={<SettingsSurface controller={settingsController} />}
    indexState={{ phase: 'ready', diagnostics: [], entities }} /></TagCatalogProvider></AppearanceProvider>;
}

type PreviewEntities = NonNullable<ComponentProps<typeof FocusFlowShell>['indexState']>['entities'];

function acceptPreviewCandidate(current: PreviewEntities, request: { id: string; target: 'epic' | 'story'; fields?: CandidateAcceptanceFields; epicId?: string }): PreviewEntities {
  return current?.map((entity) => acceptPreviewEntity(entity, current, request));
}

function acceptPreviewEntity(entity: NonNullable<PreviewEntities>[number], current: NonNullable<PreviewEntities>, request: { id: string; target: 'epic' | 'story'; fields?: CandidateAcceptanceFields; epicId?: string }) {
  if (entity.type !== 'candidate' || entity.id !== request.id) return entity;
  const authoring = previewAuthoring(entity, request.fields);
  if (request.target === 'epic') return previewEpic(current, entity, authoring);
  const parent = current.find((item) => item.id === request.epicId && item.type === 'epic');
  return { ...entity, ...authoring, type: 'story' as const, lifecycle: 'epic_backlog' as const, epicId: request.epicId!, epicLink: `[[${parent?.path.replace(/\.md$/, '')}]]`, backlogRank: null, sprintId: null, sprintRank: null };
}

function previewAuthoring(entity: Extract<NonNullable<PreviewEntities>[number], { type: 'candidate' }>, fields?: CandidateAcceptanceFields) {
  const body = writeBodyFields('', fields?.bodyFields ?? entity.bodyFields ?? {});
  return { title: fields?.title ?? entity.title, tags: [...(fields?.tags ?? entity.tags)], bodyFields: readBodyFields(body, false), acceptanceCriteria: readAcceptanceCriteria(body) };
}

function previewEpic(current: NonNullable<PreviewEntities>, entity: Extract<NonNullable<PreviewEntities>[number], { type: 'candidate' }>, authoring: { title: string; tags: string[]; bodyFields: ReturnType<typeof readBodyFields>; acceptanceCriteria: ReturnType<typeof readAcceptanceCriteria> }) {
  const lastRank = current.filter((item) => item.type === 'epic' && item.lifecycle === 'backlog').map((item) => item.backlogRank).sort().at(-1) ?? null;
  return { ...entity, ...authoring, type: 'epic' as const, lifecycle: 'backlog' as const, backlogRank: generateKeyBetween(lastRank, null) };
}

export const Loading: Story = {
  args: { indexState: { phase: 'loading', diagnostics: [] } },
};

export const ReadErrorWithStaleContent: Story = {
  args: {
    indexState: {
      phase: 'error',
      diagnostics: [],
      errorMessage: 'Focus Flow could not read managed notes.',
      entities: [candidate],
    },
  },
};

export const WorkflowError: Story = {
  args: {
    mode: 'inbox',
    workflowError: 'A Sprint already started for 2026-08-31.',
    indexState: { phase: 'ready', diagnostics: [], entities: [candidate, epic] },
  },
};

export const AttentionCenter: Story = {
  args: {
    mode: 'plan',
    onRepairDiagnostic: fn(),
    indexState: { phase: 'ready', diagnostics: [parentLinkDiagnostic], entities: [candidate, activeSprint] },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: '1 notes need attention' }));
    await waitFor(() => expect(within(canvasElement.ownerDocument.body).getByRole('dialog', { name: 'Attention center' })).toBeVisible());
    await userEvent.click(within(canvasElement.ownerDocument.body).getByRole('button', { name: /Repair parent link/ }));
    await expect(args.onRepairDiagnostic).toHaveBeenCalledWith(parentLinkDiagnostic.repair);
    await userEvent.keyboard('{Escape}');
    await expect(canvas.getByRole('button', { name: '1 notes need attention' })).toHaveFocus();
  },
};

export const RepairPending: Story = {
  args: { mode: 'plan', repairing: true, indexState: { phase: 'ready', diagnostics: [parentLinkDiagnostic] } },
};

export const RepairError: Story = {
  args: {
    mode: 'plan',
    repairError: '[path redacted].',
    indexState: { phase: 'ready', diagnostics: [parentLinkDiagnostic] },
  },
};

export const SettingsFallback: Story = {
  args: { mode: 'settings', indexState: { phase: 'ready', diagnostics: [] } },
};
