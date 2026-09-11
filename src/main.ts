import { Notice, Plugin, type TAbstractFile } from 'obsidian';
import { WorkIndex } from './application/indexing/work-index';
import { PathRefreshBatcher } from './application/indexing/path-refresh-batcher';
import { TagCatalogService } from './application/tags/tag-catalog';
import { currentNativeTagUsage } from './application/tags/catalog-diagnostics';
import { ObsidianTagCatalogStore } from './obsidian/services/ObsidianTagCatalogStore';
import { ObsidianManagedStore } from './obsidian/services/ObsidianManagedStore';
import { ObsidianLifecycleWriter } from './obsidian/services/ObsidianLifecycleWriter';
import { ObsidianSprintCloseWriter } from './obsidian/services/ObsidianSprintCloseWriter';
import type { WorkspaceLifecycle } from './application/workspace/workspace-lifecycle';
import { DiagnosticRepairService } from './application/repairs/repair-diagnostic';
import { CatalogTagRepairService } from './application/repairs/repair-catalog-tag';
import { KeyRepairService } from './application/repairs/repair-keys';
import { IdRepairService } from './application/repairs/repair-ids';
import { NotePlacementRepairService } from './application/repairs/repair-note-placement';
import { ParentLinkRepairService } from './application/repairs/repair-parent-link';
import { RankRepairService } from './application/repairs/repair-ranks';
import { PlanningReorderService } from './application/planning/reorder-work';
import { MonthBacklogService } from './application/planning/month-backlog';
import { setObsidianMonthMembership } from './obsidian/services/ObsidianMonthBacklogWriter';
import { SprintPlanningService } from './application/planning/plan-sprint';
import { ActiveStoryMembershipService } from './application/planning/active-story-membership';
import { EpicFinalizationService } from './application/planning/finalize-epic';
import { WorkCreationService } from './application/work/create-work';
import { CandidateTriageService } from './application/work/triage-candidate';
import { FocusBoardService } from './application/focus/focus-board';
import { StoryEvaluationService } from './application/closing/evaluate-story';
import { SprintCloseService } from './application/closing/close-sprint';
import type { FocusFlowMode } from './features/shell/FocusFlowShell';
import { ObsidianParentLinkWriter } from './obsidian/services/ObsidianParentLinkWriter';
import { ObsidianKeyRepairWriter } from './obsidian/services/ObsidianKeyRepairWriter';
import { ObsidianIdRepairWriter } from './obsidian/services/ObsidianIdRepairWriter';
import { ObsidianNoteMover } from './obsidian/services/ObsidianNoteMover';
import { ObsidianRankWriter } from './obsidian/services/ObsidianRankWriter';
import { ObsidianWorkCreator } from './obsidian/services/ObsidianWorkCreator';
import { ObsidianTemplateRenderer } from './obsidian/services/ObsidianTemplateRenderer';
import { ObsidianCandidateTriageWriter } from './obsidian/services/ObsidianCandidateTriageWriter';
import { ObsidianNoteOpener } from './obsidian/services/ObsidianNoteOpener';
import { ObsidianMissionCreator } from './obsidian/services/ObsidianMissionCreator';
import { ObsidianSprintPlanningWriter } from './obsidian/services/ObsidianSprintPlanningWriter';
import { ObsidianActiveStoryMembershipWriter } from './obsidian/services/ObsidianActiveStoryMembershipWriter';
import { ObsidianTaskMovementWriter } from './obsidian/services/ObsidianTaskMovementWriter';
import { WebCryptoContentHasher } from './obsidian/services/WebCryptoContentHasher';
import { ObsidianStoryEvaluationWriter } from './obsidian/services/ObsidianStoryEvaluationWriter';
import { ObsidianTextTemplateReader } from './obsidian/services/ObsidianTextTemplateReader';
import { STANDARD_BODY_TEMPLATES } from './application/work/standard-templates';
import {
  parsePendingRootMove,
  remapTemplates,
  RootWorkspaceService,
  type PendingRootMove,
  type RootWorkspaceState,
} from './application/root/root-workspace';
import { CandidateCaptureModal } from './obsidian/commands/CandidateCaptureModal';
import { deleteDistraction } from './application/work/delete-distraction';
import { WorkDeletionService, type WorkDeletionPreview } from './application/work/delete-work';
import { ObsidianWorkTrash } from './obsidian/services/ObsidianWorkTrash';
import { editCandidate, type EditCandidateRequest } from './application/work/edit-candidate';
import { editObsidianCandidate } from './obsidian/services/ObsidianCandidateEditor';
import { editOutcome, type EditOutcomeRequest } from './application/work/edit-outcome';
import { editObsidianOutcome } from './obsidian/services/ObsidianOutcomeEditor';
import { trashObsidianDistraction } from './obsidian/services/ObsidianDistractionTrash';
import { FocusFlowSettingTab } from './obsidian/settings/FocusFlowSettingTab';
import {
  confirmResumeRootMove,
  confirmRootMove,
  confirmRootSetup,
} from './obsidian/settings/RootSetupModal';
import { ObsidianRootWorkspaceStorage } from './obsidian/services/ObsidianRootWorkspaceStorage';
import {
  isManagedIndexPath,
  ObsidianWorkNoteSourceRepository,
} from './obsidian/services/ObsidianWorkNoteSourceRepository';
import {
  FOCUS_FLOW_VIEW_TYPE,
  FocusFlowView,
} from './obsidian/views/FocusFlowView';
import {
  DEFAULT_SETTINGS,
  type FocusFlowSettings,
  normalizeSettings,
} from './settings';
import { v7 as uuidv7 } from 'uuid';
import { AppearanceStore } from './features/appearance/appearance';

