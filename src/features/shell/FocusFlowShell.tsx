import type {
  RepairPlan,
  WorkNoteDiagnostic,
} from '../../domain/work-note';
import type { ProjectedManagedEntity } from '../../application/indexing/work-index';
import type { EditCandidateRequest } from '../../application/work/edit-candidate';
import type { EditOutcomeRequest } from '../../application/work/edit-outcome';
import type { DeletableWork, WorkDeletionPreview } from '../../application/work/delete-work';
import { DeleteWorkDialog } from '../work/DeleteWorkDialog';
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
import { InboxView } from '../inbox/InboxView';
import { FocusView } from '../focus/FocusView';
import { PlanView } from '../plan/PlanView';
import { SprintClosePanel } from '../close/SprintClosePanel';
import { HistoryView } from '../history/HistoryView';
import type { WorkspaceLifecycle } from '../../application/workspace/workspace-lifecycle';
import type { FocusFlowSettings } from '../../settings';
import { DialogSurface } from '../ui/DialogSurface';
import { PageMenu } from './PageMenu';
import { AttentionIcon, RefreshIcon } from '../ui/Icons';
import { useState, type ReactNode } from 'react';
import type { InboxSection } from '../../obsidian/views/view-state';
import { accentAttributes, useAccentPreference } from '../appearance/AppearanceRoot';

export type FocusFlowMode =
  | 'focus'
  | 'plan'
  | 'inbox'
  | 'history'
  | 'settings'
  | 'close';

export interface FocusFlowShellProps {
  onPreviewDelete?: (id: string) => Promise<WorkDeletionPreview>;
  onDeleteWork?: (preview: WorkDeletionPreview) => Promise<void>;
  onRefresh?: () => void;
  refreshing?: boolean;
  mode: FocusFlowMode;
  onModeChange: (mode: FocusFlowMode) => void;
  inboxSection?: InboxSection;
  onInboxSectionChange?: (section: InboxSection) => void;
  onRepairDiagnostic?: (plan: RepairPlan) => void;
  repairing?: boolean;
  repairError?: string | null;
  indexState?: FocusFlowIndexState;
  onAcceptCandidateAsEpic?: (candidateId: string, fields?: import('../../application/work/triage-candidate').CandidateAcceptanceFields) => void | Promise<unknown>;
  onAcceptCandidateAsStory?: (candidateId: string, epicId: string, fields?: import('../../application/work/triage-candidate').CandidateAcceptanceFields) => void | Promise<unknown>;
  onRejectCandidate?: (candidateId: string, reason: string | null) => void;
  onReconsiderCandidate?: (candidateId: string) => void;
  onDeleteDistraction?: (candidateId: string) => Promise<unknown>;
  onEditCandidate?: (request: EditCandidateRequest) => Promise<unknown>;
  onEditOutcome?: (request: EditOutcomeRequest) => Promise<unknown>;
  onCreateMission?: () => void;
  onOpenCapture?: () => void;
  onOpenNote?: (path: string, event: MouseEvent) => void;
  onCreateTask?: (
    storyId: string,
    title: string,
    confirmWipExcess: boolean,
    details?: import('../../application/work/create-work').TaskCreationDetails,
  ) => Promise<CreateTaskResult>;
  onMoveTask?: (request: MoveTaskRequest) => Promise<MoveTaskResult>;
  onReorder?: (entityId: string, targetIndex: number) => void;
  onCreateDraft?: () => void;
  onSetMonthMembership?: (storyId: string, selected: boolean) => void;
  onAddStoryToDraft?: (storyId: string, position?: StoryPosition) => void;
  onRemoveStoryFromDraft?: (storyId: string, position?: StoryPosition) => void;
  onCancelDraft?: () => void;
  onStartSprint?: (confirmScopeExcess: boolean) => void;
  onAddStoryToActive?: (
    storyId: string,
    position: StoryPosition,
    confirmScopeExcess: boolean,
  ) => Promise<AddActiveStoryResult>;
  onRemoveStoryFromActive?: (storyId: string, position: StoryPosition) => void;
  onReparentActiveStory?: (storyId: string, epicId: string) => void;
  onCompleteEpic?: (epicId: string) => void;
  onCloseEpic?: (epicId: string, reason: string | null) => void;
  onEvaluateStory?: (request: StoryEvaluationRequest) => void;
  onCloseSprint?: (request: CloseSprintRequest) => void;
  onResumeClose?: () => void;
  onPromoteImprovement?: (text: string, sprintPath: string) => void;
  sprintScopePolicy?: WipPolicy;
  today?: string;
  firstWeekday?: FocusFlowSettings['firstWeekday'];
  lifecycle?: WorkspaceLifecycle;
  workflowPending?: boolean;
  workflowError?: string | null;
  dragEnabled?: boolean;
  settingsSurface?: ReactNode;
}

