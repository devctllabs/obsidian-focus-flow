import type { WorkIndex } from '../../application/indexing/work-index';
import type { EditCandidateRequest } from '../../application/work/edit-candidate';
import type { EditOutcomeRequest } from '../../application/work/edit-outcome';
import type { WorkDeletionPreview } from '../../application/work/delete-work';
import type { DiagnosticRepairService } from '../../application/repairs/repair-diagnostic';
import type { RepairPlan } from '../../domain/work-note';
import type { WipPolicy } from '../../domain/wip-policy';
import type {
  MoveTaskRequest,
  MoveTaskResult,
} from '../../application/focus/focus-board';
import type { CloseSprintRequest } from '../../application/closing/close-sprint';
import type { StoryEvaluationRequest } from '../../application/closing/evaluate-story';
import type { CreateTaskResult } from '../../application/work/create-work';
import type {
  AddActiveStoryResult,
  StoryPosition,
} from '../../application/planning/active-story-membership';
import type { ObsidianNoteOpener } from '../services/ObsidianNoteOpener';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { TagCatalogProvider } from '../../features/ui/TagCatalog';
import {
  FocusFlowShell,
  type FocusFlowMode,
  type FocusFlowShellProps,
} from '../../features/shell/FocusFlowShell';
import type { InboxSection } from './view-state';
import { SettingsSurface, type SettingsController } from '../../features/settings/SettingsSurface';
import { formatErrorMessage } from '../../features/ui/error-message';
import { uncatalogedTagDiagnostics } from '../../application/tags/catalog-diagnostics';
import type { TagCatalog } from '../../domain/tag-catalog';
import { AppearanceProvider } from '../../features/appearance/AppearanceRoot';

const EMPTY_TAG_CATALOG: TagCatalog = { entries: {}, diagnostics: [] };
const subscribeEmptyCatalog = () => () => undefined;
const getEmptyCatalog = () => EMPTY_TAG_CATALOG;

interface FocusFlowRootProps {
  index: Pick<WorkIndex, 'getSnapshot' | 'subscribe'> & Partial<Pick<WorkIndex, 'refresh'>>;
  repairService: Pick<DiagnosticRepairService, 'execute'>;
  mode: FocusFlowMode;
  onModeChange: (mode: FocusFlowMode) => void;
  inboxSection?: InboxSection;
  onInboxSectionChange?: (section: InboxSection) => void;
  workflow?: FocusFlowWorkflow;
  noteOpener?: Pick<ObsidianNoteOpener, 'open'>;
  dragEnabled?: boolean;
  sprintScopePolicy?: WipPolicy;
  today?: string;
  settingsController?: SettingsController;
  onOpenCapture?: () => void;
}

export interface FocusFlowWorkflow {
  previewDeleteWork?: (id: string) => Promise<WorkDeletionPreview>;
  deleteWork?: (preview: WorkDeletionPreview) => Promise<void>;
  captureCandidate(title: string, tags?: readonly string[], bodyFields?: import('../../application/work/work-body-fields').WorkBodyFields): Promise<unknown>;
  acceptCandidateAsEpic(candidateId: string, fields?: import('../../application/work/triage-candidate').CandidateAcceptanceFields): Promise<unknown>;
  acceptCandidateAsStory(candidateId: string, epicId: string, fields?: import('../../application/work/triage-candidate').CandidateAcceptanceFields): Promise<unknown>;
  rejectCandidate(candidateId: string, reason: string | null): Promise<unknown>;
  reconsiderCandidate?(candidateId: string): Promise<unknown>;
  deleteDistraction?(candidateId: string): Promise<unknown>;
  editCandidate?(request: EditCandidateRequest): Promise<unknown>;
  editOutcome?(request: EditOutcomeRequest): Promise<unknown>;
  createMission?(): Promise<unknown>;
  createTask(
    storyId: string,
    title: string,
    confirmWipExcess: boolean,
    details?: import('../../application/work/create-work').TaskCreationDetails,
  ): Promise<CreateTaskResult>;
  moveTask?(request: MoveTaskRequest): Promise<MoveTaskResult>;
  reorder(entityId: string, targetIndex: number): Promise<unknown>;
  createDraft(): Promise<unknown>;
  setMonthMembership?(storyId: string, selected: boolean): Promise<unknown>;
  addStoryToDraft(storyId: string, position?: StoryPosition): Promise<unknown>;
  removeStoryFromDraft(storyId: string, position?: StoryPosition): Promise<unknown>;
  cancelDraft(): Promise<unknown>;
  startSprint(confirmScopeExcess: boolean): Promise<unknown>;
  addStoryToActive(
    storyId: string,
    position: StoryPosition,
    confirmScopeExcess: boolean,
  ): Promise<AddActiveStoryResult>;
  removeStoryFromActive(storyId: string, position: StoryPosition): Promise<unknown>;
  reparentActiveStory(storyId: string, epicId: string): Promise<unknown>;
  completeEpic?(epicId: string): Promise<unknown>;
  closeEpic?(epicId: string, reason: string | null): Promise<unknown>;
  evaluateStory?(request: StoryEvaluationRequest): Promise<unknown>;
  closeSprint?(request: CloseSprintRequest): Promise<unknown>;
  resumeClose?(): Promise<unknown>;
  promoteImprovement?(text: string, sprintCode: string): Promise<unknown>;
}