const MODE_COMMANDS: Array<{
  mode: FocusFlowMode;
  name: string;
}> = [
  { mode: 'focus', name: 'Open Focus' },
  { mode: 'plan', name: 'Open Plan' },
  { mode: 'inbox', name: 'Open Inbox' },
  { mode: 'history', name: 'Open History' },
];

export default class FocusFlowPlugin extends Plugin {
  settings: FocusFlowSettings = DEFAULT_SETTINGS;
  private index!: WorkIndex;
  private indexRefreshBatcher!: PathRefreshBatcher;
  private rootWorkspace!: RootWorkspaceService;
  private pendingRootMove: PendingRootMove | null = null;
  private setupPrompt: Promise<boolean> | null = null;
  private activeDomainMutations = 0;
  private settingsWrite: Promise<void> = Promise.resolve();
  tagCatalog!: TagCatalogService;
  appearance!: AppearanceStore;
  workspaceLifecycle!: WorkspaceLifecycle;
  private lifecycleWriter!: ObsidianLifecycleWriter;
  private mutationTail: Promise<unknown> = Promise.resolve();
  listTags = (): string[] => [...new Set(this.index.getSnapshot().entities.flatMap((entity) => entity.type === 'sprint' ? entity.lifecycle === 'closed' ? entity.closeSnapshot.effectiveTagSummary.map((entry) => entry.tag) : [] : entity.effectiveTags))];
  listCurrentTagUsage = (): Readonly<Record<string, number>> => currentNativeTagUsage(this.index.getSnapshot().entities);

