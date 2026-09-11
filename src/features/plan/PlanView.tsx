import type { CreateTaskResult } from '../../application/work/create-work';
import type { TaskCreationDetails } from '../../application/work/create-work';
import { TaskFieldsEditor } from '../work/TaskFieldsEditor';
import { SprintTiming } from '../planning/SprintTiming';
import { useLocalDate } from '../planning/useLocalDate';
import { sprintWindow } from '../../application/planning/sprint-window';
import type { FocusFlowSettings } from '../../settings';
import { useRef, useState, type ReactNode, type RefObject } from 'react';
import { SprintCriteriaHint } from './SprintCriteriaHint';
import type { ProjectedManagedEntity } from '../../application/indexing/work-index';
import { compareRank } from '../../domain/ordering';
import { evaluateWip, type WipPolicy } from '../../domain/wip-policy';
import {
  BoardDragAdapter,
  BoardDragSurface,
  type BoardDragItem,
} from '../planning/BoardDragAdapter';
import { WorkTitleButton } from '../work/WorkTitleButton';
import { OutcomeEditor } from '../work/OutcomeEditor';
import { formatErrorMessage } from '../ui/error-message';
import type { EditableOutcome, EditOutcomeRequest } from '../../application/work/edit-outcome';
import type {
  AddActiveStoryResult,
  StoryPosition,
} from '../../application/planning/active-story-membership';
import { createPlanDropIntent } from './plan-drop-intent';
import { ActionMenu, MenuAction } from '../ui/ActionMenu';
import { DialogSurface } from '../ui/DialogSurface';
import { ChevronIcon, PlusIcon, CloseIcon } from '../ui/Icons';

type Epic = Extract<ProjectedManagedEntity, { type: 'epic' }>;
type BacklogEpic = Extract<Epic, { lifecycle: 'backlog' }>;
type Story = Extract<ProjectedManagedEntity, { type: 'story' }>;
type Task = Extract<ProjectedManagedEntity, { type: 'task' }>;
type MembershipChange = { storyId: string; kind: 'add' | 'remove'; position: StoryPosition };

interface PlanViewProps {
  onRequestDelete?: (item: EditableOutcome) => void;
  entities: readonly ProjectedManagedEntity[];
  onEditOutcome?: (request: EditOutcomeRequest) => Promise<unknown>;
  onOpenNote?: (path: string, event: MouseEvent) => void;
  onCreateTask?: (storyId: string, title: string, confirmWipExcess: boolean, details?: TaskCreationDetails) => Promise<CreateTaskResult>;
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
  onRemoveStoryFromActive?: (
    storyId: string,
    position: StoryPosition,
  ) => void;
  onReparentActiveStory?: (storyId: string, epicId: string) => void;
  onCompleteEpic?: (epicId: string) => void;
  onCloseEpic?: (epicId: string, reason: string | null) => void;
  sprintScopePolicy?: WipPolicy;
  today?: string;
  firstWeekday?: FocusFlowSettings['firstWeekday'];
  pending?: boolean;
  dragEnabled?: boolean;
}

export function PlanView({
  onRequestDelete,
  entities,
  onEditOutcome,
  onOpenNote,
  onCreateTask,
  onReorder,
  onCreateDraft,
  onSetMonthMembership,
  onAddStoryToDraft,
  onRemoveStoryFromDraft,
  onCancelDraft,
  onStartSprint,
  onAddStoryToActive,
  onRemoveStoryFromActive,
  onReparentActiveStory,
  onCompleteEpic,
  onCloseEpic,
  sprintScopePolicy = { mode: 'soft', limit: 28 },
  today: suppliedToday,
  firstWeekday = 1,
  pending = false,
  dragEnabled = false,
}: PlanViewProps) {
  const today = useLocalDate(suppliedToday);
  const window = sprintWindow(today, firstWeekday, entities.filter((entity) => entity.type === 'sprint'));
  const boardRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState<EditableOutcome | null>(null);
  const editAction = (item: EditableOutcome) => <>{onEditOutcome && item.lifecycle !== 'closed' && (item.type === 'task' || item.lifecycle !== 'done') && <MenuAction disabled={pending} onClick={() => setEditing(item)}>Edit…</MenuAction>}{onRequestDelete && <MenuAction destructive disabled={pending} onClick={() => onRequestDelete(item)}>Delete…</MenuAction>}</>;
  const [membership, setMembership] = useState<MembershipChange | null>(null);
  const { epics, stories, monthStories, tasks, openSprints, activeSprint, activeStories, sprint, sprintStories } = planModel(entities);
  const removeFromActive = activeRemovalHandler(onRemoveStoryFromActive, monthStories, setMembership);
  const applyPlanDrop = (storyId: string, initialGroup: string, targetGroup: string, targetIndex: number) => {
    const intent = createPlanDropIntent({ storyId, initialGroup, targetGroup, targetIndex, lists: {
      monthIds: monthStories.map((story) => story.id),
      sprintIds: sprintStories.map((story) => story.id),
      sprintLifecycle: sprint?.lifecycle === 'active' || sprint?.lifecycle === 'draft' ? sprint.lifecycle : null,
    } });
    applyDropIntent(intent, { onReorder, onAddStoryToDraft, onRemoveStoryFromDraft, setMembership });
  };

  return (
    <section className="focus-flow__mode">
      <header className="focus-flow__page-heading"><h1>Plan</h1></header>
      <BoardDragSurface onMove={applyPlanDrop}>
      <div className="focus-flow__plan-board" ref={boardRef}>
        <SprintPlanPane activeEpics={epics} dragEnabled={dragEnabled} editAction={editAction} managedByParent monthStories={monthStories} onCancelDraft={onCancelDraft} onCreateDraft={onCreateDraft} onCreateTask={onCreateTask} onOpenNote={onOpenNote} onRemoveStoryFromActive={removeFromActive} onRemoveStoryFromDraft={onRemoveStoryFromDraft} onReorder={onReorder} onReparentActiveStory={onReparentActiveStory} onStartSprint={onStartSprint} openSprints={openSprints} pending={pending} sprintScopePolicy={sprintScopePolicy} stories={stories} tasks={tasks} today={today} window={window} />
        <MonthPlanPane activeSprint={activeSprint} activeStories={activeStories} dragEnabled={dragEnabled} editAction={editAction} monthStories={monthStories} onAddStoryToActive={onAddStoryToActive} onAddStoryToDraft={onAddStoryToDraft} onCreateTask={onCreateTask} onEditOutcome={onEditOutcome} onOpenNote={onOpenNote} onReorder={onReorder} onSetMonthMembership={onSetMonthMembership} openSprints={openSprints} pending={pending} setEditing={setEditing} setMembership={setMembership} tasks={tasks} />
        <EpicPlanPane boardRef={boardRef} dragEnabled={dragEnabled} editAction={editAction} epics={epics} hasItemActions={Boolean(onEditOutcome || onRequestDelete)} onCloseEpic={onCloseEpic} onCompleteEpic={onCompleteEpic} onOpenNote={onOpenNote} onRequestDelete={onRequestDelete} onReorder={onReorder} onSetMonthMembership={onSetMonthMembership} pending={pending} stories={stories} tasks={tasks} />
      </div>
      </BoardDragSurface>
      <PlanOverlays activeSprint={activeSprint} activeStories={activeStories} editing={editing} entities={entities} membership={membership} monthStories={monthStories} onAddStoryToActive={onAddStoryToActive} onCloseEditing={() => setEditing(null)} onCloseMembership={() => setMembership(null)} onEditOutcome={onEditOutcome} onRemoveStoryFromActive={onRemoveStoryFromActive} stories={stories} tasks={tasks} />
    </section>
  );
}

