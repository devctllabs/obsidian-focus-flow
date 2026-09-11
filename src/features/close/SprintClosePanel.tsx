import { useState, type Dispatch, type SetStateAction } from 'react';
import type { ProjectedManagedEntity } from '../../application/indexing/work-index';
import type {
  CloseSprintRequest,
  TaskCloseDecision,
} from '../../application/closing/close-sprint';
import type { RetrospectiveDraft } from '../../domain/sprint-close';
import type { StoryEvaluationRequest } from '../../application/closing/evaluate-story';
import { compareRank } from '../../domain/ordering';
import { ReviewSteps } from './ReviewSteps';
import { CheckIcon, ChevronIcon } from '../ui/Icons';
import { CompactTags } from '../ui/Tags';
import { RetrospectiveEditor } from './RetrospectiveEditor';
import { DialogSurface } from '../ui/DialogSurface';
import { useLocalDate } from '../planning/useLocalDate';

type Story = Extract<ProjectedManagedEntity, { type: 'story' }>;
type Task = Extract<ProjectedManagedEntity, { type: 'task' }>;
type Epic = Extract<ProjectedManagedEntity, { type: 'epic' }>;
type ActiveSprint = Extract<ProjectedManagedEntity, { type: 'sprint'; lifecycle: 'active' }>;

interface SprintClosePanelProps {
  entities: readonly ProjectedManagedEntity[];
  pending?: boolean;
  today?: string;
  onEvaluateStory?: (request: StoryEvaluationRequest) => void;
  onCloseSprint?: (request: CloseSprintRequest) => void;
  onResumeClose?: () => void;
  onBack?: () => void;
}

interface EvaluationDraft {
  outcome: StoryEvaluationRequest['outcome'];
  evidence: string;
  exception: string;
}

const EMPTY_EVALUATION: EvaluationDraft = {
  outcome: 'not_achieved',
  evidence: '',
  exception: '',
};

export function SprintClosePanel({
  entities,
  pending = false,
  onEvaluateStory,
  onCloseSprint,
  onResumeClose,
  onBack,
  today: suppliedToday,
}: SprintClosePanelProps) {
  const today = useLocalDate(suppliedToday);
  const [earlyClose, setEarlyClose] = useState(false);
  const sprint = entities.find(
    (entity) => entity.type === 'sprint' && entity.lifecycle === 'active',
  );
  const [evaluations, setEvaluations] = useState<Record<string, EvaluationDraft>>({});
  const [taskDecisions, setTaskDecisions] = useState<Record<string, TaskCloseDecision>>({});
  const [monthPositions, setMonthPositions] = useState<Record<string, string>>({});
  const [inspect, setInspect] = useState(false);
  const [step, setStep] = useState(0);
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const [retrospective, setRetrospective] = useState<RetrospectiveDraft>({
    wins: [],
    friction: [],
    improvements: [],
  });
  if (sprint?.type !== 'sprint' || sprint.lifecycle !== 'active') return null;

  if (sprint.pendingClose) {
    return <CloseRecovery inspect={inspect} onInspect={() => setInspect((value) => !value)} onResumeClose={onResumeClose} pending={pending} sprint={sprint} />;
  }

  const model = closeReviewModel({ entities, sprint, evaluations, taskDecisions, monthPositions });
  return <SprintCloseReview earlyClose={earlyClose} evaluations={evaluations} model={model} monthPositions={monthPositions} onBack={onBack} onCloseSprint={onCloseSprint} onEarlyCloseChange={setEarlyClose} onEvaluateStory={onEvaluateStory} onEvaluationsChange={setEvaluations} onMonthPositionsChange={setMonthPositions} onRetrospectiveChange={setRetrospective} onSelectedStoryChange={setSelectedStoryId} onStepChange={setStep} onTaskDecisionsChange={setTaskDecisions} pending={pending} retrospective={retrospective} selectedStoryId={selectedStoryId} sprint={sprint} step={step} taskDecisions={taskDecisions} today={today} />;
}