  async onload(): Promise<void> {
    await this.initializeCore();
    const { noteOpener, creation, triage, missionCreator, rankWriter, reorder } = this.createWorkServices();
    const sprintPlanning = new SprintPlanningService({
      writer: new ObsidianSprintPlanningWriter(
        this.app.vault,
        this.app.fileManager,
        () => this.settings.rootFolder,
      ),
      index: this.index,
      hasher: new WebCryptoContentHasher(),
      nextId: uuidv7,
      clock: {
        now: () => new Date().toISOString(),
        today: () => localIsoDate(new Date()),
      },
      getFirstWeekday: () => this.settings.firstWeekday,
      getScopePolicy: () => this.settings.wip.sprintScope,
    });
    const activeStoryMembership = new ActiveStoryMembershipService(
      new ObsidianActiveStoryMembershipWriter(
        this.app.vault,
        this.app.fileManager,
      ),
      this.index,
      () => this.settings.wip.sprintScope,
    );
    const retrospectiveTemplate = new ObsidianTextTemplateReader(
      this.app.vault,
      () => this.settings.templates.retrospective,
      STANDARD_BODY_TEMPLATES.retrospective,
    );
    const legacySprintCloseWriter = new ObsidianSprintCloseWriter(
      this.app.vault,
      this.app.fileManager,
      () => this.settings.rootFolder,
      () => retrospectiveTemplate.read(),
    );
    this.lifecycleWriter = new ObsidianLifecycleWriter(
      new ObsidianManagedStore(
        this.app.vault,
        () => this.settings.rootFolder,
      ),
      uuidv7,
      () => retrospectiveTemplate.read(),
      (plan) => legacySprintCloseWriter.apply(plan),
    );
    this.workspaceLifecycle = {
      previewArchive: async () => { await this.index.refresh(); return this.lifecycleWriter.previewArchive(); },
      organize: (preview) => this.runDomainMutation(async () => { await this.lifecycleWriter.organize(preview); await this.index.refresh(); }, true),
      previewReopen: (id) => this.lifecycleWriter.previewReopen(id),
      reopen: (id) => this.runDomainMutation(async () => { await this.lifecycleWriter.reopen(id); await this.index.refresh(); }, true),
    };
    const epicFinalization = new EpicFinalizationService(
      { apply: (plan) => this.lifecycleWriter.finalizeEpic(plan) },
      this.index,
      () => new Date().toISOString(),
    );
    const focusBoard = new FocusBoardService(
      { move: (plan) => plan.replacementLifecycle === 'done' || plan.expectedLifecycle === 'done'
        ? this.lifecycleWriter.moveTask(plan)
        : new ObsidianTaskMovementWriter(this.app.vault, this.app.fileManager).move(plan) },
      this.index,
      () => new Date().toISOString(),
      () => ({
        tomorrow: this.settings.wip.tomorrow,
        today: this.settings.wip.today,
        inProgress: this.settings.wip.inProgress,
      }),
    );
    const storyEvaluation = new StoryEvaluationService(
      new ObsidianStoryEvaluationWriter(this.app.vault, this.app.fileManager),
      this.index,
      () => new Date().toISOString(),
    );
    const sprintClose = new SprintCloseService({ writer: { apply: (plan) => this.lifecycleWriter.close(plan) }, index: this.index, hasher: new WebCryptoContentHasher(), nextId: uuidv7, now: () => new Date().toISOString() });
    const monthBacklog = new MonthBacklogService(this.index, (plan) => setObsidianMonthMembership(this.app.vault, this.app.fileManager, this.settings.rootFolder, plan));
    const deletion = new WorkDeletionService(this.index, new ObsidianWorkTrash(this.app.vault, this.app.fileManager, () => this.settings.rootFolder));
    const workflow = this.createWorkflow({ creation, triage, missionCreator, focusBoard, reorder, sprintPlanning, activeStoryMembership, epicFinalization, storyEvaluation, sprintClose, monthBacklog, deletion });
    const repairService = this.createRepairService(rankWriter);

    this.registerFocusFlowView({ repairService, workflow, noteOpener, creation });
    this.registerCommands(creation, noteOpener);
    this.registerIndexRefresh();
  }