function activeRemovalHandler(onRemove: PlanViewProps['onRemoveStoryFromActive'], monthStories: readonly Story[], setMembership: (change: MembershipChange) => void) {
  if (!onRemove) return undefined;
  return (storyId: string, position: StoryPosition) => setMembership({ storyId, kind: 'remove', position: position ?? positionAt(monthStories, monthStories.length) });
}

function PlanOverlays({ editing, membership, activeSprint, entities, stories, tasks, activeStories, monthStories, onEditOutcome, onAddStoryToActive, onRemoveStoryFromActive, onCloseEditing, onCloseMembership }: { editing: EditableOutcome | null; membership: MembershipChange | null; activeSprint: ReturnType<typeof planModel>['activeSprint']; entities: readonly ProjectedManagedEntity[]; stories: readonly Story[]; tasks: readonly Task[]; activeStories: readonly Story[]; monthStories: readonly Story[]; onEditOutcome?: PlanViewProps['onEditOutcome']; onAddStoryToActive?: PlanViewProps['onAddStoryToActive']; onRemoveStoryFromActive?: PlanViewProps['onRemoveStoryFromActive']; onCloseEditing: () => void; onCloseMembership: () => void }) {
  return <>{editing && onEditOutcome && <OutcomeEditor item={editing} suggestions={entities.flatMap((entity) => 'tags' in entity ? entity.tags : [])} onSave={onEditOutcome} onClose={onCloseEditing} />}{membership && activeSprint && <ActiveMembershipDialog key={`${membership.kind}-${membership.storyId}`} change={membership} story={stories.find((story) => story.id === membership.storyId)} sprintCode={activeSprint.code} tasks={tasks} destinationStories={membership.kind === 'add' ? activeStories : monthStories} onClose={onCloseMembership} onAdd={onAddStoryToActive} onRemove={onRemoveStoryFromActive} />}</>;
}

function planModel(entities: readonly ProjectedManagedEntity[]) {
  const epics = entities
    .filter(
      (entity): entity is BacklogEpic =>
        entity.type === 'epic' && entity.lifecycle === 'backlog',
    )
    .sort((left, right) =>
      compareRank(left.backlogRank, right.backlogRank, left.id, right.id),
    );
  const stories = entities.filter(
    (entity): entity is Story => entity.type === 'story',
  );
  const monthStories = stories
    .filter(
      (story): story is Story & { backlogRank: string } =>
        story.lifecycle === 'backlog' && story.backlogRank !== null,
    )
    .sort((left, right) =>
      compareRank(left.backlogRank, right.backlogRank, left.id, right.id),
    );
  const tasks = entities.filter(
    (entity): entity is Task => entity.type === 'task',
  );
  const openSprints = entities.filter(
    (
      entity,
    ): entity is Extract<ProjectedManagedEntity, { type: 'sprint' }> =>
      entity.type === 'sprint' &&
      (entity.lifecycle === 'draft' || entity.lifecycle === 'active'),
  );
  const activeSprint = openSprints.length === 1 && openSprints[0]?.lifecycle === 'active'
    ? openSprints[0]
    : undefined;
  const activeStories = activeSprint === undefined
    ? []
    : stories
        .filter(
          (story): story is Story & { sprintRank: string } =>
            story.lifecycle === 'active_sprint' &&
            story.sprintId === activeSprint.id &&
            story.sprintRank !== null,
        )
        .sort((left, right) => compareRank(
          left.sprintRank,
          right.sprintRank,
          left.id,
          right.id,
        ));
  const sprint = openSprints.length === 1 ? openSprints[0]! : undefined;
  const sprintStories = sprint === undefined
    ? []
    : stories
        .filter((story) => story.sprintId === sprint.id && (story.lifecycle === 'draft_sprint' || story.lifecycle === 'active_sprint'))
        .sort(compareStoryPlanningOrder);
  return { epics, stories, monthStories, tasks, openSprints, activeSprint, activeStories, sprint, sprintStories };
}

function applyDropIntent(intent: ReturnType<typeof createPlanDropIntent>, actions: { onReorder?: PlanViewProps['onReorder']; onAddStoryToDraft?: PlanViewProps['onAddStoryToDraft']; onRemoveStoryFromDraft?: PlanViewProps['onRemoveStoryFromDraft']; setMembership: (change: MembershipChange) => void }) {
  if (intent === null) return;
  if (intent.kind === 'reorder') actions.onReorder?.(intent.storyId, intent.targetIndex);
  else if (intent.kind === 'add-draft-story') actions.onAddStoryToDraft?.(intent.storyId, intent.position);
  else if (intent.kind === 'remove-draft-story') actions.onRemoveStoryFromDraft?.(intent.storyId, intent.position);
  else if (intent.kind === 'add-active-story') actions.setMembership({ storyId: intent.storyId, kind: 'add', position: intent.position });
  else actions.setMembership({ storyId: intent.storyId, kind: 'remove', position: intent.position });
}

type SprintPlanPaneProps = Parameters<typeof SprintPlanningArea>[0];

function SprintPlanPane(props: SprintPlanPaneProps) {
  return <div className="focus-flow__plan-pane"><SprintPlanningArea {...props} /></div>;
}