interface FocusFlowIndexState {
  phase: 'loading' | 'ready' | 'error';
  entities?: readonly ProjectedManagedEntity[];
  diagnostics: readonly WorkNoteDiagnostic[];
  errorMessage?: string;
}

const EMPTY_INDEX_STATE: FocusFlowIndexState = {
  phase: 'ready',
  diagnostics: [],
};

function repairAction(plan: RepairPlan, repairing: boolean) {
  return repairing ? pendingRepairAction(plan) : readyRepairAction(plan);
}

function pendingRepairAction(plan: RepairPlan) {
  if (plan.kind === 'catalog-tag') return { accessibleName: `Adding #${plan.tag} to catalog`, label: 'Adding…' };
  if (plan.kind === 'move-note') return { accessibleName: 'Moving note', label: 'Moving…' };
  if (plan.kind === 'repair-duplicate-keys') return { accessibleName: 'Repairing duplicate keys', label: 'Repairing…' };
  if (plan.kind === 'repair-duplicate-ids') return { accessibleName: 'Repairing duplicate UUIDs', label: 'Repairing…' };
  if (plan.kind === 'replace-parent-link') return { accessibleName: 'Repairing parent link', label: 'Repairing…' };
  return { accessibleName: 'Rebalancing ranks', label: 'Rebalancing…' };
}

function readyRepairAction(plan: RepairPlan) {
  if (plan.kind === 'catalog-tag') return { accessibleName: `Add #${plan.tag} to catalog`, label: 'Add to catalog' };
  if (plan.kind === 'move-note') return { accessibleName: `Move note to ${plan.targetFolder}`, label: `Move to ${plan.targetFolder}` };
  if (plan.kind === 'repair-duplicate-keys') return { accessibleName: 'Repair duplicate keys', label: 'Repair duplicate keys' };
  if (plan.kind === 'repair-duplicate-ids') return { accessibleName: 'Repair duplicate UUIDs', label: 'Repair duplicate UUIDs' };
  if (plan.kind === 'replace-parent-link') return { accessibleName: `Repair parent link for ${plan.path}`, label: 'Repair parent link' };
  return { accessibleName: `Rebalance ranks for ${plan.collectionLabel}`, label: 'Rebalance ranks' };
}