  private async initializeCore() {
    const persistedSettings: unknown = await this.loadData();
    this.settings = normalizeSettings(persistedSettings);
    this.appearance = new AppearanceStore(
      this.settings.appearance.accent,
      (accent) => this.updateSettings((current) => ({
        ...current,
        appearance: { accent },
      })),
    );
    this.pendingRootMove = parsePendingRootMove(persistedSettings);
    this.tagCatalog = new TagCatalogService(new ObsidianTagCatalogStore(this.app.vault, () => this.settings.rootFolder));
    const repository = new ObsidianWorkNoteSourceRepository(this.app.vault, this.app.metadataCache, () => this.settings.rootFolder);
    this.index = new WorkIndex(repository, { getWipPolicies: () => this.settings.wip });
    this.rootWorkspace = new RootWorkspaceService(
      new ObsidianRootWorkspaceStorage(this.app.vault, this.app.fileManager, this.app.metadataCache),
      () => ({ settings: this.settings, pendingRootMove: this.pendingRootMove }),
      (state) => this.saveRootWorkspaceState(state),
    );
    this.indexRefreshBatcher = new PathRefreshBatcher((paths) => { void this.index.refreshPaths(paths); });
  }

  private createWorkServices() {
    const noteOpener = new ObsidianNoteOpener(this.app.workspace, this.app.vault);
    const creation = new WorkCreationService({
      writer: new ObsidianWorkCreator(this.app.vault, () => this.settings.rootFolder),
      index: this.index,
      templates: new ObsidianTemplateRenderer(this.app.vault, (kind) => this.settings.templates[kind]),
      nextId: uuidv7,
      now: () => new Date().toISOString(),
      getScopePolicy: () => this.settings.wip.sprintScope,
      getLocalDate: () => localIsoDate(new Date()),
    });
    const triage = new CandidateTriageService(
      new ObsidianCandidateTriageWriter(this.app.vault, this.app.fileManager, () => this.settings.rootFolder),
      this.index,
      () => new Date().toISOString(),
    );
    const missionCreator = new ObsidianMissionCreator(this.app.vault, noteOpener, () => this.settings.rootFolder);
    const rankWriter = new ObsidianRankWriter(this.app.vault, this.app.fileManager);
    const reorder = new PlanningReorderService(rankWriter, this.index);
    return { noteOpener, creation, triage, missionCreator, rankWriter, reorder };
  }

  private registerFocusFlowView({ repairService, workflow, noteOpener, creation }: { repairService: DiagnosticRepairService; workflow: ReturnType<FocusFlowPlugin['createWorkflow']>; noteOpener: ObsidianNoteOpener; creation: WorkCreationService }) {
    this.registerView(
      FOCUS_FLOW_VIEW_TYPE,
      (leaf) => new FocusFlowView(leaf, {
        index: this.index,
        repairService: { execute: (plan) => this.runDomainMutation(() => repairService.execute(plan)) },
        workflow,
        noteOpener,
        getPlanningConfiguration: () => ({ sprintScopePolicy: this.settings.wip.sprintScope, today: localIsoDate(new Date()) }),
        ensureWorkspaceReady: () => this.ensureWorkspaceReady(),
        settingsController: {
          appearance: this.appearance,
          getSettings: () => this.settings,
          tagCatalog: this.tagCatalog,
          lifecycle: this.workspaceLifecycle,
          listTags: this.listTags,
          listCurrentTagUsage: this.listCurrentTagUsage,
          updateSettings: (update) => this.updateSettings(update),
          requestRootSetup: (root) => this.requestRootSetup(root),
          selectExistingRoot: (root) => this.selectExistingRoot(root),
          requestRootMove: (root, confirmed) => this.requestRootMove(root, confirmed),
          requestResumeRootMove: () => this.requestResumeRootMove(),
          hasPendingRootMove: () => this.hasPendingRootMove(),
          listFolders: () => this.app.vault.getAllFolders().map((folder) => folder.path),
          listTemplateFiles: () => this.app.vault.getMarkdownFiles().map((file) => file.path),
        },
        openCapture: () => void this.openCandidateCapture(creation, noteOpener),
      }),
    );
  }