function MonthPlanPane({ monthStories, tasks, openSprints, activeSprint, activeStories, pending, dragEnabled, editAction, onSetMonthMembership, onAddStoryToDraft, onAddStoryToActive, onEditOutcome, onCreateTask, onOpenNote, onReorder, setEditing, setMembership }: { monthStories: readonly Story[]; tasks: readonly Task[]; openSprints: ReturnType<typeof planModel>['openSprints']; activeSprint: ReturnType<typeof planModel>['activeSprint']; activeStories: readonly Story[]; pending: boolean; dragEnabled: boolean; editAction: (item: EditableOutcome) => ReactNode; onSetMonthMembership?: PlanViewProps['onSetMonthMembership']; onAddStoryToDraft?: PlanViewProps['onAddStoryToDraft']; onAddStoryToActive?: PlanViewProps['onAddStoryToActive']; onEditOutcome?: PlanViewProps['onEditOutcome']; onCreateTask?: PlanViewProps['onCreateTask']; onOpenNote?: PlanViewProps['onOpenNote']; onReorder?: PlanViewProps['onReorder']; setEditing: (item: EditableOutcome) => void; setMembership: (change: MembershipChange) => void }) {
  const menuActions = (story: Story) => <>{editAction(story)}{onSetMonthMembership && <MenuAction disabled={pending} onClick={() => onSetMonthMembership(story.id, false)}>Return to Epic</MenuAction>}</>;
  const storyAction = (story: Story) => <MonthStoryAction activeSprint={activeSprint} activeStories={activeStories} onAddStoryToActive={onAddStoryToActive} onAddStoryToDraft={onAddStoryToDraft} onEdit={onEditOutcome ? () => setEditing(story) : undefined} openSprints={openSprints} pending={pending} setMembership={setMembership} story={story} />;
  return <div className="focus-flow__plan-pane"><header className="focus-flow__backlog-heading"><h2 id="focus-flow-month-backlog">Month backlog</h2><span className="focus-flow__backlog-count" aria-label={`${monthStories.length} Stories`}>{monthStories.length}</span></header><section aria-label="Month backlog" aria-labelledby="focus-flow-month-backlog" className="focus-flow__planning-section"><StoryList dragEnabled={dragEnabled} group="month" taskMenuActions={editAction} menuActions={menuActions} managedByParent onCreateTask={onCreateTask} onOpenNote={onOpenNote} onReorder={onReorder} pending={pending} reorderStories storyAction={storyAction} stories={monthStories} tasks={tasks} /></section></div>;
}

function MonthStoryAction({ story, openSprints, activeSprint, activeStories, pending, onAddStoryToDraft, onAddStoryToActive, onEdit, setMembership }: { story: Story; openSprints: ReturnType<typeof planModel>['openSprints']; activeSprint: ReturnType<typeof planModel>['activeSprint']; activeStories: readonly Story[]; pending: boolean; onAddStoryToDraft?: PlanViewProps['onAddStoryToDraft']; onAddStoryToActive?: PlanViewProps['onAddStoryToActive']; onEdit?: () => void; setMembership: (change: MembershipChange) => void }) {
  const missingCriteria = story.acceptanceCriteria.length === 0;
  return <span className="focus-flow__sprint-transfer"><MonthSprintTransfer activeSprint={activeSprint} activeStories={activeStories} missingCriteria={missingCriteria} onAddStoryToActive={onAddStoryToActive} onAddStoryToDraft={onAddStoryToDraft} openSprints={openSprints} pending={pending} setMembership={setMembership} story={story} />{missingCriteria && openSprints.length === 1 && <SprintCriteriaHint storyKey={story.key} disabled={pending} onEdit={onEdit} />}</span>;
}

function MonthSprintTransfer({ story, openSprints, activeSprint, activeStories, missingCriteria, pending, onAddStoryToDraft, onAddStoryToActive, setMembership }: { story: Story; openSprints: ReturnType<typeof planModel>['openSprints']; activeSprint: ReturnType<typeof planModel>['activeSprint']; activeStories: readonly Story[]; missingCriteria: boolean; pending: boolean; onAddStoryToDraft?: PlanViewProps['onAddStoryToDraft']; onAddStoryToActive?: PlanViewProps['onAddStoryToActive']; setMembership: (change: MembershipChange) => void }) {
  if (openSprints.length === 1 && openSprints[0]?.lifecycle === 'draft' && onAddStoryToDraft) return <button aria-label={`Add ${story.key} to Draft Sprint`} title={missingCriteria ? 'Add Acceptance Criteria in the Story note first' : 'Add to Draft Sprint'} className="focus-flow__button-quiet focus-flow__plan-transfer" disabled={pending || missingCriteria} onClick={() => onAddStoryToDraft(story.id)} type="button"><PlusIcon /> Sprint</button>;
  if (activeSprint && onAddStoryToActive) return <button aria-label={`Add ${story.key} to Active Sprint`} title="Add to Active Sprint" className="focus-flow__button-quiet focus-flow__plan-transfer" disabled={pending || missingCriteria} onClick={() => setMembership({ storyId: story.id, kind: 'add', position: positionAt(activeStories, activeStories.length) })} type="button"><PlusIcon /> Sprint</button>;
  return null;
}

function EpicPlanPane({ epics, stories, boardRef, pending, dragEnabled, editAction, hasItemActions, onOpenNote, onRequestDelete, onSetMonthMembership, onReorder, onCloseEpic, onCompleteEpic }: { epics: readonly BacklogEpic[]; stories: readonly Story[]; tasks: readonly Task[]; boardRef: RefObject<HTMLDivElement | null>; pending: boolean; dragEnabled: boolean; editAction: (item: EditableOutcome) => ReactNode; hasItemActions: boolean; onOpenNote?: PlanViewProps['onOpenNote']; onRequestDelete?: PlanViewProps['onRequestDelete']; onSetMonthMembership?: PlanViewProps['onSetMonthMembership']; onReorder?: PlanViewProps['onReorder']; onCloseEpic?: PlanViewProps['onCloseEpic']; onCompleteEpic?: PlanViewProps['onCompleteEpic'] }) {
  return <div className="focus-flow__plan-pane"><header className="focus-flow__backlog-heading"><h2 id="focus-flow-epic-backlog">Epic backlog</h2><span className="focus-flow__backlog-count" aria-label={`${epics.length} Epics`}>{epics.length}</span></header><section aria-label="Epic backlog" aria-labelledby="focus-flow-epic-backlog" className="focus-flow__planning-section">{epics.length === 0 ? <p className="focus-flow__empty-copy">No active Epics.</p> : <BoardDragAdapter disabled={pending} enabled={dragEnabled} group="epic-backlog" itemClassName="focus-flow__planning-item" items={dragItems(epics)} listClassName="focus-flow__planning-list" onMove={onReorder} renderItem={(_, index) => <EpicPlanItem boardRef={boardRef} editAction={editAction} epic={epics[index]!} epics={epics} hasItemActions={hasItemActions} index={index} onCloseEpic={onCloseEpic} onCompleteEpic={onCompleteEpic} onOpenNote={onOpenNote} onRequestDelete={onRequestDelete} onReorder={onReorder} onSetMonthMembership={onSetMonthMembership} pending={pending} stories={stories} />} />}</section></div>;
}