export function FocusFlowShell(props: FocusFlowShellProps) {
  const [attentionOpen, setAttentionOpen] = useState(false);
  const [deleting, setDeleting] = useState<DeletableWork | null>(null);
  const indexState = props.indexState ?? EMPTY_INDEX_STATE;
  const missionMissing = indexState.diagnostics.some((diagnostic) => diagnostic.code === 'missing-mission');
  const attentionDiagnostics = indexState.diagnostics.filter((diagnostic) => diagnostic.code !== 'missing-mission');
  const inboxCount = (indexState.entities ?? []).filter((entity) => entity.type === 'candidate' && entity.lifecycle === 'inbox').length;
  const onRequestDelete = props.onPreviewDelete && props.onDeleteWork ? setDeleting : undefined;
  const accent = useAccentPreference();
  return (
    <main className="focus-flow" {...accentAttributes(accent)}>
      <ShellHeader {...props} attentionCount={attentionDiagnostics.length} attentionOpen={attentionOpen} inboxCount={inboxCount} onOpenAttention={() => setAttentionOpen(true)} />
      <ShellAlerts indexState={indexState} repairError={props.repairError} workflowError={props.workflowError} />
      <AttentionCenter diagnostics={attentionDiagnostics} onClose={() => setAttentionOpen(false)} onRepair={props.onRepairDiagnostic} open={attentionOpen} repairing={props.repairing ?? false} />
      <ModeContent {...props} indexState={indexState} missionMissing={missionMissing} onRequestDelete={onRequestDelete} />
      {deleting && props.onPreviewDelete && props.onDeleteWork && <DeleteWorkDialog item={deleting} onPreview={props.onPreviewDelete} onDelete={props.onDeleteWork} onOpenNote={props.onOpenNote} onClose={() => setDeleting(null)} />}
    </main>
  );
}

function ShellHeader(props: FocusFlowShellProps & { attentionCount: number; attentionOpen: boolean; inboxCount: number; onOpenAttention: () => void }) {
  const refreshing = props.refreshing ?? false;
  return <header className="focus-flow__header">
    <PageMenu inboxCount={props.inboxCount} mode={props.mode} onCapture={props.onOpenCapture} onModeChange={props.onModeChange} />
    {props.onRefresh && <button className="focus-flow__icon-button focus-flow__refresh" type="button" disabled={refreshing || props.workflowPending} aria-busy={refreshing} aria-label={refreshing ? 'Refreshing notes…' : 'Refresh notes'} title={refreshing ? 'Refreshing notes…' : 'Refresh notes'} onClick={props.onRefresh}><RefreshIcon /></button>}
    {props.attentionCount > 0 && <button aria-expanded={props.attentionOpen} aria-label={`${props.attentionCount} notes need attention`} className="focus-flow__attention-trigger" onClick={props.onOpenAttention} type="button"><AttentionIcon /><span>{props.attentionCount}</span></button>}
  </header>;
}

function ShellAlerts({ indexState, repairError, workflowError }: { indexState: FocusFlowIndexState; repairError?: string | null; workflowError?: string | null }) {
  return <>
    {indexState.phase === 'error' && indexState.errorMessage && <p className="focus-flow__read-error" role="alert">{indexState.errorMessage}</p>}
    {repairError && <p className="focus-flow__repair-error" role="alert">{repairError}</p>}
    {workflowError && <p className="focus-flow__mutation-error" role="alert">{workflowError}</p>}
  </>;
}

function AttentionCenter({ diagnostics, onClose, onRepair, open, repairing }: { diagnostics: readonly WorkNoteDiagnostic[]; onClose: () => void; onRepair?: (plan: RepairPlan) => void; open: boolean; repairing: boolean }) {
  if (!open || diagnostics.length === 0) return null;
  return <DialogSurface title="Attention center" description={`${diagnostics.length} notes need a closer look.`} onClose={onClose}><div className="focus-flow__attention-sheet"><ol>{diagnostics.map((diagnostic) => <DiagnosticItem diagnostic={diagnostic} key={`${diagnostic.code}:${diagnostic.path}`} onRepair={onRepair} repairing={repairing} />)}</ol></div></DialogSurface>;
}

function DiagnosticItem({ diagnostic, onRepair, repairing }: { diagnostic: WorkNoteDiagnostic; onRepair?: (plan: RepairPlan) => void; repairing: boolean }) {
  const action = diagnostic.repair ? repairAction(diagnostic.repair, repairing) : null;
  return <li><span className="focus-flow__diagnostic-path">{diagnostic.path}</span><p>{diagnostic.message}</p>{diagnostic.repair && onRepair && action && <button aria-label={action.accessibleName} disabled={repairing} onClick={() => onRepair(diagnostic.repair!)} type="button">{action.label}</button>}</li>;
}