export function FocusFlowRoot(props: FocusFlowRootProps) {
  const { index, settingsController } = props;
  const snapshot = useSyncExternalStore(
    index.subscribe,
    index.getSnapshot,
    index.getSnapshot,
  );
  const catalog = useTagCatalog(settingsController);
  const indexState = {
    ...snapshot,
    diagnostics: [...snapshot.diagnostics, ...uncatalogedTagDiagnostics(snapshot.entities, catalog)],
  };
  useEffect(() => { void settingsController?.tagCatalog?.refresh(); }, [snapshot, settingsController?.tagCatalog]);
  const runner = useWorkflowRunner();
  const repair = useRepairRunner(props.repairService);
  const refresh = useRefreshRunner(index, runner.setError);
  const catalogAfter = useCatalogAfter(settingsController, runner.setError);
  const resultActions = useResultActions(props.workflow, runner);
  const shellProps = buildShellProps(props, { indexState, runner, repair, refresh, catalogAfter, resultActions });
  return <AppearanceProvider appearance={settingsController?.appearance}><TagCatalogProvider service={settingsController?.tagCatalog}><FocusFlowShell {...shellProps} /></TagCatalogProvider></AppearanceProvider>;
}

function useTagCatalog(settings: SettingsController | undefined) {
  return useSyncExternalStore(
    settings?.tagCatalog?.subscribe ?? subscribeEmptyCatalog,
    settings?.tagCatalog?.getSnapshot ?? getEmptyCatalog,
    settings?.tagCatalog?.getSnapshot ?? getEmptyCatalog,
  );
}

function useWorkflowRunner() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (operation: () => Promise<unknown>, onSuccess?: () => void) => {
    setPending(true);
    setError(null);
    try { await operation(); onSuccess?.(); }
    catch (cause) { setError(formatErrorMessage(cause, 'Focus Flow could not apply the change')); }
    finally { setPending(false); }
  };
  return { pending, error, setPending, setError, run };
}

function useRepairRunner(service: FocusFlowRootProps['repairService']) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (plan: RepairPlan) => {
    setPending(true); setError(null);
    try { await service.execute(plan); }
    catch (cause) { setError(formatErrorMessage(cause, 'Focus Flow could not apply the repair')); }
    finally { setPending(false); }
  };
  return { pending, error, run };
}

function useRefreshRunner(index: FocusFlowRootProps['index'], setError: (error: string | null) => void) {
  const [pending, setPending] = useState(false);
  const run = async () => {
    if (pending) return;
    setPending(true);
    try { await index.refresh?.(); }
    catch (cause) { setError(formatErrorMessage(cause, 'Could not refresh notes. Try Refresh again.')); }
    finally { setPending(false); }
  };
  return { pending, run };
}

type CatalogAfter = <Result>(operation: () => Promise<Result>, tags: readonly string[], previousTags?: readonly string[], wasSaved?: (result: Result) => boolean) => Promise<Result>;