type ProvisionalOutcome = ActiveSprint['provisionalStoryOutcomes'][number];

interface CloseReviewModel {
  stories: Story[];
  backlogStories: Story[];
  epicStories: Story[];
  epics: Epic[];
  tasks: Task[];
  openTasks: Task[];
  outcomes: Map<string, ProvisionalOutcome>;
  continuingStories: Story[];
  reviewed: number;
  placedStories: number;
  resolvedTasks: number;
  canClose: boolean;
}

function closeReviewModel({ entities, sprint, evaluations, taskDecisions, monthPositions }: { entities: readonly ProjectedManagedEntity[]; sprint: ActiveSprint; evaluations: Record<string, EvaluationDraft>; taskDecisions: Record<string, TaskCloseDecision>; monthPositions: Record<string, string> }): CloseReviewModel {
  const stories = entities
    .filter(
      (entity): entity is Story =>
        entity.type === 'story' &&
        entity.lifecycle === 'active_sprint' &&
        entity.sprintId === sprint.id,
    )
    .sort((left, right) =>
      compareRank(left.sprintRank!, right.sprintRank!, left.id, right.id),
    );
  const backlogStories = entities.filter(
    (entity): entity is Story =>
      entity.type === 'story' && entity.lifecycle === 'backlog',
  );
  const epicStories = entities.filter(
    (entity): entity is Story =>
      entity.type === 'story' && entity.lifecycle === 'epic_backlog',
  );
  const epics = entities.filter(
    (entity): entity is Epic =>
      entity.type === 'epic' && entity.lifecycle === 'backlog',
  );
  const storyIds = new Set(stories.map((story) => story.id));
  const tasks = entities.filter(
    (entity): entity is Task =>
      entity.type === 'task' && storyIds.has(entity.storyId),
  );
  const openTasks = tasks.filter((task) => task.lifecycle === 'active');
  const outcomes = new Map(
    sprint.provisionalStoryOutcomes.map((outcome) => [outcome.storyId, outcome]),
  );
  const reviewed = stories.filter((story) => storyEvaluationSaved(story, outcomes.get(story.id), evaluations[story.id])).length;
  const continuingStories = stories.filter((story) => outcomes.get(story.id)?.outcome === 'not_achieved');
  const placedStories = continuingStories.filter((story) => monthPositions[story.id] === '__end__' || backlogStories.some((target) => target.id === monthPositions[story.id])).length;
  const targetStories = [...backlogStories, ...epicStories, ...continuingStories];
  const resolvedTasks = openTasks.filter((task) => taskDecisionResolved(task, taskDecisions[task.id], { outcomes, targetStories, epics })).length;
  const canClose = stories.length > 0 && reviewed === stories.length && placedStories === continuingStories.length && resolvedTasks === openTasks.length;
  return { stories, backlogStories, epicStories, epics, tasks, openTasks, outcomes, continuingStories, reviewed, placedStories, resolvedTasks, canClose };
}

function storyEvaluationSaved(story: Story, saved: ActiveSprint['provisionalStoryOutcomes'][number] | undefined, draft: EvaluationDraft | undefined) {
  if (!saved) return false;
  const hasUnmetCriteria = story.acceptanceCriteria.some((criterion) => !criterion.checked);
  if (saved.outcome === 'achieved' && hasUnmetCriteria && !saved.acceptanceExceptionReason?.trim()) return false;
  if (!draft) return true;
  return draftMatchesSaved(draft, saved, hasUnmetCriteria);
}

function draftMatchesSaved(draft: EvaluationDraft, saved: ProvisionalOutcome, hasUnmetCriteria: boolean) {
  if (draft.outcome !== saved.outcome || draft.evidence.trim() !== saved.evidence) return false;
  if (draft.outcome !== 'achieved' || !hasUnmetCriteria) return true;
  return draft.exception.trim() === (saved.acceptanceExceptionReason ?? '');
}