  private registerCommands(creation: WorkCreationService, noteOpener: ObsidianNoteOpener) {
    this.addSettingTab(new FocusFlowSettingTab(this));
    this.addRibbonIcon('goal', 'Open focus', () => { void this.openMode('focus'); });
    this.addCommand({
      id: 'refresh-notes',
      name: 'Refresh notes',
      callback: () => { void this.ensureWorkspaceReady().then(async (ready) => { if (ready) await this.index.refresh(); }); },
    });
    this.addCommand({
      id: 'capture-candidate',
      name: 'Capture candidate',
      callback: () => { void this.openCandidateCapture(creation, noteOpener); },
    });
    for (const command of MODE_COMMANDS) {
      this.addCommand({ id: `open-${command.mode}`, name: command.name, callback: () => { void this.openMode(command.mode); } });
    }
  }

  private registerIndexRefresh() {
    const refreshWhenManaged = (file: TAbstractFile): void => {
      if (file.path === `${this.settings.rootFolder}/TAGS.md`) void this.tagCatalog.refresh();
      if (isManagedIndexPath(file.path, this.settings.rootFolder)) this.indexRefreshBatcher.schedule(file.path);
    };
    this.registerEvent(this.app.vault.on('create', refreshWhenManaged));
    this.registerEvent(this.app.vault.on('modify', refreshWhenManaged));
    this.registerEvent(this.app.vault.on('delete', refreshWhenManaged));
    this.registerEvent(this.app.metadataCache.on('changed', refreshWhenManaged));
    this.registerEvent(this.app.vault.on('rename', (file, oldPath) => this.refreshRenamedManagedFile(file, oldPath)));
    this.register(() => this.indexRefreshBatcher.dispose());
    this.app.workspace.onLayoutReady(() => {
      if (this.settings.setupCompleted && this.pendingRootMove === null) void this.index.refresh();
    });
  }

  private refreshRenamedManagedFile(file: TAbstractFile, oldPath: string) {
    if ([file.path, oldPath].includes(`${this.settings.rootFolder}/TAGS.md`)) void this.tagCatalog.refresh();
    if (isManagedIndexPath(file.path, this.settings.rootFolder) || isManagedIndexPath(oldPath, this.settings.rootFolder)) this.indexRefreshBatcher.schedule(file.path, oldPath);
  }

  private createRepairService(rankWriter: ObsidianRankWriter) {
    return new DiagnosticRepairService({
      parentLinks: new ParentLinkRepairService(
        new ObsidianParentLinkWriter(this.app.vault, this.app.fileManager),
        this.index,
      ),
      ranks: new RankRepairService(
        rankWriter,
        this.index,
      ),
      placements: new NotePlacementRepairService(
        new ObsidianNoteMover(
          this.app.vault,
          { processFrontMatter: (file, mutate) => this.app.fileManager.processFrontMatter(file, mutate), renameFile: (file, destination) => destination.includes('/Archive/') ? this.lifecycleWriter.renameWork(file.path, destination) : this.app.fileManager.renameFile(file, destination) },
          () => this.settings.rootFolder,
        ),
        this.index,
      ),
      keys: new KeyRepairService(
        new ObsidianKeyRepairWriter(this.app.vault, this.app.fileManager),
        this.index,
      ),
      ids: new IdRepairService(
        new ObsidianIdRepairWriter(this.app.vault, this.app.fileManager),
        this.index,
        uuidv7,
      ),
      tagCatalog: new CatalogTagRepairService(this.index, this.tagCatalog),
    });
  }

