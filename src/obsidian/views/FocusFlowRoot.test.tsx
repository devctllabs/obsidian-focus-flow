import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { WorkIndexSnapshot } from '../../application/indexing/work-index';
import { FocusFlowRoot } from './FocusFlowRoot';
import { TagCatalogService } from '../../application/tags/tag-catalog';
import { DEFAULT_SETTINGS } from '../../settings';
import { AppearanceStore } from '../../features/appearance/appearance';

function settingsWithCatalog(tagCatalog: TagCatalogService) {
  return {
    tagCatalog,
    getSettings: () => DEFAULT_SETTINGS,
    updateSettings: async () => undefined,
    requestRootSetup: async () => undefined,
    selectExistingRoot: async () => undefined,
    requestRootMove: async () => undefined,
    requestResumeRootMove: async () => undefined,
    hasPendingRootMove: () => false,
  };
}

describe('FocusFlowRoot', () => {
  it('applies shared accent previews to the plugin root', () => {
    const appearance = new AppearanceStore({ source: 'obsidian' }, vi.fn(async () => undefined));
    const snapshot: WorkIndexSnapshot = { phase: 'ready', entities: [], diagnostics: [] };
    const { container } = render(
      <FocusFlowRoot
        index={{ getSnapshot: () => snapshot, subscribe: () => () => undefined }}
        mode="inbox"
        onModeChange={vi.fn()}
        repairService={{ execute: vi.fn() }}
        settingsController={{ ...settingsWithCatalog(new TagCatalogService({ read: async () => null, update: async () => undefined })), appearance }}
      />,
    );
    const root = container.querySelector('main.focus-flow')!;
    expect(root).toHaveAttribute('data-ff-accent', 'obsidian');

    act(() => appearance.preview({ source: 'indigo' }));
    expect(root).toHaveAttribute('data-ff-accent', 'indigo');
  });

  it('opens History only after an interrupted Sprint close resumes successfully', async () => {
    const user = userEvent.setup();
    const onModeChange = vi.fn();
    let finish!: () => void;
    const resumeClose = vi.fn(
      () => new Promise<void>((resolve) => { finish = resolve; }),
    );
    const snapshot: WorkIndexSnapshot = {
      phase: 'ready',
      diagnostics: [],
      entities: [{
        id: '01994744-a401-759a-b582-4418f2f2405f',
        type: 'sprint',
        lifecycle: 'active',
        code: 'SPR-014',
        sequence: 14,
        startsOn: '2026-08-24',
        dueOn: '2026-08-30',
        startedAt: '2026-08-24T08:00:00Z',
        closedAt: null,
        provisionalStoryOutcomes: [],
        startSnapshot: { capturedAt: '2026-08-24T08:00:00Z', stories: [] },
        closeSnapshot: null,
        pendingClose: {
          operationId: '01994a8a-0371-7a2d-a3e9-247990391600',
          decisionsHash: 'sha256:reviewed',
          capturedAt: '2026-08-30T18:00:00Z',
          sprintId: '01994744-a401-759a-b582-4418f2f2405f',
          sprintPath: 'Focus Flow/Sprints/SPR-014.md',
          stories: [],
          tasks: [],
          delta: {
            addedStories: [], removedStories: [], addedTasks: [],
            removedTasks: [], changedAcceptanceCriteriaStories: [],
          },
          closeSnapshot: {
            operationId: '01994a8a-0371-7a2d-a3e9-247990391600',
            capturedAt: '2026-08-30T18:00:00Z',
            stories: [], tasks: [],
            summary: {
              attemptedStories: 0, storiesAtStart: 0, storiesAtClose: 0,
              storiesAdded: 0, storiesRemoved: 0, achievedStories: 0,
              notAchievedStories: 0, closedStories: 0,
              committedOpenTasks: 0, tasksAtStart: 0, tasksAtClose: 0,
              tasksAdded: 0, tasksRemoved: 0, completedDuringSprint: 0,
              openAtClose: 0, exceptionCount: 0,
            },
            effectiveTagSummary: [],
          },
          retrospective: { wins: [], friction: [], improvements: [] },
        },
        path: 'Focus Flow/Sprints/SPR-014.md',
      }],
    };
    const workflow = {
      captureCandidate: vi.fn(), acceptCandidateAsEpic: vi.fn(),
      acceptCandidateAsStory: vi.fn(), rejectCandidate: vi.fn(),
      createTask: vi.fn(), reorder: vi.fn(), createDraft: vi.fn(),
      addStoryToDraft: vi.fn(), removeStoryFromDraft: vi.fn(),
      cancelDraft: vi.fn(), startSprint: vi.fn(),
      addStoryToActive: vi.fn().mockResolvedValue({ kind: 'changed' }),
      removeStoryFromActive: vi.fn(), reparentActiveStory: vi.fn(),
      resumeClose,
    };

    render(
      <FocusFlowRoot
        index={{ getSnapshot: () => snapshot, subscribe: () => () => undefined }}
        mode="close"
        onModeChange={onModeChange}
        repairService={{ execute: vi.fn() }}
        workflow={workflow}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Resume close' }));
    expect(onModeChange).not.toHaveBeenCalled();
    await act(async () => finish());
    expect(onModeChange).toHaveBeenCalledOnce();
    expect(onModeChange).toHaveBeenCalledWith('history');
  });

  it('offers an explicit refresh with pending feedback', async () => {
    const user = userEvent.setup();
    const snapshot: WorkIndexSnapshot = { phase: 'ready', entities: [], diagnostics: [] };
    let finish!: () => void;
    const refresh = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    render(<FocusFlowRoot index={{ getSnapshot: () => snapshot, subscribe: () => () => undefined, refresh }} mode="inbox" onModeChange={vi.fn()} repairService={{ execute: vi.fn() }} />);
    await user.click(screen.getByRole('button', { name: 'Refresh notes' }));
    expect(refresh).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Refreshing notes…' })).toBeDisabled();
    await act(async () => finish());
    expect(screen.getByRole('button', { name: 'Refresh notes' })).toBeEnabled();
  });
  it('runs Candidate triage and disables workflow actions while pending', async () => {
    const user = userEvent.setup();
    const candidate = {
      id: '019946e9-0ef0-7ca3-af0c-ec423d76efed',
      key: 'FF-41',
      title: 'Explore weekly focus',
      type: 'candidate' as const,
      lifecycle: 'inbox' as const,
      createdAt: '2026-08-30T08:45:00+04:00',
      tags: [],
      effectiveTags: [],
      path: 'Focus Flow/Inbox/FF-41 Explore weekly focus.md',
    };
    let finish = (): void => undefined;
    const workflow = {
      captureCandidate: vi.fn(),
      acceptCandidateAsEpic: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      ),
      acceptCandidateAsStory: vi.fn(),
      rejectCandidate: vi.fn(),
      createTask: vi.fn(),
      reorder: vi.fn(),
      createDraft: vi.fn(),
      addStoryToDraft: vi.fn(),
      removeStoryFromDraft: vi.fn(),
      cancelDraft: vi.fn(),
      startSprint: vi.fn(),
      addStoryToActive: vi.fn().mockResolvedValue({ kind: 'changed' }),
      removeStoryFromActive: vi.fn(),
      reparentActiveStory: vi.fn(),
    };
    const workflowSnapshot: WorkIndexSnapshot = {
      phase: 'ready',
      entities: [candidate],
      diagnostics: [],
    };

    render(
      <FocusFlowRoot
        index={{
          getSnapshot: () => workflowSnapshot,
          subscribe: () => () => undefined,
        }}
        mode="inbox"
        onModeChange={vi.fn()}
        repairService={{ execute: vi.fn() }}
        workflow={workflow}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'More actions for FF-41' }));
    const accept = screen.getByRole('menuitem', { name: 'Accept as Epic' });
    await user.click(accept);
    await user.click(screen.getByRole('button', { name: 'Create Epic' }));

    expect(workflow.acceptCandidateAsEpic).toHaveBeenCalledWith(candidate.id, expect.objectContaining({ title: candidate.title }));
    expect(screen.getByRole('button', { name: 'Create Epic' })).toBeDisabled();
    expect(screen.getByLabelText('Title')).toBeDisabled();

    finish();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('renders index updates and unsubscribes when its owner unmounts', async () => {
    const user = userEvent.setup();
    let snapshot: WorkIndexSnapshot = {
      phase: 'loading',
      entities: [],
      diagnostics: [],
    };
    let notify = (): void => undefined;
    const unsubscribe = vi.fn();
    const index = {
      getSnapshot: () => snapshot,
      subscribe: vi.fn((listener: () => void) => {
        notify = listener;
        return unsubscribe;
      }),
    };
    const view = render(
      <FocusFlowRoot
        index={index}
        mode="plan"
        onModeChange={vi.fn()}
        repairService={{ execute: vi.fn() }}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Loading Focus Flow' }),
    ).toBeInTheDocument();

    snapshot = {
      phase: 'ready',
      entities: [],
      diagnostics: [
        {
          code: 'invalid-managed-data',
          message: 'Invalid managed data.',
          path: 'Focus Flow/Tasks/FF-43 Broken task.md',
        },
      ],
    };
    act(notify);

    expect(screen.getByRole('heading', { name: 'Plan' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1 notes need attention' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '1 notes need attention' }));
    expect(screen.getByRole('dialog', { name: 'Attention center' })).toHaveTextContent('Invalid managed data.');

    view.unmount();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('runs a diagnostic repair and exposes its pending state', async () => {
    const user = userEvent.setup();
    const repair = {
      kind: 'replace-parent-link' as const,
      path: 'Focus Flow/Stories/FF-42 Improve weekly focus.md',
      parentId: '019946c9-5f97-7196-8483-73469275ff90',
      field: 'epic_link' as const,
      expectedValue: '[[FF-99 Wrong Epic]]',
      replacementValue: '[[Focus Flow/Epics/FF-40 Build a calmer system]]',
    };
    const snapshot: WorkIndexSnapshot = {
      phase: 'ready',
      entities: [],
      diagnostics: [
        {
          code: 'parent-link-mismatch',
          message: 'Parent link does not match Epic FF-40.',
          path: repair.path,
          repair,
        },
      ],
    };
    let finishRepair = (): void => undefined;
    const repairService = {
      execute: vi.fn().mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            finishRepair = resolve;
          }),
      ),
    };

    render(
      <FocusFlowRoot
        index={{
          getSnapshot: () => snapshot,
          subscribe: () => () => undefined,
        }}
        mode="plan"
        onModeChange={vi.fn()}
        repairService={repairService}
      />,
    );

    await user.click(screen.getByRole('button', { name: '1 notes need attention' }));

    await user.click(
      screen.getByRole('button', {
        name: `Repair parent link for ${repair.path}`,
      }),
    );

    expect(repairService.execute).toHaveBeenCalledWith(repair);
    expect(
      screen.getByRole('button', { name: 'Repairing parent link' }),
    ).toBeDisabled();

    finishRepair();

    await waitFor(() =>
      expect(
        screen.getByRole('button', {
          name: `Repair parent link for ${repair.path}`,
        }),
      ).toBeEnabled(),
    );
  });

  it('announces a sanitized repair failure and enables retry', async () => {
    const user = userEvent.setup();
    const repair = {
      kind: 'replace-parent-link' as const,
      path: 'Focus Flow/Stories/FF-42 Improve weekly focus.md',
      parentId: '019946c9-5f97-7196-8483-73469275ff90',
      field: 'epic_link' as const,
      expectedValue: '[[FF-99 Wrong Epic]]',
      replacementValue: '[[Focus Flow/Epics/FF-40 Build a calmer system]]',
    };
    const snapshot: WorkIndexSnapshot = {
      phase: 'ready',
      entities: [],
      diagnostics: [
        {
          code: 'parent-link-mismatch',
          message: 'Parent link does not match Epic FF-40.',
          path: repair.path,
          repair,
        },
      ],
    };
    const repairService = {
      execute: vi.fn().mockRejectedValue(
        new Error('/Users/ethernity/vault/Focus Flow/Tasks/broken.md'),
      ),
    };

    render(
      <FocusFlowRoot
        index={{
          getSnapshot: () => snapshot,
          subscribe: () => () => undefined,
        }}
        mode="plan"
        onModeChange={vi.fn()}
        repairService={repairService}
      />,
    );

    await user.click(screen.getByRole('button', { name: '1 notes need attention' }));

    const repairButton = screen.getByRole('button', {
      name: `Repair parent link for ${repair.path}`,
    });
    await user.click(repairButton);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '[path redacted]',
    );
    expect(
      screen.queryByText('/Users/ethernity/vault/Focus Flow/Tasks/broken.md'),
    ).not.toBeInTheDocument();
    expect(repairButton).toBeEnabled();
  });

  it('routes accessible reordering through the workflow and sanitizes failures', async () => {
    const user = userEvent.setup();
    const epics: WorkIndexSnapshot['entities'] = [
      {
        id: '019946c9-5f97-7196-8483-73469275ff90',
        key: 'FF-40',
        title: 'First Epic',
        type: 'epic',
        lifecycle: 'backlog',
        backlogRank: 'a0',
        createdAt: '2026-08-30T08:30:00Z',
        tags: [],
        effectiveTags: [],
        path: 'Focus Flow/Epics/FF-40 First Epic.md',
      },
      {
        id: '019946c9-5f97-7196-8483-73469275ff91',
        key: 'FF-41',
        title: 'Second Epic',
        type: 'epic',
        lifecycle: 'backlog',
        backlogRank: 'a1',
        createdAt: '2026-08-30T08:31:00Z',
        tags: [],
        effectiveTags: [],
        path: 'Focus Flow/Epics/FF-41 Second Epic.md',
      },
    ];
    const reorder = vi
      .fn()
      .mockRejectedValue(
        new Error('Sensitive /Users/ethernity/vault and frontmatter'),
      );
    const workflow = {
      captureCandidate: vi.fn(),
      acceptCandidateAsEpic: vi.fn(),
      acceptCandidateAsStory: vi.fn(),
      rejectCandidate: vi.fn(),
      createTask: vi.fn(),
      reorder,
      createDraft: vi.fn(),
      addStoryToDraft: vi.fn(),
      removeStoryFromDraft: vi.fn(),
      cancelDraft: vi.fn(),
      startSprint: vi.fn(),
      addStoryToActive: vi.fn().mockResolvedValue({ kind: 'changed' }),
      removeStoryFromActive: vi.fn(),
      reparentActiveStory: vi.fn(),
    };
    const snapshot: WorkIndexSnapshot = {
      phase: 'ready',
      diagnostics: [],
      entities: epics,
    };

    render(
      <FocusFlowRoot
        index={{
          getSnapshot: () => snapshot,
          subscribe: () => () => undefined,
        }}
        mode="plan"
        onModeChange={vi.fn()}
        repairService={{ execute: vi.fn() }}
        workflow={workflow}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Expand FF-41' }));
    await user.click(screen.getByLabelText('Actions for FF-41'));
    await user.click(screen.getByRole('menuitem', { name: 'Move to top' }));

    expect(reorder).toHaveBeenCalledWith(epics[1]!.id, 0);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Sensitive [path redacted] and frontmatter',
    );
    expect(
      screen.queryByText('Sensitive /Users/ethernity/vault and frontmatter'),
    ).not.toBeInTheDocument();
  });

  it('routes Draft creation through the serialized Sprint workflow', async () => {
    const user = userEvent.setup();
    const createDraft = vi.fn().mockResolvedValue(undefined);
    const workflow = {
      captureCandidate: vi.fn(),
      acceptCandidateAsEpic: vi.fn(),
      acceptCandidateAsStory: vi.fn(),
      rejectCandidate: vi.fn(),
      createTask: vi.fn(),
      reorder: vi.fn(),
      createDraft,
      addStoryToDraft: vi.fn(),
      removeStoryFromDraft: vi.fn(),
      cancelDraft: vi.fn(),
      startSprint: vi.fn(),
      addStoryToActive: vi.fn().mockResolvedValue({ kind: 'changed' }),
      removeStoryFromActive: vi.fn(),
      reparentActiveStory: vi.fn(),
    };
    const snapshot: WorkIndexSnapshot = {
      phase: 'ready',
      entities: [],
      diagnostics: [],
    };

    render(
      <FocusFlowRoot
        index={{
          getSnapshot: () => snapshot,
          subscribe: () => () => undefined,
        }}
        mode="plan"
        onModeChange={vi.fn()}
        repairService={{ execute: vi.fn() }}
        workflow={workflow}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: 'Create Draft Sprint' }),
    );

    expect(createDraft).toHaveBeenCalledOnce();
  });

  it('routes Epic completion through the serialized workflow', async () => {
    const user = userEvent.setup();
    const completeEpic = vi.fn().mockResolvedValue(undefined);
    const workflow = {
      captureCandidate: vi.fn(), acceptCandidateAsEpic: vi.fn(),
      acceptCandidateAsStory: vi.fn(), rejectCandidate: vi.fn(),
      createTask: vi.fn(), reorder: vi.fn(), createDraft: vi.fn(),
      addStoryToDraft: vi.fn(), removeStoryFromDraft: vi.fn(),
      cancelDraft: vi.fn(), startSprint: vi.fn(),
      addStoryToActive: vi.fn().mockResolvedValue({ kind: 'changed' }),
      removeStoryFromActive: vi.fn(), reparentActiveStory: vi.fn(),
      completeEpic,
      closeEpic: vi.fn(),
    };
    const entities: WorkIndexSnapshot['entities'] = [
      {
        id: '019946c9-5f97-7196-8483-73469275ff90', key: 'FF-40',
        title: 'Epic', type: 'epic', lifecycle: 'backlog', backlogRank: 'a0',
        acceptanceCriteria: [{ text: 'Done', checked: true }],
        createdAt: '2026-08-01T00:00:00Z', tags: [], effectiveTags: [],
        path: 'Focus Flow/Epics/FF-40 Epic.md',
      },
      {
        id: '019946f1-8d2a-7f05-87b1-1eebbb476300', key: 'FF-41',
        title: 'Story', type: 'story', lifecycle: 'done',
        epicId: '019946c9-5f97-7196-8483-73469275ff90', epicLink: '[[Epic]]',
        backlogRank: null, sprintId: null, sprintRank: null,
        acceptanceCriteria: [], completedAt: '2026-09-01T00:00:00Z',
        outcome: 'achieved', createdAt: '2026-08-01T00:00:00Z', tags: [],
        effectiveTags: [], path: 'Focus Flow/Stories/FF-41 Story.md',
      },
    ];
    const snapshot: WorkIndexSnapshot = {
      phase: 'ready',
      entities,
      diagnostics: [],
    };
    render(
      <FocusFlowRoot
        index={{
          getSnapshot: () => snapshot,
          subscribe: () => () => undefined,
        }}
        mode="plan"
        onModeChange={vi.fn()}
        repairService={{ execute: vi.fn() }}
        workflow={workflow}
      />,
    );

    if (screen.queryByRole('button', { name: 'Expand FF-40' })) await user.click(screen.getByRole('button', { name: 'Expand FF-40' }));
    await user.click(screen.getByRole('button', { name: 'Actions for FF-40' }));
    await user.click(screen.getByRole('menuitem', { name: 'Complete FF-40' }));
    expect(completeEpic).toHaveBeenCalledWith(entities[0]!.id);
  });

  it('offers and clears an advisory repair for a current uncataloged tag', async () => {
    const user = userEvent.setup();
    let catalogMarkdown: string | null = null;
    const tagCatalog = new TagCatalogService({
      read: async () => catalogMarkdown,
      update: async (transform) => { catalogMarkdown = transform(catalogMarkdown); },
    });
    const candidate = {
      id: '019946e9-0ef0-7ca3-af0c-ec423d76efed', key: 'FF-41', title: 'Candidate',
      type: 'candidate' as const, lifecycle: 'inbox' as const, createdAt: '2026-09-07T00:00:00Z',
      tags: ['direct'], effectiveTags: ['direct'], path: 'Focus Flow/Inbox/FF-41 Candidate.md',
    };
    const snapshot: WorkIndexSnapshot = { phase: 'ready', entities: [candidate], diagnostics: [] };
    render(<FocusFlowRoot
      index={{ getSnapshot: () => snapshot, subscribe: () => () => undefined }}
      mode="inbox"
      onModeChange={vi.fn()}
      repairService={{ execute: async (plan) => { if (plan.kind === 'catalog-tag') await tagCatalog.upsert(plan.tag); } }}
      settingsController={settingsWithCatalog(tagCatalog)}
    />);

    await user.click(await screen.findByRole('button', { name: '1 notes need attention' }));
    await user.click(screen.getByRole('button', { name: 'Add #direct to catalog' }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Attention center' })).not.toBeInTheDocument());
    expect(tagCatalog.getSnapshot().entries.direct).toEqual({});
    expect(snapshot.entities[0]).toBe(candidate);
  });

  it('keeps a saved work change successful and reports a catalog write failure', async () => {
    const user = userEvent.setup();
    const tagCatalog = new TagCatalogService({
      read: async () => null,
      update: async () => { throw new Error('TAGS.md is not writable.'); },
    });
    const acceptCandidateAsEpic = vi.fn().mockResolvedValue(undefined);
    const workflow = {
      captureCandidate: vi.fn(), acceptCandidateAsEpic, acceptCandidateAsStory: vi.fn(), rejectCandidate: vi.fn(),
      createTask: vi.fn(), reorder: vi.fn(), createDraft: vi.fn(), addStoryToDraft: vi.fn(), removeStoryFromDraft: vi.fn(),
      cancelDraft: vi.fn(), startSprint: vi.fn(), addStoryToActive: vi.fn().mockResolvedValue({ kind: 'changed' }),
      removeStoryFromActive: vi.fn(), reparentActiveStory: vi.fn(),
    };
    const candidate = {
      id: '019946e9-0ef0-7ca3-af0c-ec423d76efed', key: 'FF-41', title: 'Keep the work',
      type: 'candidate' as const, lifecycle: 'inbox' as const, createdAt: '2026-09-07T00:00:00Z',
      tags: [], effectiveTags: [], path: 'Focus Flow/Inbox/FF-41 Keep the work.md',
    };
    const snapshot: WorkIndexSnapshot = { phase: 'ready', entities: [candidate], diagnostics: [] };
    render(<FocusFlowRoot
      index={{ getSnapshot: () => snapshot, subscribe: () => () => undefined }}
      mode="inbox"
      onModeChange={vi.fn()}
      repairService={{ execute: vi.fn() }}
      settingsController={settingsWithCatalog(tagCatalog)}
      workflow={workflow}
    />);

    await user.click(screen.getByRole('button', { name: 'More actions for FF-41' }));
    await user.click(screen.getByRole('menuitem', { name: 'Accept as Epic' }));
    await user.type(screen.getByRole('combobox', { name: 'Tags' }), 'new/topic{Enter}');
    await user.click(screen.getByRole('button', { name: 'Create Epic' }));

    await waitFor(() => expect(acceptCandidateAsEpic).toHaveBeenCalledWith(candidate.id, expect.objectContaining({ tags: ['new/topic'] })));
    expect(await screen.findByRole('alert')).toHaveTextContent('Work was saved, but its new tags could not be added to the catalog.');
    expect(screen.queryByRole('dialog', { name: 'Accept FF-41 as Epic' })).not.toBeInTheDocument();
  });
});