function taskDecisionResolved(task: Task, decision: TaskCloseDecision | undefined, context: { outcomes: ReadonlyMap<string, ProvisionalOutcome>; targetStories: readonly Story[]; epics: readonly Epic[] }) {
  if (!decision) return false;
  if (decision.resolution === 'continue') return context.outcomes.get(task.storyId)?.outcome === 'not_achieved';
  if (decision.resolution === 'move') return context.targetStories.some((target) => target.id === decision.targetStoryId);
  if (decision.resolution === 'reclassify') return context.epics.some((epic) => epic.id === decision.targetEpicId);
  return decision.resolution === 'irrelevant';
}

function reviewRows(model: CloseReviewModel) {
  return [
    { title: 'Story outcomes', done: model.reviewed, total: model.stories.length, step: 1, detail: model.reviewed === model.stories.length ? 'All outcomes saved' : `${model.stories.length - model.reviewed} ${model.stories.length - model.reviewed === 1 ? 'Story needs' : 'Stories need'} an outcome` },
    { title: 'Unfinished tasks', done: model.resolvedTasks, total: model.openTasks.length, step: 2 },
    ...(model.continuingStories.length > 0 ? [{ title: 'Month backlog positions', done: model.placedStories, total: model.continuingStories.length, step: 1 }] : []),
  ];
}

function CloseRecovery({ sprint, pending, inspect, onInspect, onResumeClose }: { sprint: ActiveSprint; pending: boolean; inspect: boolean; onInspect: () => void; onResumeClose?: () => void }) {
  return <section className="focus-flow__close-recovery" aria-labelledby="close-recovery-title"><h2 id="close-recovery-title">Sprint close needs recovery</h2><p>The reviewed decisions are durable; the Sprint is not Closed yet.</p><button type="button" disabled={pending} onClick={onResumeClose}>Resume close</button><button type="button" onClick={onInspect}>Inspect changes</button>{inspect && <dl><dt>Operation</dt><dd>{sprint.pendingClose!.operationId}</dd><dt>Stories</dt><dd>{sprint.pendingClose!.stories.length}</dd><dt>Tasks</dt><dd>{sprint.pendingClose!.tasks.length}</dd></dl>}</section>;
}