function EpicPlanItem({ epic, epics, index, stories, boardRef, pending, editAction, hasItemActions, onOpenNote, onRequestDelete, onSetMonthMembership, onReorder, onCloseEpic, onCompleteEpic }: { epic: BacklogEpic; epics: readonly BacklogEpic[]; index: number; stories: readonly Story[]; boardRef: RefObject<HTMLDivElement | null>; pending: boolean; editAction: (item: EditableOutcome) => ReactNode; hasItemActions: boolean; onOpenNote?: PlanViewProps['onOpenNote']; onRequestDelete?: PlanViewProps['onRequestDelete']; onSetMonthMembership?: PlanViewProps['onSetMonthMembership']; onReorder?: PlanViewProps['onReorder']; onCloseEpic?: PlanViewProps['onCloseEpic']; onCompleteEpic?: PlanViewProps['onCompleteEpic'] }) {
  const allStories = stories.filter((story) => story.epicId === epic.id);
  const openStories = allStories.filter(isPlanningStory).sort(compareStoryPlanningOrder);
  const action = <EpicFinalizationActions children={allStories} epic={epic} disabled={pending} onClose={onCloseEpic} onComplete={onCompleteEpic} reorderActions={<>{editAction(epic)}{reorderActionsFor({ disabled: pending, index, item: epic, length: epics.length, onReorder })}</>} />;
  return <PlanningDisclosure item={epic} onOpenNote={onOpenNote} summary={`${openStories.length} ${openStories.length === 1 ? 'Story' : 'Stories'}`} action={action}><EpicStoryLinks boardRef={boardRef} editAction={editAction} hasItemActions={hasItemActions} onOpenNote={onOpenNote} onRequestDelete={onRequestDelete} onSetMonthMembership={onSetMonthMembership} pending={pending} stories={openStories} /></PlanningDisclosure>;
}

function isPlanningStory(story: Story) {
  return story.lifecycle === 'epic_backlog' || story.lifecycle === 'backlog' || story.lifecycle === 'draft_sprint' || story.lifecycle === 'active_sprint';
}

function EpicStoryLinks({ stories, boardRef, pending, editAction, hasItemActions, onOpenNote, onRequestDelete, onSetMonthMembership }: { stories: readonly Story[]; boardRef: RefObject<HTMLDivElement | null>; pending: boolean; editAction: (item: EditableOutcome) => ReactNode; hasItemActions: boolean; onOpenNote?: PlanViewProps['onOpenNote']; onRequestDelete?: PlanViewProps['onRequestDelete']; onSetMonthMembership?: PlanViewProps['onSetMonthMembership'] }) {
  if (stories.length === 0) return <p className="focus-flow__empty-copy">No open Stories. Accept a Story in Inbox and choose this Epic.</p>;
  return <ul className="focus-flow__epic-story-links">{stories.map((story) => <EpicStoryLink boardRef={boardRef} editAction={editAction} hasItemActions={hasItemActions} key={story.id} onOpenNote={onOpenNote} onRequestDelete={onRequestDelete} onSetMonthMembership={onSetMonthMembership} pending={pending} story={story} />)}</ul>;
}

function EpicStoryLink({ story, boardRef, pending, editAction, hasItemActions, onOpenNote, onRequestDelete, onSetMonthMembership }: { story: Story; boardRef: RefObject<HTMLDivElement | null>; pending: boolean; editAction: (item: EditableOutcome) => ReactNode; hasItemActions: boolean; onOpenNote?: PlanViewProps['onOpenNote']; onRequestDelete?: PlanViewProps['onRequestDelete']; onSetMonthMembership?: PlanViewProps['onSetMonthMembership'] }) {
  if (story.lifecycle === 'epic_backlog') return <li><WorkTitleButton item={story} onOpenNote={onOpenNote} /><span className="focus-flow__story-actions"><button aria-label={`Add ${story.key} to Month backlog`} className="focus-flow__button-quiet" disabled={pending || !onSetMonthMembership} onClick={() => onSetMonthMembership?.(story.id, true)} type="button"><PlusIcon /> Month</button>{hasItemActions && <ActionMenu label={`Actions for ${story.key}`}>{editAction(story)}</ActionMenu>}</span></li>;
  const location = story.lifecycle === 'backlog' ? 'Month backlog' : story.lifecycle === 'draft_sprint' ? 'Draft Sprint' : 'Active Sprint';
  return <li><WorkTitleButton item={story} onOpenNote={onOpenNote} /><button aria-label={`Show ${story.key} in ${location}`} className="focus-flow__button-quiet" onClick={() => focusPlanStory(boardRef, story.id)} type="button">{location}<ChevronIcon direction="right" /></button></li>;
}

function focusPlanStory(boardRef: RefObject<HTMLDivElement | null>, storyId: string) {
  const row = boardRef.current?.querySelector<HTMLElement>(`[data-plan-story="${storyId}"]`);
  row?.scrollIntoView?.({ block: 'center', behavior: 'instant' });
  row?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
}

function EpicFinalizationActions({
  epic,
  children,
  disabled,
  onComplete,
  onClose,
  reorderActions,
}: {
  epic: BacklogEpic;
  children: readonly Story[];
  disabled: boolean;
  onComplete?: PlanViewProps['onCompleteEpic'];
  onClose?: PlanViewProps['onCloseEpic'];
  reorderActions: ReactNode;
}) {
  const [reason, setReason] = useState('');
  const [closing, setClosing] = useState(false);
  const childrenTerminal = children.every(
    (story) => story.lifecycle === 'done' || story.lifecycle === 'closed',
  );
  const criteria = epic.acceptanceCriteria ?? [];
  const canComplete =
    childrenTerminal &&
    children.length > 0 &&
    criteria.length > 0 &&
    criteria.every((criterion) => criterion.checked);
  return (
    <>
      <ActionMenu label={`Actions for ${epic.key}`}>
        {reorderActions}
        <MenuAction disabled={disabled || !canComplete || !onComplete} onClick={() => onComplete?.(epic.id)}>Complete {epic.key}</MenuAction>
        <MenuAction destructive disabled={disabled || !childrenTerminal || !onClose} onClick={() => setClosing(true)}>Close {epic.key}…</MenuAction>
      </ActionMenu>
      {closing && <DialogSurface title={`Close ${epic.key}`} description="Close this Epic without marking its outcome achieved." onClose={() => setClosing(false)}>
        <form className="focus-flow__task-dialog-form" onSubmit={(event) => { event.preventDefault(); onClose?.(epic.id, reason.trim() || null); setClosing(false); }}>
          <label>Reason (optional)<input aria-label={`Close reason for ${epic.key}`} disabled={disabled} onChange={(event) => setReason(event.currentTarget.value)} value={reason} /></label>
          <button aria-label={`Close ${epic.key}`} className="focus-flow__button-danger" disabled={disabled} type="submit">Close Epic</button>
        </form>
      </DialogSurface>}
    </>
  );
}

