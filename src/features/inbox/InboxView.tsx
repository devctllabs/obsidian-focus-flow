import { useMemo, useRef, useState, type RefObject } from 'react';
import type { ProjectedManagedEntity } from '../../application/indexing/work-index';
import { compareOrdinal } from '../../domain/ordering';
import type { InboxSection } from '../../obsidian/views/view-state';
import { WorkTitleButton } from '../work/WorkTitleButton';
import { ActionMenu, MenuAction } from '../ui/ActionMenu';
import { DialogSurface } from '../ui/DialogSurface';
import { CloseIcon, SearchIcon, FilterIcon } from '../ui/Icons';
import { TagFilterPicker } from './TagFilterPicker';
import { CandidateForm } from './CandidateForm';
import type { EditCandidateRequest } from '../../application/work/edit-candidate';
import type { CandidateAcceptanceFields } from '../../application/work/triage-candidate';
import { CandidatePromotion } from './CandidatePromotion';
import { formatErrorMessage } from '../ui/error-message';
import { TagChip } from '../ui/Tags';

type Candidate = Extract<ProjectedManagedEntity, { type: 'candidate' }>;
type InboxCandidate = Extract<Candidate, { lifecycle: 'inbox' }>;
type Distraction = Extract<Candidate, { lifecycle: 'rejected' }>;
type Epic = Extract<ProjectedManagedEntity, { type: 'epic'; lifecycle: 'backlog' }>;

interface InboxViewProps {
  entities: readonly ProjectedManagedEntity[];
  section?: InboxSection;
  onSectionChange?: (section: InboxSection) => void;
  onAcceptAsEpic?: (candidateId: string, fields?: CandidateAcceptanceFields) => void | Promise<unknown>;
  onAcceptAsStory?: (candidateId: string, epicId: string, fields?: CandidateAcceptanceFields) => void | Promise<unknown>;
  onReject?: (candidateId: string, reason: string | null) => void;
  onReconsider?: (candidateId: string) => void;
  onDeleteDistraction?: (candidateId: string) => Promise<unknown>;
  onEditCandidate?: (request: EditCandidateRequest) => Promise<unknown>;
  onRequestDelete?: (candidate: InboxCandidate) => void;
  onOpenNote?: (path: string, event: MouseEvent) => void;
  missionMissing?: boolean;
  onCreateMission?: () => void;
  pending?: boolean;
}

type Decision =
  | { kind: 'edit'; candidate: Candidate }
  | { kind: 'story'; candidate: InboxCandidate }
  | { kind: 'epic'; candidate: InboxCandidate }
  | { kind: 'reject'; candidate: InboxCandidate }
  | { kind: 'reconsider'; candidate: Distraction }
  | { kind: 'delete'; candidate: Distraction }
  | null;

interface TagPickerRequest {
  hintedTags: readonly string[];
}