function SprintCloseReview(props: { earlyClose: boolean; evaluations: Record<string, EvaluationDraft>; model: CloseReviewModel; monthPositions: Record<string, string>; onBack?: () => void; onCloseSprint?: SprintClosePanelProps['onCloseSprint']; onEarlyCloseChange: (value: boolean) => void; onEvaluateStory?: SprintClosePanelProps['onEvaluateStory']; onEvaluationsChange: Dispatch<SetStateAction<Record<string, EvaluationDraft>>>; onMonthPositionsChange: Dispatch<SetStateAction<Record<string, string>>>; onRetrospectiveChange: (value: RetrospectiveDraft) => void; onSelectedStoryChange: (id: string) => void; onStepChange: Dispatch<SetStateAction<number>>; onTaskDecisionsChange: Dispatch<SetStateAction<Record<string, TaskCloseDecision>>>; pending: boolean; retrospective: RetrospectiveDraft; selectedStoryId: string | null; sprint: ActiveSprint; step: number; taskDecisions: Record<string, TaskCloseDecision>; today: string }) {
  const { model, evaluations, monthPositions, retrospective, sprint, step, pending, onBack, onCloseSprint, onEvaluateStory, today } = props;
  const { stories, openTasks, outcomes, canClose } = model;
  const selectedStory = stories.find((story) => story.id === props.selectedStoryId) ?? stories[0];
  const setEvaluations = props.onEvaluationsChange;
  const setMonthPositions = props.onMonthPositionsChange;
  const setTaskDecisions = props.onTaskDecisionsChange;
  const taskDecisions = props.taskDecisions;
  const setStep = props.onStepChange;
  const setSelectedStoryId = props.onSelectedStoryChange;
  const reviewChecklistRows = reviewRows(model);

  const updateEvaluation = (storyId: string, update: Partial<EvaluationDraft>) => {
    setEvaluations((current) => ({
      ...current,
      [storyId]: { ...(current[storyId] ?? EMPTY_EVALUATION), ...update },
    }));
  };
  const submitClose = () => {
    const storyReinsertions = stories
      .filter((story) => outcomes.get(story.id)?.outcome === 'not_achieved')
      .flatMap((story) => {
        const position = monthPositions[story.id];
        if (position === undefined || position === '__unselected__') return [];
        return [{ storyId: story.id, beforeStoryId: position === '__end__' ? null : position }];
      });
    onCloseSprint?.({
      storyReinsertions,
      taskDecisions: openTasks.flatMap((task) =>
        taskDecisions[task.id] ? [taskDecisions[task.id]!] : [],
      ),
      retrospective,
    });
  };

  return (
    <section className="focus-flow__mode focus-flow__close" aria-labelledby="sprint-review-title">
      <CloseHeading onBack={onBack} sprint={sprint} />
      <ReviewSteps step={step} onChange={setStep} />
      <CloseStepContent evaluations={evaluations} model={model} monthPositions={monthPositions} onEvaluateStory={onEvaluateStory} onMonthPositionsChange={setMonthPositions} onRetrospectiveChange={props.onRetrospectiveChange} onSelectedStoryChange={setSelectedStoryId} onStepChange={setStep} onTaskDecisionsChange={setTaskDecisions} onUpdateEvaluation={updateEvaluation} pending={pending} retrospective={retrospective} reviewRows={reviewChecklistRows} selectedStory={selectedStory} step={step} taskDecisions={taskDecisions} />
      <CloseNavigation canClose={canClose} onClose={() => { if (today < sprint.dueOn) props.onEarlyCloseChange(true); else submitClose(); }} onStepChange={setStep} pending={pending} step={step} supported={onCloseSprint !== undefined} />
      <EarlyCloseDialog onClose={() => props.onEarlyCloseChange(false)} onSubmit={submitClose} open={props.earlyClose} pending={pending} sprint={sprint} />
    </section>
  );
}

function CloseHeading({ sprint, onBack }: { sprint: ActiveSprint; onBack?: () => void }) {
  return <header className="focus-flow__page-heading focus-flow__close-heading"><div>{onBack && <button className="focus-flow__back-button" onClick={onBack} type="button"><ChevronIcon direction="left" /> Focus</button>}<h1 id="sprint-review-title">Review {sprint.code}</h1></div></header>;
}

