import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import type {
  MoveTaskRequest,
  MoveTaskResult,
} from '../../application/focus/focus-board';
import type { ProjectedManagedEntity } from '../../application/indexing/work-index';
import type { CreateTaskResult } from '../../application/work/create-work';
import type { TaskCreationDetails } from '../../application/work/create-work';
import { TaskFieldsEditor } from '../work/TaskFieldsEditor';
import { SprintTiming } from '../planning/SprintTiming';
import { compareRank } from '../../domain/ordering';
import {
  allowedTaskDestinations,
  TASK_STATUS_LABELS,
  TASK_STATUS_ORDER,
} from '../../domain/task-flow';
import type { TaskStatus } from '../../domain/work-note';
import { formatErrorMessage } from '../ui/error-message';
import {
  BoardDragAdapter,
  BoardDragSurface,
} from '../planning/BoardDragAdapter';
import { StoryFilter } from './StoryFilter';
import { DialogSurface } from '../ui/DialogSurface';
import { WorkTitleButton } from '../work/WorkTitleButton';
import { OutcomeEditor } from '../work/OutcomeEditor';
import type { EditableOutcome, EditOutcomeRequest } from '../../application/work/edit-outcome';
import { ActionMenu, MenuAction } from '../ui/ActionMenu';
import { CheckIcon, ChevronIcon, PlayIcon, PlusIcon } from '../ui/Icons';

type Sprint = Extract<ProjectedManagedEntity, { type: 'sprint' }>;
type Story = Extract<ProjectedManagedEntity, { type: 'story' }>;
type Task = Extract<ProjectedManagedEntity, { type: 'task' }>;

interface FocusViewProps {
  onRequestDelete?: (item: EditableOutcome) => void;
  onEditOutcome?: (request: EditOutcomeRequest) => Promise<unknown>;
  entities: readonly ProjectedManagedEntity[];
  dragEnabled: boolean;
  pending?: boolean;
  onReviewSprint?: () => void;
  onPlan?: () => void;
  onMoveTask?: (request: MoveTaskRequest) => Promise<MoveTaskResult>;
  onOpenNote?: (path: string, event: MouseEvent) => void;
  onCreateTask?: (
    storyId: string,
    title: string,
    confirmWipExcess: boolean,
    details?: TaskCreationDetails,
  ) => Promise<CreateTaskResult>;
}

export function FocusView({
  entities,
  onPlan,
  ...props
}: FocusViewProps) {
  const model = useMemo(() => focusModel(entities), [entities]);
  if (model.kind !== 'ready') return <UnavailableFocus kind={model.kind} onPlan={onPlan} />;
  return <ReadyFocusView {...props} entities={entities} model={model} />;
}

type ReadyFocusModel = Extract<ReturnType<typeof focusModel>, { kind: 'ready' }>;