  private createWorkflow(services: { creation: WorkCreationService; triage: CandidateTriageService; missionCreator: ObsidianMissionCreator; focusBoard: FocusBoardService; reorder: PlanningReorderService; sprintPlanning: SprintPlanningService; activeStoryMembership: ActiveStoryMembershipService; epicFinalization: EpicFinalizationService; storyEvaluation: StoryEvaluationService; sprintClose: SprintCloseService; monthBacklog: MonthBacklogService; deletion: WorkDeletionService }) {
    const { creation, triage, missionCreator, focusBoard, reorder, sprintPlanning, activeStoryMembership, epicFinalization, storyEvaluation, sprintClose, monthBacklog, deletion } = services;
    return {
  previewDeleteWork: (id: string) => deletion.preview(id),
  deleteWork: (preview: WorkDeletionPreview) => this.runDomainMutation(() => deletion.confirm(preview)),
  setMonthMembership: (storyId: string, selected: boolean) => this.runDomainMutation(() => monthBacklog.setSelected(storyId, selected)),
  captureCandidate: (title: string, tags: readonly string[] = [], bodyFields?: import('./application/work/work-body-fields').WorkBodyFields) =>
    this.runDomainMutation(() => creation.captureCandidate(title, tags, bodyFields)),
  acceptCandidateAsEpic: (candidateId: string, fields?: import('./application/work/triage-candidate').CandidateAcceptanceFields) =>
    this.runDomainMutation(() => triage.acceptAsEpic(candidateId, fields)),
  acceptCandidateAsStory: (candidateId: string, epicId: string, fields?: import('./application/work/triage-candidate').CandidateAcceptanceFields) =>
    this.runDomainMutation(() => triage.acceptAsStory(candidateId, epicId, fields)),
  rejectCandidate: (candidateId: string, reason: string | null) =>
    this.runDomainMutation(() => triage.reject(candidateId, reason)),
  reconsiderCandidate: (candidateId: string) =>
    this.runDomainMutation(() => triage.reconsider(candidateId)),
  deleteDistraction: (candidateId: string) => this.runDomainMutation(() => deleteDistraction(this.index, (note) => trashObsidianDistraction(this.app.vault, this.app.fileManager, this.settings.rootFolder, note), candidateId)),
  editCandidate: (request: EditCandidateRequest) => this.runDomainMutation(() => editCandidate(this.index, (plan) => editObsidianCandidate(this.app.vault, this.app.fileManager, this.settings.rootFolder, plan), request)),
  editOutcome: (request: EditOutcomeRequest) => this.runDomainMutation(() => editOutcome(this.index, (plan) => editObsidianOutcome(this.app.vault, { renameFile: (file, destination) => this.lifecycleWriter.renameWork(file.path, destination) }, this.settings.rootFolder, plan), request)),
  createMission: () =>
    this.runDomainMutation(() => missionCreator.createAndOpen()),
  createTask: (
    storyId: string,
    title: string,
    confirmWipExcess: boolean,
    details?: import('./application/work/create-work').TaskCreationDetails,
  ) =>
    this.runDomainMutation(() =>
      creation.createTask(storyId, title, confirmWipExcess, details),
    ),
  moveTask: (request: Parameters<FocusBoardService['moveTask']>[0]) =>
    this.runDomainMutation(() => focusBoard.moveTask(request)),
  reorder: (entityId: string, targetIndex: number) =>
    this.runDomainMutation(() => reorder.execute(entityId, targetIndex)),
  createDraft: () =>
    this.runDomainMutation(() => sprintPlanning.createDraft()),
  addStoryToDraft: (
    storyId: string,
    position?: Parameters<SprintPlanningService['addStory']>[1],
  ) => this.runDomainMutation(() => sprintPlanning.addStory(storyId, position)),
  removeStoryFromDraft: (
    storyId: string,
    position?: Parameters<SprintPlanningService['removeStory']>[1],
  ) => this.runDomainMutation(() => sprintPlanning.removeStory(storyId, position)),
  cancelDraft: () =>
    this.runDomainMutation(() => sprintPlanning.cancelDraft()),
  startSprint: (confirmScopeExcess: boolean) =>
    this.runDomainMutation(() =>
      sprintPlanning.startDraft(confirmScopeExcess),
    ),
  addStoryToActive: (
    storyId: string,
    position: Parameters<ActiveStoryMembershipService['add']>[1],
    confirmScopeExcess: boolean,
  ) =>
    this.runDomainMutation(() =>
      activeStoryMembership.add(storyId, position, confirmScopeExcess),
    ),
  removeStoryFromActive: (
    storyId: string,
    position: Parameters<ActiveStoryMembershipService['remove']>[1],
  ) =>
    this.runDomainMutation(() =>
      activeStoryMembership.remove(storyId, position),
    ),
  reparentActiveStory: (storyId: string, epicId: string) =>
    this.runDomainMutation(() =>
      activeStoryMembership.reparent(storyId, epicId),
    ),
  completeEpic: (epicId: string) =>
    this.runDomainMutation(() => epicFinalization.complete(epicId)),
  closeEpic: (epicId: string, reason: string | null) =>
    this.runDomainMutation(() => epicFinalization.close(epicId, reason)),
  evaluateStory: (
    request: Parameters<StoryEvaluationService['evaluate']>[0],
  ) => this.runDomainMutation(() => storyEvaluation.evaluate(request)),
  closeSprint: (request: Parameters<SprintCloseService['close']>[0]) =>
    this.runDomainMutation(() => sprintClose.close(request)),
  resumeClose: () =>
    this.runDomainMutation(() => sprintClose.resume(), true),
  promoteImprovement: (text: string, sprintCode: string) =>
    this.runDomainMutation(() =>
      creation.promoteImprovement(text, sprintCode),
    ),
    };
  }