function CloseStepContent(props: { evaluations: Record<string, EvaluationDraft>; model: CloseReviewModel; monthPositions: Record<string, string>; onEvaluateStory?: SprintClosePanelProps['onEvaluateStory']; onMonthPositionsChange: Dispatch<SetStateAction<Record<string, string>>>; onRetrospectiveChange: (value: RetrospectiveDraft) => void; onSelectedStoryChange: (id: string) => void; onStepChange: Dispatch<SetStateAction<number>>; onTaskDecisionsChange: Dispatch<SetStateAction<Record<string, TaskCloseDecision>>>; onUpdateEvaluation: (id: string, update: Partial<EvaluationDraft>) => void; pending: boolean; retrospective: RetrospectiveDraft; reviewRows: ReturnType<typeof reviewRows>; selectedStory?: Story; step: number; taskDecisions: Record<string, TaskCloseDecision> }) {
  if (props.step === 0) return <div className="focus-flow__close-content"><section className="focus-flow__close-overview"><h2>A moment to look back.</h2><p>What landed, what continues, and what did you learn?</p><dl><div><dt>Tasks completed</dt><dd>{props.model.tasks.filter((task) => task.status === 'done').length}<small> / {props.model.tasks.length}</small></dd></div></dl><ReviewChecklist rows={props.reviewRows} onSelect={props.onStepChange} /></section></div>;
  if (props.step === 1) return <div className="focus-flow__close-content"><OutcomeReviewStep backlogStories={props.model.backlogStories} evaluations={props.evaluations} monthPositions={props.monthPositions} model={props.model} onEvaluateStory={props.onEvaluateStory} onMonthPositionsChange={props.onMonthPositionsChange} onSelectedStoryChange={props.onSelectedStoryChange} onUpdateEvaluation={props.onUpdateEvaluation} pending={props.pending} selectedStory={props.selectedStory} /></div>;
  if (props.step === 2) return <div className="focus-flow__close-content"><TaskReviewStep decisions={props.taskDecisions} model={props.model} onChange={props.onTaskDecisionsChange} /></div>;
  if (props.step === 3) return <div className="focus-flow__close-content"><RetrospectiveEditor value={props.retrospective} onChange={props.onRetrospectiveChange} /></div>;
  return <div className="focus-flow__close-content"><CloseReviewSummary canClose={props.model.canClose} onEdit={() => props.onStepChange(3)} onSelect={props.onStepChange} retrospective={props.retrospective} rows={props.reviewRows} /></div>;
}

function CloseReviewSummary({ canClose, rows, retrospective, onSelect, onEdit }: { canClose: boolean; rows: ReturnType<typeof reviewRows>; retrospective: RetrospectiveDraft; onSelect: (step: number) => void; onEdit: () => void }) {
  return <section className="focus-flow__close-review"><h2>Review the close</h2><p>{canClose ? 'Everything is ready. Save this Sprint to History.' : 'A few decisions still need your attention.'}</p><ReviewChecklist rows={rows} onSelect={onSelect} /><div className="focus-flow__reflection-preview">{(['wins', 'friction', 'improvements'] as const).map((key) => <section key={key}><h3>{key[0]!.toUpperCase() + key.slice(1)}</h3>{retrospective[key].some((item) => item.trim()) ? <ul>{retrospective[key].filter((item) => item.trim()).map((item, index) => <li key={index}>{item}</li>)}</ul> : <p>Nothing noted</p>}</section>)}</div><button className="focus-flow__button-quiet" onClick={onEdit} type="button">Edit reflection</button></section>;
}

function CloseNavigation({ step, pending, canClose, supported, onStepChange, onClose }: { step: number; pending: boolean; canClose: boolean; supported: boolean; onStepChange: Dispatch<SetStateAction<number>>; onClose: () => void }) {
  if (step < 4) return <div className="focus-flow__close-navigation"><button className="focus-flow__button-quiet" onClick={() => onStepChange((current) => Math.min(4, current + 1))} type="button">{['Review outcomes', 'Review tasks', 'Add reflection', 'Review & close'][step]}<ChevronIcon direction="right" /></button></div>;
  return <div className="focus-flow__close-navigation"><button type="button" className="focus-flow__button-primary" disabled={pending || !supported || !canClose} onClick={onClose}>Close Sprint</button></div>;
}

function EarlyCloseDialog({ sprint, open, pending, onClose, onSubmit }: { sprint: ActiveSprint; open: boolean; pending: boolean; onClose: () => void; onSubmit: () => void }) {
  if (!open) return null;
  const close = () => { onClose(); onSubmit(); };
  return <DialogSurface title={`Close ${sprint.code} early?`} onClose={() => { if (!pending) onClose(); }}><p>This saves a boundary in History. The current calendar week ends on {sprint.dueOn}; another Sprint cannot start in the same window.</p><p>If you want to keep working, add a ready Story from Month backlog to this Active Sprint instead.</p><p>Only the latest Closed Sprint can be reopened, before another Sprint starts. Cancel any Draft first.</p><div className="focus-flow__dialog-actions"><button type="button" disabled={pending} onClick={onClose}>Keep Sprint open</button><button type="button" className="focus-flow__button-primary" disabled={pending} onClick={close}>Close early</button></div></DialogSurface>;
}