function SprintPlanningArea({
  editAction,
  openSprints,
  stories,
  tasks,
  onCreateDraft,
  onRemoveStoryFromDraft,
  onCancelDraft,
  onStartSprint,
  onRemoveStoryFromActive,
  onReparentActiveStory,
  activeEpics,
  monthStories,
  onOpenNote,
  onCreateTask,
  onReorder,
  sprintScopePolicy,
  pending,
  dragEnabled,
  managedByParent,
  today,
  window,
}: {
  editAction: (item: EditableOutcome) => ReactNode;
  openSprints: readonly Extract<ProjectedManagedEntity, { type: 'sprint' }>[];
  stories: readonly Story[];
  tasks: readonly Task[];
  onCreateDraft?: PlanViewProps['onCreateDraft'];
  onRemoveStoryFromDraft?: PlanViewProps['onRemoveStoryFromDraft'];
  onCancelDraft?: PlanViewProps['onCancelDraft'];
  onStartSprint?: PlanViewProps['onStartSprint'];
  onRemoveStoryFromActive?: PlanViewProps['onRemoveStoryFromActive'];
  onReparentActiveStory?: PlanViewProps['onReparentActiveStory'];
  activeEpics: readonly Epic[];
  monthStories: readonly Story[];
  onOpenNote?: PlanViewProps['onOpenNote'];
  onCreateTask?: PlanViewProps['onCreateTask'];
  onReorder?: PlanViewProps['onReorder'];
  sprintScopePolicy: WipPolicy;
  pending: boolean;
  dragEnabled: boolean;
  managedByParent?: boolean;
  today: string;
  window: ReturnType<typeof sprintWindow>;
}) {
  if (openSprints.length === 0) {
    return (
      <section className="focus-flow__planning-section">
        <div className="focus-flow__sprint-heading"><h2>Next Sprint</h2>
        <button
          className="focus-flow__button-primary"
          disabled={pending || onCreateDraft === undefined}
          onClick={onCreateDraft}
          type="button"
        >
          Create Draft Sprint
        </button>
        </div>
        <p className="focus-flow__plan-hint">Create a draft, add Stories from Month backlog, then start when ready.</p>
      </section>
    );
  }

  if (openSprints.length !== 1) {
    return (
      <section className="focus-flow__planning-section">
        <h2>Sprint planning unavailable</h2>
        <p role="alert">
          Multiple Draft or Active Sprints need attention before planning.
        </p>
      </section>
    );
  }

  const sprint = openSprints[0]!;
  const selectedStories = stories
    .filter(
      (story) =>
        story.sprintId === sprint.id &&
        (story.lifecycle === 'draft_sprint' ||
          story.lifecycle === 'active_sprint'),
    )
    .sort(compareStoryPlanningOrder);

  if (sprint.lifecycle === 'active') return <ActiveSprintArea activeEpics={activeEpics} dragEnabled={dragEnabled} editAction={editAction} managedByParent={managedByParent} monthStories={monthStories} onCreateTask={onCreateTask} onOpenNote={onOpenNote} onRemoveStoryFromActive={onRemoveStoryFromActive} onReorder={onReorder} onReparentActiveStory={onReparentActiveStory} pending={pending} selectedStories={selectedStories} sprint={sprint} tasks={tasks} today={today} />;

  const selectedIds = new Set(selectedStories.map((story) => story.id));
  const openScope = tasks.filter(
    (task) =>
      selectedIds.has(task.storyId) &&
      task.lifecycle === 'active' &&
      task.status !== 'done',
  ).length;
  const scopeDecision = evaluateWip(sprintScopePolicy, openScope);
  const missingCriteria = selectedStories.filter(
    (story) => story.acceptanceCriteria.length === 0,
  );
  return <DraftSprintArea dragEnabled={dragEnabled} editAction={editAction} managedByParent={managedByParent} missingCriteria={missingCriteria} onCancelDraft={onCancelDraft} onCreateTask={onCreateTask} onOpenNote={onOpenNote} onRemoveStoryFromDraft={onRemoveStoryFromDraft} onReorder={onReorder} onStartSprint={onStartSprint} openScope={openScope} pending={pending} scopeDecision={scopeDecision} selectedStories={selectedStories} sprintScopePolicy={sprintScopePolicy} tasks={tasks} window={window} />;
}

function ActiveSprintArea({ sprint, selectedStories, tasks, activeEpics, monthStories, today, pending, dragEnabled, managedByParent, editAction, onCreateTask, onOpenNote, onReorder, onReparentActiveStory, onRemoveStoryFromActive }: { sprint: Extract<ProjectedManagedEntity, { type: 'sprint'; lifecycle: 'active' }>; selectedStories: readonly Story[]; tasks: readonly Task[]; activeEpics: readonly Epic[]; monthStories: readonly Story[]; today: string; pending: boolean; dragEnabled: boolean; managedByParent?: boolean; editAction: (item: EditableOutcome) => ReactNode; onCreateTask?: PlanViewProps['onCreateTask']; onOpenNote?: PlanViewProps['onOpenNote']; onReorder?: PlanViewProps['onReorder']; onReparentActiveStory?: PlanViewProps['onReparentActiveStory']; onRemoveStoryFromActive?: PlanViewProps['onRemoveStoryFromActive'] }) {
  const menuActions = (story: Story) => <>{editAction(story)}{onReparentActiveStory && activeEpics.map((epic) => <MenuAction disabled={pending || epic.id === story.epicId} key={epic.id} onClick={() => onReparentActiveStory(story.id, epic.id)}>{epic.id === story.epicId ? 'Current: ' : 'Move to '}{epic.key} {epic.title}</MenuAction>)}</>;
  const storyAction = onRemoveStoryFromActive ? (story: Story) => <button aria-label={`Return ${story.key} to Month backlog`} className="focus-flow__button-quiet focus-flow__plan-transfer" disabled={pending} onClick={() => onRemoveStoryFromActive(story.id, positionAt(monthStories, monthStories.length))} type="button"><ChevronIcon direction="down" /> Month</button> : undefined;
  return <section aria-labelledby="focus-flow-active-sprint" className="focus-flow__planning-section focus-flow__sprint"><div className="focus-flow__sprint-heading"><h2 id="focus-flow-active-sprint">{sprint.code}</h2><span className="focus-flow__plan-state">Active</span><SprintTiming sprint={sprint} />{today > sprint.dueOn && <span role="status" title="The planned week has ended; this Sprint remains open until you review and close it.">Review due</span>}</div><p className="focus-flow__plan-hint">Next draft after Sprint review.</p><StoryList dragEnabled={dragEnabled} group="sprint" taskMenuActions={editAction} managedByParent={managedByParent} onCreateTask={onCreateTask} onOpenNote={onOpenNote} onReorder={onReorder} pending={pending} reorderStories stories={selectedStories} menuActions={menuActions} storyAction={storyAction} tasks={tasks} /></section>;
}