  updateSettings(
    update: (settings: FocusFlowSettings) => FocusFlowSettings,
  ): Promise<void> {
    const operation = this.settingsWrite.then(async () => {
      const previous = this.settings;
      const next = normalizeSettings(update(previous));
      if (next.rootFolder !== previous.rootFolder) {
        throw new Error('Use Select existing root or Move Focus Flow root.');
      }

      await this.saveData(this.persistedData(next, this.pendingRootMove));
      this.settings = next;
      await this.index.refresh();
    });

    this.settingsWrite = operation.catch(() => undefined);
    return operation;
  }

  private async openMode(mode: FocusFlowMode): Promise<void> {
    if (!(await this.ensureWorkspaceReady())) return;
    const existingLeaf = this.app.workspace.getLeavesOfType(
      FOCUS_FLOW_VIEW_TYPE,
    )[0];
    const leaf = existingLeaf ?? this.app.workspace.getLeaf(true);

    await leaf.setViewState({
      type: FOCUS_FLOW_VIEW_TYPE,
      active: true,
      state: { mode },
    });
    await this.app.workspace.revealLeaf(leaf);
  }

  async requestRootSetup(root: string): Promise<void> {
    await this.openRootSetup(root);
  }

  private openRootSetup(root: string): Promise<boolean> {
    return confirmRootSetup(this.app, {
      settings: { ...this.settings, rootFolder: root, templates: remapTemplates(this.settings.templates, this.settings.rootFolder, root) },
      folders: this.app.vault.getAllFolders().map((folder) => folder.path),
      files: this.app.vault.getMarkdownFiles().map((file) => file.path),
      preview: (path, templates) => this.rootWorkspace.previewSetup(path, templates),
      confirm: async (path, templates) => {
        this.assertNoActiveMutation();
        await this.rootWorkspace.confirmSetup(path, templates);
        await this.index.refresh();
      },
    });
  }

  async selectExistingRoot(root: string): Promise<void> {
    this.assertNoActiveMutation();
    await this.rootWorkspace.selectExistingRoot(root);
    await this.index.refresh();
  }