function OutcomeReviewStep({ model, selectedStory, evaluations, monthPositions, backlogStories, pending, onSelectedStoryChange, onUpdateEvaluation, onEvaluateStory, onMonthPositionsChange }: {
  model: CloseReviewModel;
  selectedStory: Story | undefined;
  evaluations: Record<string, EvaluationDraft>;
  monthPositions: Record<string, string>;
  backlogStories: readonly Story[];
  pending: boolean;
  onSelectedStoryChange: (id: string) => void;
  onUpdateEvaluation: (id: string, update: Partial<EvaluationDraft>) => void;
  onEvaluateStory?: SprintClosePanelProps['onEvaluateStory'];
  onMonthPositionsChange: Dispatch<SetStateAction<Record<string, string>>>;
}) {
  return <div className="focus-flow__outcome-workspace">
    <nav aria-label="Stories to review" className="focus-flow__outcome-stories">{model.stories.map((story) => <button aria-label={`Review ${story.key}`} aria-current={selectedStory?.id === story.id ? 'true' : undefined} key={story.id} onClick={() => onSelectedStoryChange(story.id)} type="button"><span className="focus-flow__key">{story.key}</span><span>{story.title}</span><small>{model.outcomes.get(story.id)?.outcome.replace('_', ' ') ?? 'To review'}</small></button>)}</nav>
    <div className="focus-flow__story-evaluations">{selectedStory && <StoryEvaluationCard backlogStories={backlogStories} draft={evaluationDraft(selectedStory, model.outcomes.get(selectedStory.id), evaluations[selectedStory.id])} monthPosition={monthPositions[selectedStory.id]} onEvaluateStory={onEvaluateStory} onMonthPositionChange={(value) => onMonthPositionsChange((current) => ({ ...current, [selectedStory.id]: value }))} onUpdate={(update) => onUpdateEvaluation(selectedStory.id, update)} pending={pending} saved={model.outcomes.get(selectedStory.id)} story={selectedStory} tasks={model.tasks} />}</div>
  </div>;
}

function evaluationDraft(_story: Story, saved: ProvisionalOutcome | undefined, draft: EvaluationDraft | undefined): EvaluationDraft {
  if (draft) return draft;
  if (!saved) return EMPTY_EVALUATION;
  return { outcome: saved.outcome, evidence: saved.evidence, exception: saved.acceptanceExceptionReason ?? '' };
}

function StoryEvaluationCard({ story, tasks, saved, draft, backlogStories, monthPosition, pending, onUpdate, onEvaluateStory, onMonthPositionChange }: { story: Story; tasks: readonly Task[]; saved?: ProvisionalOutcome; draft: EvaluationDraft; backlogStories: readonly Story[]; monthPosition?: string; pending: boolean; onUpdate: (update: Partial<EvaluationDraft>) => void; onEvaluateStory?: SprintClosePanelProps['onEvaluateStory']; onMonthPositionChange: (value: string) => void }) {
  const ready = tasks.filter((task) => task.storyId === story.id).every((task) => task.status === 'done');
  const needsException = draft.outcome === 'achieved' && story.acceptanceCriteria.some((criterion) => !criterion.checked);
  const save = () => onEvaluateStory?.({ storyId: story.id, outcome: draft.outcome, evidence: draft.evidence, ...(needsException ? { acceptanceExceptionReason: draft.exception } : {}) });
  return <article className="focus-flow__story-evaluation">
    <EvaluationHeader ready={ready} saved={Boolean(saved)} story={story} />
    <AcceptanceCriteria story={story} />
    <div className="focus-flow__outcome-choices" role="group" aria-label={`Outcome for ${story.key}`}>{([['achieved', 'Achieved'], ['not_achieved', 'Not achieved'], ['closed', 'Closed']] as const).map(([value, label]) => <button aria-pressed={draft.outcome === value} data-outcome={value} key={value} onClick={() => onUpdate({ outcome: value })} type="button">{label}</button>)}</div>
    <label><span>Reflection <small>(optional)</small></span><textarea aria-label={`Reflection for ${story.key}`} placeholder="What is worth remembering about this Story?" rows={3} value={draft.evidence} onChange={(event) => onUpdate({ evidence: event.currentTarget.value })} /></label>
    {needsException && <label>Why is it achieved with unmet criteria?<textarea aria-label={`Acceptance Criteria exception for ${story.key}`} rows={2} value={draft.exception} onChange={(event) => onUpdate({ exception: event.currentTarget.value })} /></label>}
    <SaveEvaluationButton draft={draft} needsException={needsException} onSave={save} pending={pending} saved={Boolean(saved)} story={story} supported={Boolean(onEvaluateStory)} />
    <MonthPosition backlogStories={backlogStories} monthPosition={monthPosition} onChange={onMonthPositionChange} saved={saved} story={story} />
  </article>;
}