function DraftSprintArea({ selectedStories, tasks, missingCriteria, openScope, scopeDecision, sprintScopePolicy, window, pending, dragEnabled, managedByParent, editAction, onCancelDraft, onCreateTask, onOpenNote, onReorder, onRemoveStoryFromDraft, onStartSprint }: { selectedStories: readonly Story[]; tasks: readonly Task[]; missingCriteria: readonly Story[]; openScope: number; scopeDecision: ReturnType<typeof evaluateWip>; sprintScopePolicy: WipPolicy; window: ReturnType<typeof sprintWindow>; pending: boolean; dragEnabled: boolean; managedByParent?: boolean; editAction: (item: EditableOutcome) => ReactNode; onCancelDraft?: PlanViewProps['onCancelDraft']; onCreateTask?: PlanViewProps['onCreateTask']; onOpenNote?: PlanViewProps['onOpenNote']; onReorder?: PlanViewProps['onReorder']; onRemoveStoryFromDraft?: PlanViewProps['onRemoveStoryFromDraft']; onStartSprint?: PlanViewProps['onStartSprint'] }) {
  const storyAction = onRemoveStoryFromDraft ? (story: Story) => <button aria-label={`Remove ${story.key} from Draft Sprint`} title="Return to Month" className="focus-flow__icon-button" disabled={pending} onClick={() => onRemoveStoryFromDraft(story.id)} type="button"><CloseIcon /></button> : undefined;
  return <section aria-labelledby="focus-flow-draft-sprint" className="focus-flow__planning-section focus-flow__sprint"><div className="focus-flow__sprint-heading"><h2 id="focus-flow-draft-sprint">Draft Sprint</h2><button disabled={pending || !onCancelDraft} onClick={onCancelDraft} type="button">Cancel Draft Sprint</button></div>{selectedStories.length === 0 && <p className="focus-flow__plan-hint">Choose Stories from Month backlog{dragEnabled ? ' or drag them here' : ''}.</p>}<StoryList dragEnabled={dragEnabled} group="sprint" taskMenuActions={editAction} menuActions={editAction} managedByParent={managedByParent} onCreateTask={onCreateTask} onOpenNote={onOpenNote} onReorder={onReorder} pending={pending} reorderStories stories={selectedStories} storyAction={storyAction} tasks={tasks} /><DraftReadiness missingCriteria={missingCriteria} onStartSprint={onStartSprint} openScope={openScope} pending={pending} ready={selectedStories.length > 0 && missingCriteria.length === 0} scopeDecision={scopeDecision} sprintScopePolicy={sprintScopePolicy} window={window} /></section>;
}

function DraftReadiness({ window, missingCriteria, openScope, sprintScopePolicy, scopeDecision, ready, pending, onStartSprint }: { window: ReturnType<typeof sprintWindow>; missingCriteria: readonly Story[]; openScope: number; sprintScopePolicy: WipPolicy; scopeDecision: ReturnType<typeof evaluateWip>; ready: boolean; pending: boolean; onStartSprint?: PlanViewProps['onStartSprint'] }) {
  const disabled = pending || !ready || Boolean(window.occupied) || scopeDecision.kind === 'reject' || !onStartSprint;
  return <div className="focus-flow__sprint-readiness"><SprintWindowSummary window={window} />{missingCriteria.map((story) => <p key={story.id}>{story.key} needs Acceptance Criteria.</p>)}<p>Open scope: {openScope} / {sprintScopePolicy.limit}</p><ScopeWarning decision={scopeDecision} /><button disabled={disabled} onClick={() => onStartSprint?.(scopeDecision.kind === 'confirm')} type="button">{scopeDecision.kind === 'confirm' ? 'Start anyway' : 'Start Sprint'}</button></div>;
}

function SprintWindowSummary({ window }: { window: ReturnType<typeof sprintWindow> }) {
  return <><p>Calendar week: <strong>{window.startsOn} – {window.dueOn}</strong>{window.late && <> · {window.remaining} calendar {window.remaining === 1 ? 'day' : 'days'} remaining</>}</p>{window.occupied && window.occupied.lifecycle !== 'draft' && <p role="status">{window.occupied.code} already used {window.startsOn} – {window.dueOn}. Prepare this Draft now; you can start on {window.nextStartsOn}.</p>}</>;
}

function ScopeWarning({ decision }: { decision: ReturnType<typeof evaluateWip> }) {
  if (decision.kind === 'allow') return null;
  return <p>{decision.kind === 'confirm' ? 'Soft' : 'Hard'} limit exceeded by {decision.excess}.</p>;
}