export function InboxView({
  entities,
  section = 'candidates',
  onSectionChange,
  onAcceptAsEpic,
  onAcceptAsStory,
  onReject,
  onReconsider,
  onDeleteDistraction,
  onEditCandidate,
  onRequestDelete,
  onOpenNote,
  missionMissing = false,
  onCreateMission,
  pending = false,
}: InboxViewProps) {
  const [query, setQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<ReadonlySet<string>>(new Set());
  const [decision, setDecision] = useState<Decision>(null);
  const [missionDismissed, setMissionDismissed] = useState(false);
  const [tagPickerRequest, setTagPickerRequest] = useState<TagPickerRequest | null>(null);
  const tagTriggerRef = useRef<HTMLButtonElement>(null);

  const candidates = useMemo(() => entities
    .filter((entity): entity is Candidate => entity.type === 'candidate')
    .sort((left, right) => {
      if (left.lifecycle === 'rejected' && right.lifecycle === 'rejected') {
        return Date.parse(right.rejectedAt) - Date.parse(left.rejectedAt);
      }
      return Date.parse(left.createdAt) - Date.parse(right.createdAt) || compareOrdinal(left.key, right.key);
    }), [entities]);
  const epics = useMemo(() => entities
    .filter((entity): entity is Epic => entity.type === 'epic' && entity.lifecycle === 'backlog')
    .sort((left, right) => compareOrdinal(left.backlogRank, right.backlogRank)), [entities]);
  const inSection = candidates.filter((candidate) =>
    section === 'candidates' ? candidate.lifecycle === 'inbox' : candidate.lifecycle === 'rejected');
  const availableTags = Array.from(new Set(inSection.flatMap((candidate) => candidate.tags))).sort(compareOrdinal);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matchesQuery = (candidate: Candidate) => {
    const searchable = `${candidate.key} ${candidate.title} ${candidate.tags.join(' ')}`.toLocaleLowerCase();
    return searchable.includes(normalizedQuery);
  };
  const matchesTags = (candidate: Candidate, tags: ReadonlySet<string>) =>
    Array.from(tags).every((tag) => candidate.tags.includes(tag));
  const visible = inSection.filter((candidate) => matchesQuery(candidate) && matchesTags(candidate, selectedTags));
  const tagOptions = availableTags.map((tag) => ({
    tag,
    count: inSection.filter((candidate) => {
      const tagsWithoutCurrent = new Set(selectedTags);
      tagsWithoutCurrent.delete(tag);
      return matchesQuery(candidate) && matchesTags(candidate, tagsWithoutCurrent) && candidate.tags.includes(tag);
    }).length,
  }));

  const closeTagPicker = () => {
    setTagPickerRequest(null);
    tagTriggerRef.current?.focus();
  };
  const openTagPicker = (hintedTags: readonly string[] = [], initialTags?: readonly string[]) => {
    if (initialTags !== undefined) {
      setSelectedTags((current) => new Set([...current, ...initialTags]));
    }
    setTagPickerRequest({ hintedTags });
  };
  const clearFilters = () => setSelectedTags(new Set());
  const activeTags = Array.from(selectedTags).sort(compareOrdinal);
  const visibleActiveTags = activeTags.slice(0, 3);

  const changeSection = (next: InboxSection) => { setSelectedTags(new Set()); setTagPickerRequest(null); onSectionChange?.(next); };
  const toggleTag = (tag: string) => setSelectedTags((current) => toggledTags(current, tag));
  return <section className="focus-flow__mode focus-flow__inbox">
    <InboxHeader candidates={candidates} onSectionChange={changeSection} section={section} />
    <CandidateEditDialog decision={decision} entities={entities} onClose={() => setDecision(null)} onEdit={onEditCandidate} />
    <MissionPrompt dismissed={missionDismissed} missing={missionMissing} onCreate={onCreateMission} onDismiss={() => setMissionDismissed(true)} pending={pending} section={section} />
    <InboxFilters availableTags={availableTags} clearFilters={clearFilters} closeTagPicker={closeTagPicker} onQueryChange={setQuery} onToggleTag={toggleTag} openTagPicker={openTagPicker} query={query} section={section} selectedTags={selectedTags} tagOptions={tagOptions} tagPickerRequest={tagPickerRequest} tagTriggerRef={tagTriggerRef} />
    <ActiveTagFilters activeTags={activeTags} clearFilters={clearFilters} onRemove={toggleTag} selectedTags={selectedTags} visibleActiveTags={visibleActiveTags} />
    <CandidateResults clearFilters={clearFilters} epics={epics} onDecision={setDecision} onEditCandidate={onEditCandidate} onOpenNote={onOpenNote} onRequestDelete={onRequestDelete} onTagFilter={openTagPicker} pending={pending} query={query} section={section} selectedTags={selectedTags} visible={visible} capabilities={{ onAcceptAsEpic, onAcceptAsStory, onReject, onReconsider, onDeleteDistraction }} />
    <DecisionDialogs availableTags={availableTags} decision={decision} epics={epics} onAcceptAsEpic={onAcceptAsEpic} onAcceptAsStory={onAcceptAsStory} onClose={() => setDecision(null)} onDeleteDistraction={onDeleteDistraction} onReconsider={onReconsider} onReject={onReject} pending={pending} />
  </section>;
}

function InboxHeader({ candidates, section, onSectionChange }: { candidates: readonly Candidate[]; section: InboxSection; onSectionChange: (section: InboxSection) => void }) {
  const inboxCount = candidates.filter((candidate) => candidate.lifecycle === 'inbox').length;
  const rejectedCount = candidates.filter((candidate) => candidate.lifecycle === 'rejected').length;
  return <header className="focus-flow__page-heading"><div><h1>Inbox</h1></div><div aria-label="Inbox section" className="focus-flow__segments" role="group"><button aria-pressed={section === 'candidates'} onClick={() => onSectionChange('candidates')} type="button">Candidates <span>{inboxCount}</span></button><button aria-pressed={section === 'distractions'} onClick={() => onSectionChange('distractions')} type="button">Distractions <span>{rejectedCount}</span></button></div></header>;
}

function CandidateEditDialog({ decision, entities, onEdit, onClose }: { decision: Decision; entities: readonly ProjectedManagedEntity[]; onEdit?: InboxViewProps['onEditCandidate']; onClose: () => void }) {
  if (decision?.kind !== 'edit' || !onEdit) return null;
  const candidate = decision.candidate;
  const suggestions = [...new Set(entities.flatMap((entity) => entity.type === 'sprint' ? [] : entity.tags))];
  return <DialogSurface title={`Edit ${candidate.key}`} onClose={onClose}><CandidateForm initialValue={candidate} suggestions={suggestions} onSave={(title, tags, bodyFields) => onEdit({ candidateId: candidate.id, title, tags, expectedTitle: candidate.title, expectedTags: candidate.tags, ...(bodyFields === undefined ? {} : { bodyFields, expectedBodyFields: candidate.bodyFields ?? {} }) })} onSaved={onClose} /></DialogSurface>;
}

function MissionPrompt({ section, missing, dismissed, pending, onCreate, onDismiss }: { section: InboxSection; missing: boolean; dismissed: boolean; pending: boolean; onCreate?: () => void; onDismiss: () => void }) {
  if (section !== 'candidates' || !missing || dismissed) return null;
  return <aside className="focus-flow__mission-note" role="note"><div><strong>Give your Inbox a direction</strong><p>MISSION.md is a quiet reference for deciding what belongs here.</p></div><div className="focus-flow__mission-actions"><button disabled={pending || onCreate === undefined} onClick={onCreate} type="button">Create and open</button><button className="focus-flow__button-quiet" onClick={onDismiss} type="button">Not now</button></div></aside>;
}

interface InboxFiltersProps {
  availableTags: readonly string[];
  clearFilters: () => void;
  closeTagPicker: () => void;
  onQueryChange: (query: string) => void;
  onToggleTag: (tag: string) => void;
  openTagPicker: () => void;
  query: string;
  section: InboxSection;
  selectedTags: ReadonlySet<string>;
  tagOptions: readonly { tag: string; count: number }[];
  tagPickerRequest: TagPickerRequest | null;
  tagTriggerRef: RefObject<HTMLButtonElement | null>;
}

function InboxFilters({ availableTags, clearFilters, closeTagPicker, onQueryChange, onToggleTag, openTagPicker, query, section, selectedTags, tagOptions, tagPickerRequest, tagTriggerRef }: InboxFiltersProps) {
  const label = section === 'candidates' ? 'Candidates' : 'Distractions';
  const pickerOpen = tagPickerRequest !== null;
  return <div className="focus-flow__filter-bar focus-flow__inbox-toolbar"><label className="focus-flow__search-field"><SearchIcon /><span className="focus-flow__sr-only">Search {label}</span><input aria-label={`Search ${label}`} onChange={(event) => onQueryChange(event.currentTarget.value)} placeholder={`Search ${label}`} type="search" value={query} /></label>{availableTags.length > 0 && <div className="focus-flow__tag-filter-control"><button aria-controls={pickerOpen ? 'focus-flow-tag-picker' : undefined} aria-expanded={pickerOpen} aria-haspopup="dialog" aria-label={`Filter by tags (${selectedTags.size} active)`} className="focus-flow__icon-button focus-flow__tag-filter-trigger" title="Filter by tags" onClick={pickerOpen ? closeTagPicker : () => openTagPicker()} ref={tagTriggerRef} type="button"><FilterIcon />{selectedTags.size > 0 && <span aria-hidden="true">{selectedTags.size}</span>}</button>{tagPickerRequest && <TagFilterPicker id="focus-flow-tag-picker" hintedTags={tagPickerRequest.hintedTags} onClear={clearFilters} onClose={closeTagPicker} onToggle={onToggleTag} options={tagOptions} selectedTags={selectedTags} triggerRef={tagTriggerRef} />}</div>}</div>;
}

function ActiveTagFilters({ selectedTags, activeTags, visibleActiveTags, onRemove, clearFilters }: { selectedTags: ReadonlySet<string>; activeTags: readonly string[]; visibleActiveTags: readonly string[]; onRemove: (tag: string) => void; clearFilters: () => void }) {
  if (selectedTags.size === 0) return null;
  return <div aria-label="Active tag filters" className="focus-flow__active-filters"><span className="focus-flow__active-filters-label">Filtering by</span>{visibleActiveTags.map((tag) => <button aria-label={`Remove tag #${tag}`} className="focus-flow__tag-token" key={tag} onClick={() => onRemove(tag)} type="button"><TagChip tag={tag} /><span aria-hidden="true"><CloseIcon /></span></button>)}{activeTags.length > visibleActiveTags.length && <span className="focus-flow__active-filters-more">+{activeTags.length - visibleActiveTags.length} more</span>}<button className="focus-flow__button-quiet" onClick={clearFilters} type="button">Clear filters</button></div>;
}

type InboxCapabilities = Pick<InboxViewProps, 'onAcceptAsEpic' | 'onAcceptAsStory' | 'onReject' | 'onReconsider' | 'onDeleteDistraction'>;

function CandidateResults(props: { clearFilters: () => void; epics: readonly Epic[]; onDecision: (decision: Decision) => void; onEditCandidate?: InboxViewProps['onEditCandidate']; onOpenNote?: InboxViewProps['onOpenNote']; onRequestDelete?: InboxViewProps['onRequestDelete']; onTagFilter: (hinted: readonly string[], initial?: readonly string[]) => void; pending: boolean; query: string; section: InboxSection; selectedTags: ReadonlySet<string>; visible: readonly Candidate[]; capabilities: InboxCapabilities }) {
  const label = resultLabel(props.section, props.visible.length);
  return <><p aria-live="polite" className="focus-flow__result-count">{props.visible.length} {label}</p>{props.visible.length === 0 ? <CandidateEmptyState clearFilters={props.clearFilters} filtered={props.query !== '' || props.selectedTags.size > 0} section={props.section} selectedTags={props.selectedTags} /> : <ol className="focus-flow__work-list">{props.visible.map((candidate) => <CandidateRow candidate={candidate} capabilities={props.capabilities} epics={props.epics} key={candidate.id} onDecision={props.onDecision} onEditCandidate={props.onEditCandidate} onOpenNote={props.onOpenNote} onRequestDelete={props.onRequestDelete} onTagFilter={props.onTagFilter} pending={props.pending} />)}</ol>}</>;
}

function resultLabel(section: InboxSection, count: number) {
  if (section === 'candidates') return count === 1 ? 'Candidate' : 'Candidates';
  return count === 1 ? 'Distraction' : 'Distractions';
}

function CandidateEmptyState({ filtered, section, selectedTags, clearFilters }: { filtered: boolean; section: InboxSection; selectedTags: ReadonlySet<string>; clearFilters: () => void }) {
  const title = filtered ? 'Nothing matches' : section === 'candidates' ? 'Inbox is clear' : 'No Distractions recorded';
  const message = filtered ? 'Adjust the search or remove a tag filter.' : section === 'candidates' ? 'Capture a thought when it earns consideration.' : 'Rejected Candidates remain here as useful evidence.';
  return <div className="focus-flow__empty-state"><h2>{title}</h2><p>{message}</p>{selectedTags.size > 0 && <button className="focus-flow__button-quiet" onClick={clearFilters} type="button">Clear filters</button>}</div>;
}

function CandidateRow({ candidate, capabilities, epics, onDecision, onEditCandidate, onOpenNote, onRequestDelete, onTagFilter, pending }: { candidate: Candidate; capabilities: InboxCapabilities; epics: readonly Epic[]; onDecision: (decision: Decision) => void; onEditCandidate?: InboxViewProps['onEditCandidate']; onOpenNote?: InboxViewProps['onOpenNote']; onRequestDelete?: InboxViewProps['onRequestDelete']; onTagFilter: (hinted: readonly string[], initial?: readonly string[]) => void; pending: boolean }) {
  const preview = candidate.lifecycle === 'rejected' ? candidate.rejectionReason : candidate.bodyFields?.Description;
  const date = candidate.lifecycle === 'rejected' ? candidate.rejectedAt : candidate.createdAt;
  const dateTitle = candidate.lifecycle === 'rejected' ? `Rejected ${formatDate(date)}` : `Captured ${formatDate(date)}`;
  return <li className="focus-flow__work-row"><div className="focus-flow__work-row-main"><div className="focus-flow__work-identity"><h2 aria-label={candidate.title}><WorkTitleButton item={candidate} onOpenNote={onOpenNote} /></h2>{preview && <p className="focus-flow__inbox-preview">{preview}</p>}<time className="focus-flow__inbox-date" dateTime={date} title={dateTitle}>{formatDate(date)}</time></div><CandidateActions candidate={candidate} capabilities={capabilities} epics={epics} onDecision={onDecision} onEditCandidate={onEditCandidate} onRequestDelete={onRequestDelete} onTagFilter={onTagFilter} pending={pending} /></div></li>;
}

function CandidateActions({ candidate, capabilities, epics, onDecision, onEditCandidate, onRequestDelete, onTagFilter, pending }: { candidate: Candidate; capabilities: InboxCapabilities; epics: readonly Epic[]; onDecision: (decision: Decision) => void; onEditCandidate?: InboxViewProps['onEditCandidate']; onRequestDelete?: InboxViewProps['onRequestDelete']; onTagFilter: (hinted: readonly string[], initial?: readonly string[]) => void; pending: boolean }) {
  return <ActionMenu label={`More actions for ${candidate.key}`}><MenuAction disabled={pending || !onEditCandidate} onClick={() => onDecision({ kind: 'edit', candidate })}>Edit…</MenuAction>{candidate.tags.length > 0 && <MenuAction onClick={() => onTagFilter(candidate.tags, candidate.tags.length === 1 ? candidate.tags : [])}>Filter by tag…</MenuAction>}{candidate.lifecycle === 'inbox' ? <InboxCandidateActions candidate={candidate} capabilities={capabilities} epics={epics} onDecision={onDecision} onRequestDelete={onRequestDelete} pending={pending} /> : <DistractionActions candidate={candidate} capabilities={capabilities} onDecision={onDecision} pending={pending} />}</ActionMenu>;
}

function InboxCandidateActions({ candidate, capabilities, epics, onDecision, onRequestDelete, pending }: { candidate: InboxCandidate; capabilities: InboxCapabilities; epics: readonly Epic[]; onDecision: (decision: Decision) => void; onRequestDelete?: InboxViewProps['onRequestDelete']; pending: boolean }) {
  return <><MenuAction disabled={pending || !capabilities.onAcceptAsEpic} onClick={() => onDecision({ kind: 'epic', candidate })}>Accept as Epic</MenuAction><MenuAction disabled={pending || !capabilities.onAcceptAsStory || epics.length === 0} onClick={() => onDecision({ kind: 'story', candidate })}>Accept as Story</MenuAction><MenuAction destructive disabled={pending || !capabilities.onReject} onClick={() => onDecision({ kind: 'reject', candidate })}>Reject</MenuAction><MenuAction destructive disabled={pending || !onRequestDelete} onClick={() => onRequestDelete?.(candidate)}>Delete…</MenuAction></>;
}

function DistractionActions({ candidate, capabilities, onDecision, pending }: { candidate: Distraction; capabilities: InboxCapabilities; onDecision: (decision: Decision) => void; pending: boolean }) {
  return <><MenuAction disabled={pending || !capabilities.onReconsider} onClick={() => onDecision({ kind: 'reconsider', candidate })}>Reconsider</MenuAction><MenuAction destructive disabled={pending || !capabilities.onDeleteDistraction} onClick={() => onDecision({ kind: 'delete', candidate })}>Move to trash…</MenuAction></>;
}

function DecisionDialogs(props: { availableTags: readonly string[]; decision: Decision; epics: readonly Epic[]; onAcceptAsEpic?: InboxViewProps['onAcceptAsEpic']; onAcceptAsStory?: InboxViewProps['onAcceptAsStory']; onClose: () => void; onDeleteDistraction?: InboxViewProps['onDeleteDistraction']; onReconsider?: InboxViewProps['onReconsider']; onReject?: InboxViewProps['onReject']; pending: boolean }) {
  const { decision } = props;
  if (!decision) return null;
  if (decision.kind === 'story' || decision.kind === 'epic') return <PromotionDecision {...props} decision={decision} />;
  if (decision.kind === 'reject') return <RejectDecision candidate={decision.candidate} onClose={props.onClose} onReject={(reason) => { props.onReject?.(decision.candidate.id, reason); props.onClose(); }} pending={props.pending} />;
  if (decision.kind === 'delete') return props.onDeleteDistraction ? <DeleteDistractionDialog candidate={decision.candidate} onDelete={props.onDeleteDistraction} onClose={props.onClose} /> : null;
  if (decision.kind === 'reconsider') return <ReconsiderDecision candidate={decision.candidate} onClose={props.onClose} onReconsider={props.onReconsider} pending={props.pending} />;
  return null;
}

function PromotionDecision({ decision, epics, availableTags, onAcceptAsEpic, onAcceptAsStory, onClose }: { decision: Extract<Decision, { kind: 'story' | 'epic' }>; epics: readonly Epic[]; availableTags: readonly string[]; onAcceptAsEpic?: InboxViewProps['onAcceptAsEpic']; onAcceptAsStory?: InboxViewProps['onAcceptAsStory']; onClose: () => void }) {
  const accept = (fields: CandidateAcceptanceFields, epicId?: string) => {
    if (decision.kind === 'story') return onAcceptAsStory?.(decision.candidate.id, epicId!, fields);
    return onAcceptAsEpic?.(decision.candidate.id, fields);
  };
  return <CandidatePromotion candidate={decision.candidate} target={decision.kind} epics={epics} suggestions={availableTags} onAccept={accept} onClose={onClose} />;
}

function ReconsiderDecision({ candidate, pending, onReconsider, onClose }: { candidate: Distraction; pending: boolean; onReconsider?: InboxViewProps['onReconsider']; onClose: () => void }) {
  const reconsider = () => { onReconsider?.(candidate.id); onClose(); };
  return <DialogSurface description="This returns the note to Inbox and clears its rejection date and reason. The Markdown body and tags are preserved." onClose={onClose} title={`Reconsider ${candidate.key}?`}><div className="focus-flow__dialog-actions"><button className="focus-flow__button-quiet" onClick={onClose} type="button">Cancel</button><button disabled={pending} onClick={reconsider} type="button">Return to Inbox</button></div></DialogSurface>;
}

function toggledTags(current: ReadonlySet<string>, tag: string) {
  const next = new Set(current);
  if (next.has(tag)) next.delete(tag);
  else next.add(tag);
  return next;
}


function RejectDecision({ candidate, pending, onReject, onClose }: { candidate: InboxCandidate; pending: boolean; onReject: (reason: string | null) => void; onClose: () => void }) {
  const [reason, setReason] = useState('');
  return <DialogSurface description="The note stays available under Distractions." onClose={onClose} title={`Reject ${candidate.key}?`}>
    <label className="focus-flow__field"><span>Reason <small>optional</small></span><textarea aria-label={`Rejection reason for ${candidate.key}`} onChange={(event) => setReason(event.currentTarget.value)} placeholder="Why does this not belong right now?" value={reason} /></label>
    <div className="focus-flow__dialog-actions"><button className="focus-flow__button-quiet" onClick={onClose} type="button">Cancel</button><button aria-label={`Reject ${candidate.key}`} className="focus-flow__button-danger" disabled={pending} onClick={() => onReject(reason.trim() || null)} type="button">Reject Candidate</button></div>
  </DialogSurface>;
}

function DeleteDistractionDialog({ candidate, onDelete, onClose }: { candidate: Distraction; onDelete: (id: string) => Promise<unknown>; onClose: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remove = async () => {
    if (saving) return;
    setSaving(true); setError(null);
    try { await onDelete(candidate.id); onClose(); }
    catch (error) { setError(formatErrorMessage(error, 'Could not move this note to trash. Refresh and try again.')); }
    finally { setSaving(false); }
  };
  return <DialogSurface title={`Move ${candidate.key} to trash?`} description="Uses your Obsidian trash preference. The note can be recovered from trash." onClose={() => { if (!saving) onClose(); }}><p>{candidate.title}</p>{error && <p role="alert">{error}</p>}<div className="focus-flow__dialog-actions"><button disabled={saving} onClick={onClose} type="button">Cancel</button><button className="focus-flow__button-danger" disabled={saving} onClick={() => void remove()} type="button">{saving ? 'Moving…' : 'Move to trash'}</button></div></DialogSurface>;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { dateStyle: 'medium' });
}