type ModeContentProps = FocusFlowShellProps & { indexState: FocusFlowIndexState; missionMissing: boolean; onRequestDelete?: (item: DeletableWork) => void };

function ModeContent(props: ModeContentProps) {
  if (props.indexState.phase === 'loading') return <section className="focus-flow__empty-state" aria-live="polite"><h1>Loading Focus Flow</h1><p>Reading managed notes from the vault.</p></section>;
  if (props.mode === 'focus') return <FocusMode {...props} />;
  if (props.mode === 'plan') return <PlanMode {...props} />;
  if (props.mode === 'inbox') return <InboxMode {...props} />;
  if (props.mode === 'close') return <CloseMode {...props} />;
  if (props.mode === 'settings') return <section className="focus-flow__mode focus-flow__settings-page"><header className="focus-flow__page-heading"><div><h1>Settings</h1></div></header>{props.settingsSurface ?? <p>Open Obsidian Settings to configure Focus Flow.</p>}</section>;
  return <HistoryView lifecycle={props.lifecycle} entities={props.indexState.entities ?? []} onOpenNote={props.onOpenNote} onPromoteImprovement={props.onPromoteImprovement} />;
}

function FocusMode(props: ModeContentProps) {
  return <FocusView onRequestDelete={props.onRequestDelete} onEditOutcome={props.onEditOutcome} onPlan={() => props.onModeChange('plan')} onReviewSprint={() => props.onModeChange('close')} dragEnabled={props.dragEnabled ?? false} entities={props.indexState.entities ?? []} onMoveTask={props.onMoveTask} onOpenNote={props.onOpenNote} onCreateTask={props.onCreateTask} pending={props.workflowPending ?? false} />;
}

function PlanMode(props: ModeContentProps) {
  return <PlanView onRequestDelete={props.onRequestDelete} onEditOutcome={props.onEditOutcome} entities={props.indexState.entities ?? []} onOpenNote={props.onOpenNote} onCreateTask={props.onCreateTask} onReorder={props.onReorder} onCreateDraft={props.onCreateDraft} onSetMonthMembership={props.onSetMonthMembership} onAddStoryToDraft={props.onAddStoryToDraft} onRemoveStoryFromDraft={props.onRemoveStoryFromDraft} onCancelDraft={props.onCancelDraft} onStartSprint={props.onStartSprint} onAddStoryToActive={props.onAddStoryToActive} onRemoveStoryFromActive={props.onRemoveStoryFromActive} onReparentActiveStory={props.onReparentActiveStory} onCompleteEpic={props.onCompleteEpic} onCloseEpic={props.onCloseEpic} sprintScopePolicy={props.sprintScopePolicy} today={props.today} firstWeekday={props.firstWeekday} pending={props.workflowPending ?? false} dragEnabled={props.dragEnabled ?? false} />;
}

function InboxMode(props: ModeContentProps) {
  return <InboxView onRequestDelete={props.onRequestDelete} entities={props.indexState.entities ?? []} missionMissing={props.missionMissing} onAcceptAsEpic={props.onAcceptCandidateAsEpic} onAcceptAsStory={props.onAcceptCandidateAsStory} onCreateMission={props.onCreateMission} onReject={props.onRejectCandidate} onReconsider={props.onReconsiderCandidate} onDeleteDistraction={props.onDeleteDistraction} onEditCandidate={props.onEditCandidate} onOpenNote={props.onOpenNote} onSectionChange={props.onInboxSectionChange} pending={props.workflowPending ?? false} section={props.inboxSection ?? 'candidates'} />;
}

function CloseMode(props: ModeContentProps) {
  return <SprintClosePanel today={props.today} entities={props.indexState.entities ?? []} onBack={() => props.onModeChange('focus')} pending={props.workflowPending ?? false} onEvaluateStory={props.onEvaluateStory} onCloseSprint={props.onCloseSprint} onResumeClose={props.onResumeClose} />;
}