  async requestRootMove(root: string, confirmedInPicker = false): Promise<void> {
    this.assertNoActiveMutation();
    await this.lifecycleWriter.assertNoPending();
    if (
      confirmedInPicker || await confirmRootMove(this.app, this.settings.rootFolder, root.trim())
    ) {
      await this.rootWorkspace.moveRoot(root);
      await this.index.refresh();
    }
  }

  async requestResumeRootMove(): Promise<void> {
    const plan = this.pendingRootMove;
    if (plan === null) throw new Error('No Focus Flow root move is pending.');
    this.assertNoActiveMutation();
    if (
      await confirmResumeRootMove(
        this.app,
        plan.sourceRoot,
        plan.targetRoot,
      )
    ) {
      await this.rootWorkspace.resumeMove();
      await this.index.refresh();
    }
  }

  hasPendingRootMove(): boolean {
    return this.pendingRootMove !== null;
  }

  private async ensureWorkspaceReady(): Promise<boolean> {
    if (this.settings.setupCompleted && this.pendingRootMove === null) return true;
    if (this.setupPrompt !== null) return this.setupPrompt;
    this.setupPrompt = this.promptForWorkspace();
    try {
      return await this.setupPrompt;
    } finally {
      this.setupPrompt = null;
    }
  }

  private async promptForWorkspace(): Promise<boolean> {
    if (this.pendingRootMove !== null) {
      const plan = this.pendingRootMove;
      if (
        !(await confirmResumeRootMove(
          this.app,
          plan.sourceRoot,
          plan.targetRoot,
        ))
      ) {
        return false;
      }
      await this.rootWorkspace.resumeMove();
      await this.index.refresh();
      return true;
    }
    return this.openRootSetup(this.settings.rootFolder);
  }

  private async saveRootWorkspaceState(state: RootWorkspaceState): Promise<void> {
    await this.saveData(this.persistedData(state.settings, state.pendingRootMove));
    this.settings = state.settings;
    this.pendingRootMove = state.pendingRootMove;
  }

  private persistedData(
    settings: FocusFlowSettings,
    pendingRootMove: PendingRootMove | null,
  ): Record<string, unknown> {
    return pendingRootMove === null
      ? { ...settings }
      : { ...settings, pendingRootMove };
  }

  private runDomainMutation<T>(operation: () => Promise<T>, allowRecovery = false): Promise<T> {
    const run = this.mutationTail.then(() => this.applyDomainMutation(operation, allowRecovery));
    this.mutationTail = run.catch(() => undefined);
    return run;
  }

  private async applyDomainMutation<T>(operation: () => Promise<T>, allowRecovery: boolean): Promise<T> {
    if (!(await this.ensureWorkspaceReady())) {
      throw new Error('Focus Flow setup is not complete.');
    }
    if (this.pendingRootMove !== null) {
      throw new Error('Resume the pending Focus Flow root move first.');
    }
    this.activeDomainMutations += 1;
    try {
      if (!allowRecovery) await this.lifecycleWriter.assertNoPending();
      return await operation();
    } finally {
      this.activeDomainMutations -= 1;
    }
  }

  private assertNoActiveMutation(): void {
    if (this.activeDomainMutations !== 0) {
      throw new Error('Wait for the current Focus Flow change to finish.');
    }
  }

  private async openCandidateCapture(
    creation: WorkCreationService,
    noteOpener: ObsidianNoteOpener,
  ): Promise<void> {
    if (!(await this.ensureWorkspaceReady())) return;
    new CandidateCaptureModal(this.app, async (title, tags, bodyFields) => {
      const path = await this.runDomainMutation(() =>
        creation.captureCandidate(title, tags, bodyFields),
      );
      try {
        await this.tagCatalog.ensureAdded(tags);
      } catch {
        new Notice('Candidate saved, but its new tags could not be added to the catalog.');
      }
      await noteOpener.open(path);
    }, [...new Set(this.index.getSnapshot().entities.flatMap((entity) => entity.type === 'sprint' ? [] : entity.tags))], this.tagCatalog).open();
  }

}

function localIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