function EvaluationHeader({ story, ready, saved }: { story: Story; ready: boolean; saved: boolean }) {
  return <header><h2>{story.key} {story.title}</h2><CompactTags tags={story.effectiveTags} /><p>{ready ? 'Ready to evaluate' : 'Tasks still need triage'}{saved ? ' · Evaluation saved' : ''}</p></header>;
}

function SaveEvaluationButton({ story, draft, needsException, pending, supported, saved, onSave }: { story: Story; draft: EvaluationDraft; needsException: boolean; pending: boolean; supported: boolean; saved: boolean; onSave: () => void }) {
  const disabled = pending || !supported || (needsException && !draft.exception.trim());
  const label = pending ? 'Saving…' : saved ? 'Update outcome' : 'Save outcome';
  return <button type="button" className="focus-flow__button-primary focus-flow__save-evaluation" disabled={disabled} aria-label={`Save evaluation for ${story.key}`} onClick={onSave}>{label}</button>;
}

function MonthPosition({ story, saved, backlogStories, monthPosition, onChange }: { story: Story; saved?: ProvisionalOutcome; backlogStories: readonly Story[]; monthPosition?: string; onChange: (value: string) => void }) {
  if (saved?.outcome !== 'not_achieved') return null;
  return <label>Return to Month backlog<select aria-label={`Month position for ${story.key}`} value={monthPosition ?? '__unselected__'} onChange={(event) => onChange(event.currentTarget.value)}><option value="__unselected__">Choose position…</option>{backlogStories.map((target) => <option key={target.id} value={target.id}>Before {target.key} {target.title}</option>)}<option value="__end__">End of Month</option></select></label>;
}

function AcceptanceCriteria({ story }: { story: Story }) {
  if (story.acceptanceCriteria.length === 0) return null;
  return <ul className="focus-flow__review-criteria" aria-label="Acceptance Criteria">{story.acceptanceCriteria.map((criterion, index) => <li key={index} data-checked={criterion.checked}><span role="img" aria-label={criterion.checked ? 'Met' : 'Not met'}>{criterion.checked ? <CheckIcon /> : <span className="focus-flow__criterion-open" />}</span>{criterion.text}</li>)}</ul>;
}