function useCatalogAfter(settings: SettingsController | undefined, setError: (error: string | null) => void): CatalogAfter {
  return async (operation, tags, previousTags = [], wasSaved = () => true) => {
    const result = await operation();
    if (!wasSaved(result)) return result;
    try { await settings?.tagCatalog?.ensureAdded(tags, previousTags); }
    catch (cause) {
      const detail = formatErrorMessage(cause, 'Check TAGS.md and try again.');
      setError(`Work was saved, but its new tags could not be added to the catalog. ${detail}`);
    }
    return result;
  };
}

type WorkflowRunner = ReturnType<typeof useWorkflowRunner>;

function useResultActions(workflow: FocusFlowWorkflow | undefined, runner: WorkflowRunner) {
  const moveTask = async (request: MoveTaskRequest): Promise<MoveTaskResult> => {
    if (!workflow?.moveTask) return { kind: 'rejected', message: 'Task movement is unavailable.' };
    return runResult(() => workflow.moveTask!(request), runner, true);
  };
  const createTask: FocusFlowWorkflow['createTask'] = async (...args) => {
    if (!workflow) return { kind: 'rejected', message: 'Task creation is unavailable.' };
    try { return await runResult(() => workflow.createTask(...args), runner, false); }
    catch (cause) {
      const message = formatErrorMessage(cause, 'Focus Flow could not create the Task');
      runner.setError(message);
      return { kind: 'rejected', message };
    }
  };
  const addStoryToActive: FocusFlowWorkflow['addStoryToActive'] = async (...args) => {
    if (!workflow) return { kind: 'rejected', message: 'Story membership is unavailable.' };
    try { return await runResult(() => workflow.addStoryToActive(...args), runner, false); }
    catch (cause) {
      const message = formatErrorMessage(cause, 'Focus Flow could not add the Story');
      runner.setError(message);
      return { kind: 'rejected', message };
    }
  };
  return { moveTask, createTask, addStoryToActive };
}

async function runResult<Result>(operation: () => Promise<Result>, runner: WorkflowRunner, rethrow: boolean): Promise<Result> {
  runner.setPending(true); runner.setError(null);
  try { return await operation(); }
  catch (cause) {
    runner.setError(formatErrorMessage(cause, 'Focus Flow could not apply the change'));
    if (rethrow) throw cause;
    throw cause;
  } finally { runner.setPending(false); }
}

interface ShellBuildContext {
  indexState: FocusFlowShellProps['indexState'];
  runner: WorkflowRunner;
  repair: ReturnType<typeof useRepairRunner>;
  refresh: ReturnType<typeof useRefreshRunner>;
  catalogAfter: CatalogAfter;
  resultActions: ReturnType<typeof useResultActions>;
}

function buildShellProps(props: FocusFlowRootProps, context: ShellBuildContext): FocusFlowShellProps {
  const settings = props.settingsController;
  return {
    mode: props.mode,
    onModeChange: props.onModeChange,
    inboxSection: props.inboxSection,
    onInboxSectionChange: props.onInboxSectionChange,
    onOpenCapture: props.onOpenCapture ?? (() => props.onModeChange('inbox')),
    indexState: context.indexState,
    dragEnabled: props.dragEnabled ?? false,
    sprintScopePolicy: props.sprintScopePolicy,
    today: props.today,
    lifecycle: settings?.lifecycle,
    firstWeekday: settings?.getSettings().firstWeekday,
    settingsSurface: settings ? <SettingsSurface controller={settings} /> : undefined,
    onRefresh: props.index.refresh ? () => void context.refresh.run() : undefined,
    refreshing: context.refresh.pending,
    onRepairDiagnostic: (plan) => void context.repair.run(plan),
    repairing: context.repair.pending,
    repairError: context.repair.error,
    workflowPending: context.runner.pending,
    workflowError: context.runner.error,
    onOpenNote: props.noteOpener ? (path, event) => void props.noteOpener!.open(path, event) : undefined,
    ...candidateBindings(props.workflow, context),
    ...planningBindings(props.workflow, context),
    ...closingBindings(props.workflow, context, props.onModeChange),
  };
}