function ActiveMembershipDialog({ change, story, sprintCode, tasks, destinationStories, onClose, onAdd, onRemove }: {
  change: { storyId: string; kind: 'add' | 'remove'; position: StoryPosition };
  story: Story | undefined;
  sprintCode: string;
  tasks: readonly Task[];
  destinationStories: readonly Story[];
  onClose: () => void;
  onAdd?: PlanViewProps['onAddStoryToActive'];
  onRemove?: PlanViewProps['onRemoveStoryFromActive'];
}) {
  const [position, setPosition] = useState(change.position);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmExcess, setConfirmExcess] = useState(false);
  const adding = change.kind === 'add';
  const openTasks = tasks.filter((task) => task.storyId === change.storyId && task.lifecycle === 'active' && task.status !== 'done').length;
  const copy = membershipCopy(adding, sprintCode);
  const apply = async () => {
    if (saving || !story) return;
    setSaving(true);
    try {
      if (adding && onAdd) {
        const result = await onAdd(story.id, position, confirmExcess);
        if (result.kind !== 'changed') {
          setError(result.message);
          setConfirmExcess(result.kind === 'confirmation-required');
          return;
        }
      } else if (!adding && onRemove) onRemove(story.id, position);
      else return;
      onClose();
    } catch (error) {
      setError(formatErrorMessage(error, 'The Sprint could not be updated. Your selection is kept; try again.'));
    } finally { setSaving(false); }
  };
  return <DialogSurface title={copy.title} description={copy.description} onClose={() => { if (!saving) onClose(); }}>
    <div className="focus-flow__membership-confirmation">
      <MembershipStorySummary adding={adding} openTasks={openTasks} story={story} />
      <MembershipPosition adding={adding} destinationStories={destinationStories} onChange={setPosition} position={position} saving={saving} />
      {error && <p role="alert">{error}</p>}
      <MembershipFooter adding={adding} confirmExcess={confirmExcess} onAdd={onAdd} onApply={apply} onClose={onClose} onRemove={onRemove} saving={saving} story={story} />
    </div>
  </DialogSurface>;
}

function membershipCopy(adding: boolean, sprintCode: string) {
  if (adding) return { title: 'Add to Active Sprint?', description: `This changes the scope of ${sprintCode}.` };
  return { title: 'Return to Month backlog?', description: `This removes the Story from ${sprintCode}, not from its Epic.` };
}

function MembershipStorySummary({ story, openTasks, adding }: { story?: Story; openTasks: number; adding: boolean }) {
  const taskLabel = openTasks === 1 ? 'Task' : 'Tasks';
  const effect = adding ? 'will join this Sprint.' : 'will leave this Sprint. Task notes are kept.';
  return <><p><strong>{story?.key}</strong> {story?.title ?? 'Story no longer available'}</p><p className="focus-flow__plan-hint">{openTasks} open {taskLabel} {effect}</p></>;
}

function MembershipPosition({ adding, destinationStories, position, saving, onChange }: { adding: boolean; destinationStories: readonly Story[]; position: StoryPosition; saving: boolean; onChange: (position: StoryPosition) => void }) {
  if (destinationStories.length === 0) return null;
  const change = (id: string) => {
    const index = destinationStories.findIndex((item) => item.id === id);
    onChange(positionAt(destinationStories, index < 0 ? destinationStories.length : index));
  };
  return <details><summary>Position in {adding ? 'Sprint' : 'Month backlog'}</summary><label>Place Story<select aria-label="Story position" disabled={saving} value={position.afterStoryId ?? ''} onChange={(event) => change(event.currentTarget.value)}><option value="">At end</option>{destinationStories.map((item) => <option key={item.id} value={item.id}>Before {item.key}</option>)}</select></label></details>;
}

function MembershipFooter({ adding, saving, story, confirmExcess, onAdd, onRemove, onClose, onApply }: { adding: boolean; saving: boolean; story?: Story; confirmExcess: boolean; onAdd?: PlanViewProps['onAddStoryToActive']; onRemove?: PlanViewProps['onRemoveStoryFromActive']; onClose: () => void; onApply: () => Promise<void> }) {
  const supported = adding ? Boolean(onAdd) : Boolean(onRemove);
  const label = membershipButtonLabel({ adding, saving, confirmExcess });
  return <footer><button className="focus-flow__button-quiet" disabled={saving} onClick={onClose} type="button">Cancel</button><button className="focus-flow__button-primary" disabled={saving || !story || !supported} onClick={() => void onApply()} type="button">{label}</button></footer>;
}

function membershipButtonLabel({ adding, saving, confirmExcess }: { adding: boolean; saving: boolean; confirmExcess: boolean }) {
  if (saving) return 'Updating…';
  if (confirmExcess) return 'Add anyway';
  return adding ? 'Add to Sprint' : 'Return to Month';
}

function positionAt(stories: readonly Story[], index: number): StoryPosition {
  return {
    beforeStoryId: stories[index - 1]?.id ?? null,
    afterStoryId: stories[index]?.id ?? null,
  };
}

function StoryList({
  taskMenuActions,
  stories,
  tasks,
  onOpenNote,
  onCreateTask,
  onReorder,
  pending,
  dragEnabled,
  reorderStories,
  group,
  storyAction,
  menuActions,
  managedByParent = false,

}: {
  stories: readonly Story[];
  tasks: readonly Task[];
  taskMenuActions?: (task: Task) => ReactNode;
  onOpenNote?: PlanViewProps['onOpenNote'];
  onCreateTask?: PlanViewProps['onCreateTask'];
  onReorder?: PlanViewProps['onReorder'];
  pending: boolean;
  dragEnabled: boolean;
  reorderStories: boolean;
  group: string;
  storyAction?: (story: Story) => ReactNode;
  menuActions?: (story: Story) => ReactNode;
  managedByParent?: boolean;
}) {
  if (stories.length === 0 && !dragEnabled) {
    return <p className="focus-flow__empty-copy">No Stories yet.</p>;
  }
  return (
    <BoardDragAdapter
      disabled={pending}
      enabled={dragEnabled && reorderStories}
      group={group}
      itemClassName="focus-flow__planning-item"
      items={dragItems(stories)}
      listClassName="focus-flow__planning-list"
      managedByParent={managedByParent}
      onMove={reorderStories ? onReorder : undefined}
      renderItem={(_, index) => {
        const story = stories[index]!;
        const openTasks = tasks.filter((task) => task.storyId === story.id && task.status !== 'done').length;
        return (
          <PlanningDisclosure item={story} onOpenNote={onOpenNote} summary={`${openTasks} ${openTasks === 1 ? 'Task' : 'Tasks'}`} primaryAction={storyAction?.(story)} action={reorderStories && <ReorderMenu disabled={pending} index={index} item={story} length={stories.length} onReorder={onReorder}>{menuActions?.(story)}</ReorderMenu>}>
            <TaskList
              menuActions={taskMenuActions}
              dragEnabled={dragEnabled}
              onOpenNote={onOpenNote}
              onReorder={onReorder}
              pending={pending}
              story={story}
              tasks={tasks
                .filter((task) => task.storyId === story.id)
                .sort((left, right) =>
                  compareRank(left.taskRank, right.taskRank, left.id, right.id),
                )}
            />
            {(story.lifecycle === 'backlog' ||
              story.lifecycle === 'draft_sprint' || story.lifecycle === 'active_sprint') && (
              <TaskCreationForm
                onCreateTask={onCreateTask}
                pending={pending}
                story={story}
              />
            )}
          </PlanningDisclosure>
        );
      }}
    />
  );
}