function TaskReviewStep({ model, decisions, onChange }: { model: CloseReviewModel; decisions: Record<string, TaskCloseDecision>; onChange: Dispatch<SetStateAction<Record<string, TaskCloseDecision>>> }) {
  const updateDetails = (taskId: string, update: Partial<TaskCloseDecision>) => onChange((current) => ({ ...current, [taskId]: { ...current[taskId], taskId, ...update } as TaskCloseDecision }));
  const updateResolution = (taskId: string, resolution: TaskCloseDecision['resolution']) => onChange((current) => ({ ...current, [taskId]: { taskId, resolution } }));
  return <section className="focus-flow__close-task-step"><h2>{model.openTasks.length > 0 ? 'Resolve unfinished Tasks' : 'No unfinished Tasks'}</h2>{model.openTasks.map((task) => <TaskTriage decision={decisions[task.id]} epics={model.epics} key={task.id} onChange={(update) => updateDetails(task.id, update)} onResolutionChange={(resolution) => updateResolution(task.id, resolution)} stories={[...model.stories, ...model.backlogStories, ...model.epicStories]} task={task} />)}</section>;
}

function TaskTriage({ task, decision, stories, epics, onChange, onResolutionChange }: { task: Task; decision?: TaskCloseDecision; stories: readonly Story[]; epics: readonly Epic[]; onChange: (update: Partial<TaskCloseDecision>) => void; onResolutionChange: (resolution: TaskCloseDecision['resolution']) => void }) {
  return <div className="focus-flow__task-triage">
    <header><div><strong>{task.key} {task.title}</strong><CompactTags tags={task.effectiveTags} /></div><label><span className="focus-flow__sr-only">Resolution for {task.key}</span><select aria-label={`Resolution for ${task.key}`} value={decision?.resolution ?? ''} onChange={(event) => onResolutionChange(event.currentTarget.value as TaskCloseDecision['resolution'])}><option value="">Decide…</option><option value="continue">Continue with same Story</option><option value="move">Move to another Story</option><option value="reclassify">Reclassify as Story</option><option value="irrelevant">Close as irrelevant</option></select></label></header>
    <TaskDecisionFields decision={decision} epics={epics} onChange={onChange} stories={stories.filter((story) => story.id !== task.storyId)} task={task} />
  </div>;
}

function TaskDecisionFields({ task, decision, stories, epics, onChange }: { task: Task; decision?: TaskCloseDecision; stories: readonly Story[]; epics: readonly Epic[]; onChange: (update: Partial<TaskCloseDecision>) => void }) {
  if (!decision) return null;
  return <>{(decision.resolution === 'continue' || decision.resolution === 'move') && <label>Context (optional)<textarea aria-label={`Continuation context for ${task.key}`} rows={2} placeholder="Where should you pick this up?" value={decision.continuationContext ?? ''} onChange={(event) => onChange({ continuationContext: event.currentTarget.value })} /></label>}{decision.resolution === 'move' && <label>Move to Story<select aria-label={`Target Story for ${task.key}`} value={decision.targetStoryId ?? ''} onChange={(event) => onChange({ targetStoryId: event.currentTarget.value })}><option value="">Choose Story…</option>{stories.map((target) => <option key={target.id} value={target.id}>{target.key} {target.title}</option>)}</select></label>}{decision.resolution === 'reclassify' && <label>Parent Epic<select aria-label={`Parent Epic for ${task.key}`} value={decision.targetEpicId ?? ''} onChange={(event) => onChange({ targetEpicId: event.currentTarget.value })}><option value="">Choose Epic…</option>{epics.map((epic) => <option key={epic.id} value={epic.id}>{epic.key} {epic.title}</option>)}</select></label>}</>;
}

function ReviewChecklist({ rows, onSelect }: { rows: readonly { title: string; done: number; total: number; step: number; detail?: string }[]; onSelect: (step: number) => void }) {
  return <ul className="focus-flow__review-checklist">{rows.map((row) => <li key={row.title}><button aria-label={`Review ${row.title}`} onClick={() => onSelect(row.step)} type="button"><span className="focus-flow__review-check" data-ready={row.done === row.total}>{row.done === row.total ? <CheckIcon /> : <span className="focus-flow__criterion-open" />}</span><span>{row.title}</span><small>{row.detail ?? `${row.done} / ${row.total}`}</small><ChevronIcon direction="right" /></button></li>)}</ul>;
}