function candidateBindings(workflow: FocusFlowWorkflow | undefined, context: ShellBuildContext): Partial<FocusFlowShellProps> {
  if (!workflow) return {};
  const bindings: Partial<FocusFlowShellProps> = {
    onPreviewDelete: workflow.previewDeleteWork,
    onDeleteWork: workflow.deleteWork,
    onAcceptCandidateAsEpic: (id, fields) => context.catalogAfter(() => workflow.acceptCandidateAsEpic(id, fields), fields?.tags ?? [], fields?.expected.tags ?? []),
    onAcceptCandidateAsStory: (id, epicId, fields) => context.catalogAfter(() => workflow.acceptCandidateAsStory(id, epicId, fields), fields?.tags ?? [], fields?.expected.tags ?? []),
    onRejectCandidate: (id, reason) => void context.runner.run(() => workflow.rejectCandidate(id, reason)),
    onCreateTask: (storyId, title, confirm, details) => context.catalogAfter(() => context.resultActions.createTask(storyId, title, confirm, details), details?.tags ?? [], [], (result) => result.kind === 'created'),
  };
  if (workflow.reconsiderCandidate) bindings.onReconsiderCandidate = (id) => void context.runner.run(() => workflow.reconsiderCandidate!(id));
  if (workflow.deleteDistraction) bindings.onDeleteDistraction = (id) => workflow.deleteDistraction!(id);
  if (workflow.editCandidate) bindings.onEditCandidate = (request) => context.catalogAfter(() => workflow.editCandidate!(request), request.tags, request.expectedTags);
  if (workflow.editOutcome) bindings.onEditOutcome = (request) => context.catalogAfter(() => workflow.editOutcome!(request), request.tags, request.expected.tags);
  if (workflow.createMission) bindings.onCreateMission = () => void context.runner.run(() => workflow.createMission!());
  return bindings;
}

function planningBindings(workflow: FocusFlowWorkflow | undefined, context: ShellBuildContext): Partial<FocusFlowShellProps> {
  if (!workflow) return {};
  const run = context.runner.run;
  const bindings: Partial<FocusFlowShellProps> = {
    onMoveTask: workflow.moveTask ? context.resultActions.moveTask : undefined,
    onReorder: (id, index) => void run(() => workflow.reorder(id, index)),
    onCreateDraft: () => void run(() => workflow.createDraft()),
    onAddStoryToDraft: (id, position) => void run(() => workflow.addStoryToDraft(id, position)),
    onRemoveStoryFromDraft: (id, position) => void run(() => workflow.removeStoryFromDraft(id, position)),
    onCancelDraft: () => void run(() => workflow.cancelDraft()),
    onStartSprint: (confirm) => void run(() => workflow.startSprint(confirm)),
    onAddStoryToActive: context.resultActions.addStoryToActive,
    onRemoveStoryFromActive: (id, position) => void run(() => workflow.removeStoryFromActive(id, position)),
    onReparentActiveStory: (id, epicId) => void run(() => workflow.reparentActiveStory(id, epicId)),
  };
  if (workflow.setMonthMembership) bindings.onSetMonthMembership = (id, selected) => void run(() => workflow.setMonthMembership!(id, selected));
  if (workflow.completeEpic) bindings.onCompleteEpic = (id) => void run(() => workflow.completeEpic!(id));
  if (workflow.closeEpic) bindings.onCloseEpic = (id, reason) => void run(() => workflow.closeEpic!(id, reason));
  return bindings;
}

function closingBindings(workflow: FocusFlowWorkflow | undefined, context: ShellBuildContext, onModeChange: FocusFlowRootProps['onModeChange']): Partial<FocusFlowShellProps> {
  if (!workflow) return {};
  const bindings: Partial<FocusFlowShellProps> = {};
  if (workflow.evaluateStory) bindings.onEvaluateStory = (request) => void context.runner.run(() => workflow.evaluateStory!(request));
  if (workflow.closeSprint) bindings.onCloseSprint = (request) => void context.runner.run(() => workflow.closeSprint!(request), () => onModeChange('history'));
  if (workflow.resumeClose) bindings.onResumeClose = () => void context.runner.run(() => workflow.resumeClose!(), () => onModeChange('history'));
  if (workflow.promoteImprovement) bindings.onPromoteImprovement = (text, code) => void context.runner.run(() => workflow.promoteImprovement!(text, code));
  return bindings;
}