function PlanningDisclosure({
  item,
  onOpenNote,
  children,
  summary,
  action,
  primaryAction,
}: {
  item: Epic | Story;
  onOpenNote?: PlanViewProps['onOpenNote'];
  children: ReactNode;
  summary?: string;
  action?: ReactNode;
  primaryAction?: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="focus-flow__planning-disclosure" data-plan-story={item.type === 'story' ? item.id : undefined}>
      <div className="focus-flow__planning-heading">
        <button
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Collapse' : 'Expand'} ${item.key}`}
          className="focus-flow__disclosure-toggle"
          onClick={() => setExpanded((current) => !current)}
          type="button"
        >
          <ChevronIcon direction={expanded ? 'down' : 'right'} />
        </button>
        <WorkTitleButton item={item} onOpenNote={onOpenNote} />
        {summary && <span className="focus-flow__planning-summary">{summary}</span>}
        {primaryAction && <span className="focus-flow__planning-primary-action">{primaryAction}</span>}
        {action && <span className="focus-flow__planning-row-action">{action}</span>}
      </div>
      {expanded && (
        <div className="focus-flow__planning-content">{children}</div>
      )}
    </div>
  );
}

function TaskCreationForm({
  story,
  onCreateTask,
  pending,
}: {
  story: Story;
  onCreateTask?: PlanViewProps['onCreateTask'];
  pending: boolean;
}) {
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState<TaskCreationDetails>({ tags: [], bodyFields: {} });
  const [open, setOpen] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState(false);
  const create = async (confirm: boolean) => {
    if (!onCreateTask || saving || title.trim() === '') return;
    setSaving(true);
    try {
      const result = await (details.tags.length || Object.keys(details.bodyFields).length ? onCreateTask(story.id, title.trim(), confirm, details) : onCreateTask(story.id, title.trim(), confirm));
      if (result.kind === 'created') {
        setTitle(''); setMessage(null); setConfirmation(false); setOpen(false);
        setDetails({ tags: [], bodyFields: {} });
      } else {
        setMessage(result.message); setConfirmation(result.kind === 'confirmation-required');
      }
    } catch (error) {
      setMessage(formatErrorMessage(error, 'Could not add the Task. Your text is saved here; try again.'));
      setConfirmation(false);
    } finally { setSaving(false); }
  };
  return (
    <>
      <button aria-label={`Create Task for ${story.key}`} className="focus-flow__icon-button" disabled={pending} onClick={() => setOpen(true)} title="Create Task" type="button"><PlusIcon /></button>
      {open && <DialogSurface title="New Task" description={`${story.key} · ${story.title}`} initialFocusRef={titleRef} onClose={() => { if (!saving) setOpen(false); }}>
    <form
      className="focus-flow__task-dialog-form"
      onSubmit={(event) => {
        event.preventDefault();
        void create(false);
      }}
    >
      <label>
        <span>New Task</span>
        <input
          aria-label={`New Task for ${story.key}`}
          disabled={pending || saving}
          onChange={(event) => setTitle(event.currentTarget.value)}
          ref={titleRef}
          required
          type="text"
          value={title}
        />
      </label>
      <TaskFieldsEditor value={details} onChange={setDetails} suggestions={story.effectiveTags} disabled={pending || saving} />
      <button
        aria-label={`Add Task to ${story.key}`}
        disabled={pending || saving || title.trim() === '' || !onCreateTask}
        type="submit"
      >
        Add Task
      </button>
    </form>
      {message && <div role="alert"><p>{message}</p>{confirmation && <button disabled={pending || saving} type="button" onClick={() => void create(true)}>Add anyway</button>}</div>}
      </DialogSurface>}
    </>
  );
}

function TaskList({
  menuActions,
  story,
  tasks,
  onOpenNote,
  onReorder,
  pending,
  dragEnabled,
}: {
  story: Story;
  tasks: readonly Task[];
  menuActions?: (task: Task) => ReactNode;
  onOpenNote?: PlanViewProps['onOpenNote'];
  onReorder?: PlanViewProps['onReorder'];
  pending: boolean;
  dragEnabled: boolean;
}) {
  return tasks.length === 0 ? (
    <p className="focus-flow__empty-copy">No Tasks.</p>
  ) : (
    <BoardDragAdapter
      disabled={pending}
      enabled={dragEnabled}
      group={`tasks-${story.id}`}
      items={dragItems(tasks)}
      listClassName="focus-flow__task-list"
      onMove={onReorder}
      renderItem={(_, index) => {
        const task = tasks[index]!;
        return (
          <>
            <WorkTitleButton item={task} onOpenNote={onOpenNote} />
            {(task.lifecycle !== 'active' || task.status === 'done') && (
              <span className="focus-flow__task-context">Prior Done</span>
            )}
            <ReorderMenu
              disabled={pending}
              index={index}
              item={task}
              length={tasks.length}
              onReorder={onReorder}
            >{menuActions?.(task)}</ReorderMenu>
          </>
        );
      }}
    />
  );
}

interface ReorderProps {
  item: Epic | Story | Task;
  index: number;
  length: number;
  onReorder?: PlanViewProps['onReorder'];
  disabled: boolean;
}

function ReorderMenu({ children, ...props }: ReorderProps & { children?: ReactNode }) {
  return <ActionMenu label={`Reorder ${props.item.key}`}>{children}{reorderActionsFor(props)}</ActionMenu>;
}

function reorderActionsFor({ item, index, length, onReorder, disabled }: ReorderProps) {
  const move = (target: number) => {
    if (target !== index) onReorder?.(item.id, target);
  };
  const unavailable = disabled || onReorder === undefined;
  return <>
    <MenuAction disabled={unavailable || index === 0} onClick={() => move(0)}>Move to top</MenuAction>
    <MenuAction disabled={unavailable || index === 0} onClick={() => move(index - 1)}>Move up</MenuAction>
    <MenuAction disabled={unavailable || index === length - 1} onClick={() => move(index + 1)}>Move down</MenuAction>
    <MenuAction disabled={unavailable || index === length - 1} onClick={() => move(length - 1)}>Move to bottom</MenuAction>
  </>;
}

function dragItems(items: readonly (Epic | Story | Task)[]): BoardDragItem[] {
  return items.map((item) => ({
    id: item.id,
    label: `${item.key} ${item.title}`,
  }));
}

function compareStoryPlanningOrder(left: Story, right: Story): number {
  const leftRank = left.sprintRank ?? left.backlogRank ?? '';
  const rightRank = right.sprintRank ?? right.backlogRank ?? '';
  return compareRank(leftRank, rightRank, left.id, right.id);
}