function ReadyFocusView({
  onRequestDelete,
  entities,
  onEditOutcome,
  model,
  dragEnabled,
  pending = false,
  onMoveTask,
  onOpenNote,
  onCreateTask,
  onReviewSprint,
}: Omit<FocusViewProps, 'onPlan'> & { model: ReadyFocusModel }) {
  const [mobileStatus, setMobileStatus] = useState<TaskStatus>('today');
  const [allStatuses, setAllStatuses] = useState(false);
  const [storyFilter, setStoryFilter] = useState('');
  const [editing, setEditing] = useState<EditableOutcome | null>(null);
  const boardRef = useRef<HTMLElement>(null);
  const [compact, setCompact] = useState(false);
  const movement = useTaskMovement(onMoveTask);

  useEffect(() => {
    const element = boardRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setCompact(entry.contentRect.width < 620);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [model.kind]);

  const { selectedFilter, visibleStories, visibleTasks, statuses } = visibleFocusModel(model, storyFilter, allStatuses);
  const itemActions = (item: EditableOutcome) => <>{onEditOutcome && item.lifecycle !== 'closed' && <MenuAction disabled={pending} onClick={() => setEditing(item)}>Edit…</MenuAction>}{onRequestDelete && <MenuAction destructive disabled={pending} onClick={() => onRequestDelete(item)}>Delete…</MenuAction>}</>;
  const storyActions = (story: Story) => <span className="focus-flow__story-actions"><TaskCreationPanel onCreateTask={onCreateTask} pending={pending} stories={[story]} />{(onEditOutcome || onRequestDelete) && <ActionMenu label={`Actions for ${story.key}`}>{itemActions(story)}</ActionMenu>}</span>;

  return <section className="focus-flow__mode focus-flow__focus-board" ref={boardRef}>
      <FocusSprintHeader onReviewSprint={onReviewSprint} sprint={model.sprint} />
      <MoveMessage {...movement} pending={pending} />
      <FocusToolbar allStatuses={allStatuses} compact={compact} dragEnabled={dragEnabled} onAllStatusesChange={setAllStatuses} onStoryFilterChange={setStoryFilter} selectedFilter={selectedFilter} stories={model.stories} />
      <FocusBoards compact={compact} completedBeforeSprint={model.completedBeforeSprint} dragEnabled={dragEnabled} mobileStatus={mobileStatus} onMobileStatusChange={setMobileStatus} onMove={movement.move} onMoveTask={onMoveTask} onOpenNote={onOpenNote} pending={pending} renderCreateTask={storyActions} renderEditTask={itemActions} statuses={statuses} stories={visibleStories} tasks={visibleTasks} />
      <OutcomeEditDialog editing={editing} entities={entities} onClose={() => setEditing(null)} onEditOutcome={onEditOutcome} />
    </section>;
}

function FocusSprintHeader({ sprint, onReviewSprint }: { sprint: ReadyFocusModel['sprint']; onReviewSprint?: () => void }) {
  return <div className="focus-flow__sprint-heading"><div><h1>{sprint.code}</h1><SprintTiming sprint={sprint} /></div>{onReviewSprint && <button aria-label="Review and close Sprint" className="focus-flow__button-quiet" onClick={onReviewSprint} type="button">Review Sprint <ChevronIcon direction="right" /></button>}</div>;
}

function FocusToolbar({ stories, selectedFilter, onStoryFilterChange, dragEnabled, compact, allStatuses, onAllStatusesChange }: { stories: readonly Story[]; selectedFilter: string; onStoryFilterChange: (value: string) => void; dragEnabled: boolean; compact: boolean; allStatuses: boolean; onAllStatusesChange: (value: boolean) => void }) {
  return <div className="focus-flow__board-toolbar">{stories.length > 1 && <StoryFilter stories={stories} value={selectedFilter} onChange={onStoryFilterChange} />}{dragEnabled && !compact && <label className="focus-flow__board-toggle"><input checked={allStatuses} onChange={(event) => onAllStatusesChange(event.currentTarget.checked)} type="checkbox" /> All statuses</label>}</div>;
}

function FocusBoards(props: { compact: boolean; completedBeforeSprint: ReadonlySet<string>; dragEnabled: boolean; mobileStatus: TaskStatus; onMobileStatusChange: (status: TaskStatus) => void; onMove: (request: MoveTaskRequest) => Promise<void>; onMoveTask?: FocusViewProps['onMoveTask']; onOpenNote?: FocusViewProps['onOpenNote']; pending: boolean; renderCreateTask: (story: Story) => ReactNode; renderEditTask: (task: Task) => ReactNode; statuses: readonly TaskStatus[]; stories: readonly Story[]; tasks: readonly Task[] }) {
  const disabled = props.pending || !props.onMoveTask;
  if (props.dragEnabled && !props.compact) return <DesktopBoard renderEditTask={props.renderEditTask} renderCreateTask={props.renderCreateTask} completedBeforeSprint={props.completedBeforeSprint} onMove={props.onMove} onOpenNote={props.onOpenNote} pending={disabled} stories={props.stories} tasks={props.tasks} statuses={props.statuses} />;
  return <MobileBoard renderEditTask={props.renderEditTask} renderCreateTask={props.renderCreateTask} completedBeforeSprint={props.completedBeforeSprint} onMove={props.onMove} onOpenNote={props.onOpenNote} onStatusChange={props.onMobileStatusChange} pending={disabled} status={props.mobileStatus} stories={props.stories} tasks={props.tasks} />;
}

function OutcomeEditDialog({ editing, entities, onEditOutcome, onClose }: { editing: EditableOutcome | null; entities: readonly ProjectedManagedEntity[]; onEditOutcome?: FocusViewProps['onEditOutcome']; onClose: () => void }) {
  if (!editing || !onEditOutcome) return null;
  return <OutcomeEditor item={editing} suggestions={entities.flatMap((entity) => 'tags' in entity ? entity.tags : [])} onSave={onEditOutcome} onClose={onClose} />;
}

function visibleFocusModel(model: ReadyFocusModel, storyFilter: string, allStatuses: boolean) {
  const selectedFilter = model.stories.some((story) => story.id === storyFilter) ? storyFilter : '';
  const visibleStories = selectedFilter === '' ? model.stories : model.stories.filter((story) => story.id === storyFilter);
  const visibleTasks = selectedFilter === '' ? model.tasks : model.tasks.filter((task) => task.storyId === storyFilter);
  const coreStatuses: readonly TaskStatus[] = ['todo', 'today', 'in_progress', 'done'];
  const statuses = TASK_STATUS_ORDER.filter((status) => allStatuses || coreStatuses.includes(status) || visibleTasks.some((task) => task.status === status));
  return { selectedFilter, visibleStories, visibleTasks, statuses };
}

function useTaskMovement(onMoveTask: FocusViewProps['onMoveTask']) {
  const [confirmation, setConfirmation] = useState<MoveTaskRequest | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const move = async (request: MoveTaskRequest): Promise<void> => {
    if (onMoveTask === undefined) return;
    setMessage(null);
    try {
      const result = await onMoveTask(request);
      if (result.kind === 'confirmation-required') {
        setConfirmation(request);
        setMessage(result.message);
        return;
      }
      setConfirmation(null);
      setMessage(result.kind === 'rejected' ? result.message : null);
    } catch (error) {
      setConfirmation(null);
      setMessage(formatErrorMessage(error, 'Focus Flow could not move the Task'));
    }
  };
  return { confirmation, message, move };
}

function MoveMessage({ message, confirmation, move, pending }: ReturnType<typeof useTaskMovement> & { pending: boolean }) {
  if (!message) return null;
  return <div className="focus-flow__move-message" role="alert"><span>{message}</span>{confirmation && <button disabled={pending} onClick={() => void move({ ...confirmation, confirmWipExcess: true })} type="button">Move anyway</button>}</div>;
}

function TaskCreationPanel({
  stories,
  pending,
  onCreateTask,
}: {
  stories: readonly Story[];
  pending: boolean;
  onCreateTask?: FocusViewProps['onCreateTask'];
}) {
  const storyId = stories[0]?.id ?? '';
  const [details, setDetails] = useState<TaskCreationDetails>({ tags: [], bodyFields: {} });
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [confirmationRequired, setConfirmationRequired] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  const create = async (confirmWipExcess: boolean): Promise<void> => {
    if (onCreateTask === undefined || saving) return;
    setSaving(true);
    try {
      const requestDetails = taskDetailsOrUndefined(details);
      const result = requestDetails
        ? await onCreateTask(storyId, title.trim(), confirmWipExcess, requestDetails)
        : await onCreateTask(storyId, title.trim(), confirmWipExcess);
      if (result.kind === 'created') {
        setTitle('');
        setDetails({ tags: [], bodyFields: {} });
        setMessage(null);
        setConfirmationRequired(false);
        setOpen(false);
        return;
      }
      setMessage(result.message);
      setConfirmationRequired(result.kind === 'confirmation-required');
    } catch (error) {
      setMessage(formatErrorMessage(error, 'Could not add the Task. Your text is saved here; try again.'));
      setConfirmationRequired(false);
    } finally {
      setSaving(false);
    }
  };

  const story = stories[0];
  if (!onCreateTask || story === undefined) return null;

  return <>
    <button aria-label={`Create Task for ${story.key}`} className="focus-flow__icon-button" disabled={pending} onClick={() => setOpen(true)} title="Create Task" type="button"><PlusIcon /></button>
    <TaskCreationDialog confirmationRequired={confirmationRequired} create={create} details={details} message={message} onClose={() => setOpen(false)} onDetailsChange={setDetails} onTitleChange={setTitle} open={open} pending={pending} saving={saving} stories={stories} story={story} title={title} titleRef={titleRef} />
  </>;
}

function TaskCreationDialog({ open, story, stories, titleRef, saving, pending, title, details, message, confirmationRequired, create, onClose, onTitleChange, onDetailsChange }: {
  open: boolean;
  story: Story;
  stories: readonly Story[];
  titleRef: RefObject<HTMLInputElement | null>;
  saving: boolean;
  pending: boolean;
  title: string;
  details: TaskCreationDetails;
  message: string | null;
  confirmationRequired: boolean;
  create: (confirm: boolean) => Promise<void>;
  onClose: () => void;
  onTitleChange: (title: string) => void;
  onDetailsChange: (details: TaskCreationDetails) => void;
}) {
  if (!open) return null;
  const disabled = pending || saving;
  return <DialogSurface title="New Task" description={`${story.key} · ${story.title}`} initialFocusRef={titleRef} onClose={() => { if (!saving) onClose(); }}>
    <form className="focus-flow__task-dialog-form" onSubmit={(event) => { event.preventDefault(); void create(false); }}>
      <label><span>New Task</span><input aria-label="New Task" disabled={disabled} ref={titleRef} onChange={(event) => onTitleChange(event.currentTarget.value)} required value={title} /></label>
      <TaskFieldsEditor value={details} onChange={onDetailsChange} suggestions={stories.flatMap((item) => item.effectiveTags)} disabled={disabled} />
      <button className="focus-flow__button-primary" disabled={disabled || title.trim() === ''} type="submit">{saving ? 'Adding…' : 'Add Task'}</button>
    </form>
    {message !== null && <div className="focus-flow__task-create-message" role="alert"><span>{message}</span>{confirmationRequired && <button disabled={disabled} onClick={() => void create(true)} type="button">Add anyway</button>}</div>}
  </DialogSurface>;
}

function DesktopBoard({
  renderEditTask,
  stories,
  tasks,
  completedBeforeSprint,
  pending,
  onMove,
  onOpenNote,
  statuses,
  renderCreateTask,
}: {
  renderEditTask: (task: Task) => ReactNode;
  stories: readonly Story[];
  tasks: readonly Task[];
  completedBeforeSprint: ReadonlySet<string>;
  pending: boolean;
  onMove: (request: MoveTaskRequest) => Promise<void>;
  onOpenNote?: FocusViewProps['onOpenNote'];
  statuses: readonly TaskStatus[];
  renderCreateTask: (story: Story) => ReactNode;
}) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const moveFromDrag = (
    taskId: string,
    initialGroup: string,
    targetGroup: string,
    targetIndex: number,
  ): void => {
    const source = parseTaskGroup(initialGroup);
    const target = parseTaskGroup(targetGroup);
    if (source === null || target === null || source.storyId !== target.storyId) {
      return;
    }
    const storyTasks = tasksForStory(tasks, target.storyId);
    const task = storyTasks.find((candidate) => candidate.id === taskId);
    if (task) {
      void onMove(createMoveRequest(storyTasks, task, target.status, targetIndex));
    }
  };

  return (
    <BoardDragSurface onMove={moveFromDrag}>
      <section aria-label="Sprint kanban board" className="focus-flow__kanban" style={{ '--ff-columns': statuses.length } as CSSProperties} tabIndex={0}>
        <div className="focus-flow__kanban-content">
          <div className="focus-flow__kanban-grid focus-flow__kanban-headings">
            {statuses.map((status) => <header key={status}><h2><span aria-hidden="true" className={`focus-flow__status-dot focus-flow__status-dot--${status}`} />{TASK_STATUS_LABELS[status]}</h2><span>{tasksForStatus(tasks, status).length}</span></header>)}
          </div>
          {stories.length === 0 && <p className="focus-flow__lane-empty">Add Stories from Plan to begin.</p>}
          {stories.map((story) => {
            const storyTasks = tasksForStory(tasks, story.id);
            const isCollapsed = collapsed.has(story.id);
            return <section aria-label={`${story.key} Story lane`} className="focus-flow__kanban-swimlane" key={story.id}>
              <header className="focus-flow__swimlane-heading">
                <button aria-expanded={!isCollapsed} aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${story.key}`} className="focus-flow__disclosure-button" onClick={() => setCollapsed((current) => { const next = new Set(current); if (next.has(story.id)) next.delete(story.id); else next.add(story.id); return next; })} type="button"><ChevronIcon direction={isCollapsed ? 'right' : 'down'} /></button>
                <WorkTitleButton item={story} onOpenNote={onOpenNote} />
                <span>{storyTasks.length}</span>
                {renderCreateTask(story)}
              </header>
              {!isCollapsed && <div className="focus-flow__kanban-grid">
                {statuses.map((status) => <section aria-label={`${story.key} ${TASK_STATUS_LABELS[status]} tasks`} className="focus-flow__kanban-cell" key={status}>
                  <TaskList renderEditTask={renderEditTask} completedBeforeSprint={completedBeforeSprint} dragEnabled onMove={onMove} onOpenNote={onOpenNote} pending={pending} status={status} story={story} storyTasks={storyTasks} />
                </section>)}
              </div>}
            </section>;
          })}
        </div>
      </section>
    </BoardDragSurface>
  );
}

function MobileBoard({
  renderEditTask,
  stories,
  tasks,
  status,
  completedBeforeSprint,
  pending,
  onMove,
  onOpenNote,
  onStatusChange,
  renderCreateTask,
}: {
  renderEditTask: (task: Task) => ReactNode;
  stories: readonly Story[];
  tasks: readonly Task[];
  status: TaskStatus;
  completedBeforeSprint: ReadonlySet<string>;
  pending: boolean;
  onMove: (request: MoveTaskRequest) => Promise<void>;
  onOpenNote?: FocusViewProps['onOpenNote'];
  onStatusChange: (status: TaskStatus) => void;
  renderCreateTask: (story: Story) => ReactNode;
}) {
  const visibleStories = stories;
  return (
    <div className="focus-flow__mobile-board">
      <label className="focus-flow__column-picker">
        <span>Column</span>
        <select aria-label="Task column" value={status} onChange={(event) => onStatusChange(event.currentTarget.value as TaskStatus)}>
          {TASK_STATUS_ORDER.map((candidate) => <option key={candidate} value={candidate}>{TASK_STATUS_LABELS[candidate]} · {tasksForStatus(tasks, candidate).length}</option>)}
        </select>
      </label>
      <section aria-label={`${TASK_STATUS_LABELS[status]} tasks`} className="focus-flow__status-column">
        <header><h2><span aria-hidden="true" className={`focus-flow__status-dot focus-flow__status-dot--${status}`} />{TASK_STATUS_LABELS[status]}</h2><span>{tasksForStatus(tasks, status).length}</span></header>
        {visibleStories.length === 0 && <p className="focus-flow__lane-empty">No tasks in this column.</p>}
        {visibleStories.map((story) => (
          <section className="focus-flow__story-lane" key={story.id}>
            <header><WorkTitleButton item={story} onOpenNote={onOpenNote} />{renderCreateTask(story)}</header>
            <TaskList renderEditTask={renderEditTask} completedBeforeSprint={completedBeforeSprint} dragEnabled={false} onMove={onMove} onOpenNote={onOpenNote} pending={pending} status={status} story={story} storyTasks={tasksForStory(tasks, story.id)} />
          </section>
        ))}
      </section>
    </div>
  );
}

function TaskList({
  renderEditTask,
  storyTasks,
  story,
  status,
  dragEnabled,
  pending,
  completedBeforeSprint,
  onMove,
  onOpenNote,
}: {
  renderEditTask: (task: Task) => ReactNode;
  storyTasks: readonly Task[];
  story: Story;
  status: TaskStatus;
  dragEnabled: boolean;
  pending: boolean;
  completedBeforeSprint: ReadonlySet<string>;
  onMove: (request: MoveTaskRequest) => Promise<void>;
  onOpenNote?: FocusViewProps['onOpenNote'];
}) {
  const visible = tasksForStatus(storyTasks, status);
  return (
    <BoardDragAdapter
      disabled={pending}
      enabled={dragEnabled}
      group={`${story.id}:${status}`}
      itemClassName="focus-flow__board-task-item"
      items={visible.map((task) => ({
        id: task.id,
        label: `${task.key} ${task.title}`,
      }))}
      listClassName="focus-flow__board-task-list"
      managedByParent={dragEnabled}
      onMove={reorderHandler(visible, storyTasks, status, onMove)}
      renderItem={(_, index) => <TaskCard completedBeforeSprint={completedBeforeSprint} onMove={onMove} onOpenNote={onOpenNote} pending={pending} renderEditTask={renderEditTask} storyTasks={storyTasks} task={visible[index]!} />}
    />
  );
}

function reorderHandler(visible: readonly Task[], storyTasks: readonly Task[], status: TaskStatus, onMove: (request: MoveTaskRequest) => Promise<void>) {
  if (visible.length <= 1) return undefined;
  return (taskId: string, targetIndex: number) => {
    const task = visible.find((candidate) => candidate.id === taskId);
    if (task) void onMove(createMoveRequest(storyTasks, task, status, targetIndex));
  };
}

function TaskCard({ task, storyTasks, completedBeforeSprint, pending, onMove, onOpenNote, renderEditTask }: {
  task: Task;
  storyTasks: readonly Task[];
  completedBeforeSprint: ReadonlySet<string>;
  pending: boolean;
  onMove: (request: MoveTaskRequest) => Promise<void>;
  onOpenNote?: FocusViewProps['onOpenNote'];
  renderEditTask: (task: Task) => ReactNode;
}) {
  const editAction = renderEditTask(task);
  const priorDone = completedBeforeSprint.has(task.id);
  const nextStatus = nextTaskStatus(task.status);
  const nextLabel = nextStatus === null ? '' : taskActionLabel(nextStatus);
  const destinations = allowedTaskDestinations(task.status);
  return <article className="focus-flow__board-task" data-completed-before-sprint={priorDone ? 'true' : undefined}>
    {nextStatus && <button aria-label={`${nextLabel} ${task.key}`} className="focus-flow__task-next" disabled={pending} onClick={() => void onMove(createMoveRequest(storyTasks, task, nextStatus, tasksForStatus(storyTasks, nextStatus).length))} title={nextLabel} type="button"><TaskActionIcon status={nextStatus} /></button>}
    <WorkTitleButton item={task} onOpenNote={onOpenNote} />
    {priorDone && <span className="focus-flow__prior-done">Done before Sprint</span>}
    {(editAction || destinations.length > 0) && <ActionMenu label={`More actions for ${task.key}`}>{editAction}{destinations.map((destination) => <MenuAction disabled={pending} key={destination} onClick={() => void onMove(createMoveRequest(storyTasks, task, destination, tasksForStatus(storyTasks, destination).length))}>Move to {TASK_STATUS_LABELS[destination]}</MenuAction>)}</ActionMenu>}
  </article>;
}

function nextTaskStatus(status: TaskStatus): TaskStatus | null {
  if (status === 'in_progress') return 'done';
  if (status === 'today') return 'in_progress';
  if (status === 'todo' || status === 'tomorrow') return 'today';
  return null;
}

function taskActionLabel(status: TaskStatus) {
  if (status === 'done') return 'Complete';
  if (status === 'in_progress') return 'Start';
  return 'Select for Today';
}

function TaskActionIcon({ status }: { status: TaskStatus }) {
  if (status === 'in_progress') return <PlayIcon />;
  if (status === 'done') return <CheckIcon />;
  return <PlusIcon />;
}

function taskDetailsOrUndefined(details: TaskCreationDetails): TaskCreationDetails | undefined {
  return details.tags.length > 0 || Object.keys(details.bodyFields).length > 0 ? details : undefined;
}

function UnavailableFocus({ kind, onPlan }: { kind: 'empty' | 'invalid'; onPlan?: () => void }) {
  return (
    <section className="focus-flow__empty-state">
      <h1>{kind === 'empty' ? 'No active sprint' : 'Focus unavailable'}</h1>
      <p role={kind === 'invalid' ? 'alert' : undefined}>
        {kind === 'empty'
          ? 'Plan a sprint to start moving tasks through Focus.'
          : 'Multiple Active Sprints need attention.'}
      </p>
      {kind === 'empty' && onPlan && <button className="focus-flow__button-primary" onClick={onPlan} type="button">Plan a Sprint <ChevronIcon direction="right" /></button>}
    </section>
  );
}

function focusModel(entities: readonly ProjectedManagedEntity[]) {
  const active = entities.filter(
    (entity): entity is Extract<Sprint, { lifecycle: 'active' }> =>
      entity.type === 'sprint' && entity.lifecycle === 'active',
  );
  if (active.length === 0) return { kind: 'empty' as const };
  if (active.length > 1) return { kind: 'invalid' as const };
  const sprint = active[0]!;
  const stories = entities
    .filter(
      (entity): entity is Story =>
        entity.type === 'story' &&
        entity.lifecycle === 'active_sprint' &&
        entity.sprintId === sprint.id,
    )
    .sort((left, right) =>
      compareRank(left.sprintRank ?? '', right.sprintRank ?? '', left.id, right.id),
    );
  const storyIds = new Set(stories.map((story) => story.id));
  const tasks = entities.filter(
    (entity): entity is Task =>
      entity.type === 'task' && storyIds.has(entity.storyId),
  );
  const completedBeforeSprint = new Set(
    sprint.startSnapshot.stories.flatMap((story) =>
      story.tasks.filter((task) => task.completedBeforeSprint).map((task) => task.id),
    ),
  );
  return { kind: 'ready' as const, sprint, stories, tasks, completedBeforeSprint };
}

function tasksForStory(tasks: readonly Task[], storyId: string): Task[] {
  return tasks.filter((task) => task.storyId === storyId);
}

function tasksForStatus(tasks: readonly Task[], status: TaskStatus): Task[] {
  return tasks
    .filter((task) => task.status === status)
    .sort((left, right) =>
      compareRank(left.taskRank, right.taskRank, left.id, right.id),
    );
}

function createMoveRequest(
  storyTasks: readonly Task[],
  task: Task,
  targetStatus: TaskStatus,
  index: number,
): MoveTaskRequest {
  const destination = tasksForStatus(storyTasks, targetStatus).filter(
    (candidate) => candidate.id !== task.id,
  );
  const targetIndex = Math.max(0, Math.min(index, destination.length));
  return {
    taskId: task.id,
    targetStatus,
    beforeTaskId: destination[targetIndex - 1]?.id ?? null,
    afterTaskId: destination[targetIndex]?.id ?? null,
    confirmWipExcess: false,
  };
}

function parseTaskGroup(
  group: string,
): { storyId: string; status: TaskStatus } | null {
  const separator = group.lastIndexOf(':');
  const storyId = group.slice(0, separator);
  const status = group.slice(separator + 1) as TaskStatus;
  return separator > 0 && TASK_STATUS_ORDER.includes(status)
    ? { storyId, status }
    : null;
}
