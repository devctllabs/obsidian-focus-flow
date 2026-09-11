import {
  useMemo,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import {
  buildReviewHistory,
  type FinalizedEpicReview,
  type SprintReview,
} from '../../application/history/review-history';
import type { ProjectedManagedEntity } from '../../application/indexing/work-index';
import { compareOrdinal } from '../../domain/ordering';
import type { RetrospectiveItem } from '../../domain/sprint-note';
import { ActionMenu, MenuAction } from '../ui/ActionMenu';
import { ChevronIcon, FilterIcon, CloseIcon, CheckIcon, AttentionIcon, PlusIcon } from '../ui/Icons';
import { DeliveryEvidence } from './DeliveryEvidence';
import { HistoryNavigator } from './HistoryNavigator';
import { HistoryFilters } from './HistoryFilters';
import { ReportVisuals } from './ReportVisuals';
import { historyReports, reportTotals, type ReportLevel } from './history-reports';
import { CompactTags } from '../ui/Tags';
import type { WorkspaceLifecycle } from '../../application/workspace/workspace-lifecycle';
import { ReopenSprint } from './ReopenSprint';

type ClosedSprint = Extract<
  ProjectedManagedEntity,
  { type: 'sprint'; lifecycle: 'closed' }
>;

interface HistoryViewProps {
  lifecycle?: WorkspaceLifecycle;
  entities: readonly ProjectedManagedEntity[];
  onOpenNote?: (path: string, event: MouseEvent) => void;
  onPromoteImprovement?: (text: string, sprintCode: string) => void;
}

export function HistoryView({
  entities,
  onOpenNote,
  onPromoteImprovement,
  lifecycle,
}: HistoryViewProps) {
  const [closedFrom, setClosedFrom] = useState('');
  const [closedTo, setClosedTo] = useState('');
  const [selectedEpics, setSelectedEpics] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [level, setLevel] = useState<ReportLevel>('sprint');
  const [anchorSequence, setAnchorSequence] = useState<number | null>(null);
  const [sinceLastOpen, setSinceLastOpen] = useState(false);
  const filterCount = [closedFrom, closedTo].filter(Boolean).length + selectedEpics.length + selectedTags.length;
  const sprints = useMemo(
    () =>
      entities
        .filter(
          (entity): entity is ClosedSprint =>
            entity.type === 'sprint' && entity.lifecycle === 'closed',
        )
        .sort((left, right) => compareOrdinal(right.closedAt, left.closedAt)),
    [entities],
  );
  const epicIds = uniqueSorted(
    sprints.flatMap((sprint) =>
      sprint.closeSnapshot.stories.map((story) => story.epicId),
    ),
  );
  const epicLabels = new Map(
    entities.flatMap((entity) =>
      entity.type === 'epic'
        ? [[entity.id, `${entity.key} ${entity.title}`] as const]
        : [],
    ),
  );
  const effectiveTags = uniqueSorted(
    sprints.flatMap((sprint) =>
      sprint.closeSnapshot.effectiveTagSummary.map((entry) => entry.tag),
    ),
  );
  const visible = sprints.filter((sprint) => sprintMatchesFilters(sprint, { closedFrom, closedTo, selectedEpics, selectedTags }));
  const history = buildReviewHistory(
    entities,
    new Set(visible.map((sprint) => sprint.id)),
  );
  const reports = historyReports(history, level);
  const selected = reports.find((report) => report.reviews.some((review) => review.sequence === anchorSequence)) ?? reports[0];
  const latest = [...sprints].sort((a, b) => b.sequence - a.sequence)[0];
  const later = latest && entities.some((entity) => entity.type === 'sprint' && entity.lifecycle !== 'draft' && entity.sequence > latest.sequence);
  const draft = entities.some((entity) => entity.type === 'sprint' && entity.lifecycle === 'draft');

  return (
    <section className="focus-flow__history">
      <header className="focus-flow__page-heading"><h1>History</h1><div className="focus-flow__history-tools">
        <button type="button" aria-label="Filters" title="Filters" aria-expanded={filtersOpen} className="focus-flow__icon-button" onClick={() => setFiltersOpen(!filtersOpen)}><FilterIcon />{filterCount > 0 && <span>{filterCount}</span>}</button>
        {history.sinceLastSprint.length > 0 && <ActionMenu label="History options"><MenuAction onClick={() => setSinceLastOpen(!sinceLastOpen)}>Since last Sprint</MenuAction></ActionMenu>}
      </div></header>
      <ActiveHistoryFilters closedFrom={closedFrom} closedTo={closedTo} epicLabels={epicLabels} onClear={() => { setSelectedEpics([]); setSelectedTags([]); setClosedFrom(''); setClosedTo(''); }} onFromChange={setClosedFrom} onToChange={setClosedTo} onEpicsChange={setSelectedEpics} onTagsChange={setSelectedTags} selectedEpics={selectedEpics} selectedTags={selectedTags} />
      {filtersOpen && <HistoryFilters onClose={() => setFiltersOpen(false)} matchingSprints={visible.length} epics={epicIds.map((id) => ({ value: id, label: epicLabels.get(id) ?? id }))} tags={effectiveTags.map((tag) => ({ value: tag, label: tag }))} selectedEpics={selectedEpics} selectedTags={selectedTags} onEpicsChange={setSelectedEpics} onTagsChange={setSelectedTags} closedFrom={closedFrom} closedTo={closedTo} onFromChange={setClosedFrom} onToChange={setClosedTo} />}


      {sinceLastOpen && history.sinceLastSprint.length > 0 && (
        <section className="focus-flow__history-since-last">
          <h2>Since last Sprint</h2>
          <EpicEvidence
            epics={history.sinceLastSprint}
            onOpenNote={onOpenNote}
          />
        </section>
      )}

      <HistoryToolbar anchorSequence={anchorSequence} draft={draft} entities={entities} latest={latest} later={Boolean(later)} level={level} lifecycle={lifecycle} onAnchorChange={setAnchorSequence} onLevelChange={setLevel} reports={reports} selected={selected} />
      <HistoryReport filterCount={filterCount} level={level} onOpenNote={onOpenNote} onPromoteImprovement={onPromoteImprovement} onSelectSprint={(sequence) => { setLevel('sprint'); setAnchorSequence(sequence); }} selected={selected} sprintCount={sprints.length} />
    </section>
  );
}

function HistoryToolbar({ level, onLevelChange, anchorSequence, onAnchorChange, selected, reports, lifecycle, latest, later, draft, entities }: {
  level: ReportLevel;
  onLevelChange: (level: ReportLevel) => void;
  anchorSequence: number | null;
  onAnchorChange: (sequence: number) => void;
  selected: HistoryReportValue | undefined;
  reports: ReturnType<typeof historyReports>;
  lifecycle?: WorkspaceLifecycle;
  latest: ClosedSprint | undefined;
  later: boolean;
  draft: boolean;
  entities: readonly ProjectedManagedEntity[];
}) {
  const selectLevel = (period: ReportLevel) => {
    if (anchorSequence === null && selected) onAnchorChange(selected.reviews[0]!.sequence);
    onLevelChange(period);
  };
  const canReopen = lifecycle && latest?.reopenRecovery && !later;
  return <div className="focus-flow__report-toolbar">
    <div className="focus-flow__backlog-tabs focus-flow__report-levels" role="group" aria-label="Report period">{(['sprint', 'month', 'quarter', 'year'] as const).map((period) => <button key={period} type="button" aria-pressed={level === period} onClick={() => selectLevel(period)}>{period[0]!.toUpperCase() + period.slice(1)}</button>)}</div>
    {canReopen && <ReopenSprint key={latest.id} revision={entities} sprintId={latest.id} code={latest.code} resuming={Boolean(latest.pendingReopen)} blocked={draft ? `Cancel the Draft before reopening ${latest.code}.` : undefined} lifecycle={lifecycle} />}
    {selected && <HistoryNavigator reports={reports} selected={selected} level={level} onSelect={(report) => onAnchorChange(report.reviews[0]!.sequence)} />}
  </div>;
}

interface HistoryFilterValues { closedFrom: string; closedTo: string; selectedEpics: readonly string[]; selectedTags: readonly string[] }

function sprintMatchesFilters(sprint: ClosedSprint, filters: HistoryFilterValues) {
  const closedDate = sprint.closedAt.slice(0, 10);
  if (filters.closedFrom !== '' && closedDate < filters.closedFrom) return false;
  if (filters.closedTo !== '' && closedDate > filters.closedTo) return false;
  if (filters.selectedEpics.length > 0 && !sprint.closeSnapshot.stories.some((story) => filters.selectedEpics.includes(story.epicId))) return false;
  return filters.selectedTags.length === 0 || sprint.closeSnapshot.effectiveTagSummary.some((entry) => filters.selectedTags.includes(entry.tag));
}

function ActiveHistoryFilters({ closedFrom, closedTo, selectedEpics, selectedTags, epicLabels, onFromChange, onToChange, onEpicsChange, onTagsChange, onClear }: HistoryFilterValues & { epicLabels: ReadonlyMap<string, string>; onFromChange: (value: string) => void; onToChange: (value: string) => void; onEpicsChange: (value: string[]) => void; onTagsChange: (value: string[]) => void; onClear: () => void }) {
  const count = Number(Boolean(closedFrom)) + Number(Boolean(closedTo)) + selectedEpics.length + selectedTags.length;
  if (count === 0) return null;
  return <div className="focus-flow__active-filters" aria-label="Active filters">
    {selectedEpics.map((id) => <button type="button" key={id} aria-label={`Remove Epic filter ${epicLabels.get(id) ?? id}`} onClick={() => onEpicsChange(selectedEpics.filter((value) => value !== id))}>{epicLabels.get(id) ?? id}<CloseIcon /></button>)}
    {selectedTags.map((tag) => <button type="button" key={tag} aria-label={`Remove tag filter ${tag}`} onClick={() => onTagsChange(selectedTags.filter((value) => value !== tag))}><TagChip tag={tag} /><CloseIcon /></button>)}
    {closedFrom && <button type="button" onClick={() => onFromChange('')}>From {closedFrom}<CloseIcon /></button>}
    {closedTo && <button type="button" onClick={() => onToChange('')}>To {closedTo}<CloseIcon /></button>}
    <button className="focus-flow__button-quiet" type="button" onClick={onClear}>Clear filters</button>
  </div>;
}

type HistoryReportValue = ReturnType<typeof historyReports>[number];

function HistoryReport({ selected, sprintCount, level, filterCount, onSelectSprint, onOpenNote, onPromoteImprovement }: { selected: HistoryReportValue | undefined; sprintCount: number; level: ReportLevel; filterCount: number; onSelectSprint: (sequence: number) => void; onOpenNote?: HistoryViewProps['onOpenNote']; onPromoteImprovement?: HistoryViewProps['onPromoteImprovement'] }) {
  if (selected === undefined) return <div className="focus-flow__report-empty"><h2>{sprintCount === 0 ? 'A place to look back.' : 'No matching Sprints'}</h2><p>{sprintCount === 0 ? 'Close your first Sprint to see outcomes, learning, and the bigger picture here.' : 'No Closed Sprints match these filters.'}</p></div>;
  const totals = reportTotals(selected.reviews);
  return <div className="focus-flow__report" key={selected.id}>
    <header className="focus-flow__report-heading"><div><h2>{selected.label}</h2></div>{level !== 'sprint' && <span className="focus-flow__report-progress">{selected.reviews.length} / {selected.target} Sprints · {selected.reviews.length === selected.target ? 'Complete' : 'In progress'}</span>}</header>
    {level !== 'sprint' && <p className="focus-flow__report-caption">A {level} groups {selected.target} Sprints, not calendar dates.{filterCount > 0 ? ' Showing matching Sprints only; totals are filtered.' : ''}</p>}
    {level === 'sprint' && filterCount > 0 && <p className="focus-flow__report-caption">Filters select whole Sprints; totals include all their work.</p>}
    <dl className="focus-flow__report-stats"><div><dt>Story outcomes achieved</dt><dd>{totals.achieved}<small> / {totals.attempted}</small></dd></div><div><dt>Task completions</dt><dd>{totals.completed}</dd></div><div><dt>Open at latest close</dt><dd>{totals.open}</dd></div></dl>
    <ReportVisuals reviews={selected.reviews} />
    <SprintBreakdown level={level} onSelect={onSelectSprint} reviews={selected.reviews} />
    <details className="focus-flow__report-detail"><summary>Outcomes &amp; reflection <ChevronIcon /></summary>{selected.reviews.map((review) => <section key={review.sprint.id}>{level !== 'sprint' && <h3>{review.sprint.code}</h3>}<SprintHistoryCard review={review} onOpenNote={onOpenNote} onPromoteImprovement={onPromoteImprovement} /></section>)}</details>
  </div>;
}

function SprintBreakdown({ level, reviews, onSelect }: { level: ReportLevel; reviews: readonly SprintReview[]; onSelect: (sequence: number) => void }) {
  if (level === 'sprint') return null;
  return <details className="focus-flow__report-sprint-details"><summary>Explore Sprints</summary><section className="focus-flow__report-rhythm" aria-label="Sprint breakdown"><h3>Sprint by Sprint</h3>{[...reviews].reverse().map((review) => {
    const count = review.sprint.closeSnapshot.summary;
    const percent = count.attemptedStories === 0 ? 0 : count.achievedStories / count.attemptedStories * 100;
    return <button type="button" key={review.sprint.id} aria-label={`Review ${review.sprint.code}`} onClick={() => onSelect(review.sequence)}><span>{review.sprint.code}</span><span className="focus-flow__rhythm-track" aria-hidden="true"><span style={{ width: `${percent}%` }} /></span><small>{count.achievedStories} / {count.attemptedStories} achieved</small><ChevronIcon direction="right" /></button>;
  })}</section></details>;
}

function SprintHistoryCard({
  review,
  onOpenNote,
  onPromoteImprovement,
}: {
  review: SprintReview;
  onOpenNote?: HistoryViewProps['onOpenNote'];
  onPromoteImprovement?: HistoryViewProps['onPromoteImprovement'];
}) {
  const { sprint } = review;
  return (
    <article className="focus-flow__history-card">
      <header><p>Started {sprint.startedAt.slice(0, 10)} · Closed {sprint.closedAt.slice(0, 10)}</p><HistoryNoteLink aria-label={sprint.code} path={sprint.path} onOpenNote={onOpenNote}>Open note <ChevronIcon direction="right" /></HistoryNoteLink></header>
      {review.stories.length > 0 && (
        <div className="focus-flow__history-outcomes">
          <h3>Story outcomes</h3>
          <ul>
            {review.stories.map((story) => (
              <li key={story.id}>
                <span className="focus-flow__history-work-title">{story.path === null ? <span>{story.key} {story.title}</span> : <HistoryNoteLink aria-label={`Open ${story.key} Story`} path={story.path} onOpenNote={onOpenNote}>{story.key} {story.title}</HistoryNoteLink>}<CompactTags tags={story.effectiveTags} /></span>
                <span data-outcome={story.outcome}>{story.outcome}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <DeliveryEvidence snapshot={sprint.closeSnapshot} />
      {review.finalizedEpics.length > 0 && (
        <div>
          <h3>Finalized Epics</h3>
          <EpicEvidence epics={review.finalizedEpics} onOpenNote={onOpenNote} />
        </div>
      )}
      <RetrospectiveItems
        items={sprint.retrospectiveItems ?? []}
        sprintCode={sprint.code}
        onPromoteImprovement={onPromoteImprovement}
      />
    </article>
  );
}

function EpicEvidence({
  epics,
  onOpenNote,
}: {
  epics: readonly FinalizedEpicReview[];
  onOpenNote?: HistoryViewProps['onOpenNote'];
}) {
  return (
    <ul>
      {epics.map((epic) => (
        <li key={epic.id}>
          <HistoryNoteLink
            aria-label={`Open ${epic.key} Epic`}
            path={epic.path}
            onOpenNote={onOpenNote}
          >
            {epic.key} {epic.title}
          </HistoryNoteLink>{' '}
          <CompactTags tags={epic.tags} />
          <span>{epic.lifecycle}</span>
        </li>
      ))}
    </ul>
  );
}

function HistoryNoteLink({
  path,
  onOpenNote,
  children,
  ...linkProps
}: {
  path: string;
  onOpenNote?: HistoryViewProps['onOpenNote'];
  children: ReactNode;
  'aria-label'?: string;
}) {
  const open = (event: ReactMouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onOpenNote?.(path, event.nativeEvent);
  };
  const href = path.replace(/\.md$/, '');
  return (
    <a
      {...linkProps}
      className="internal-link focus-flow__title-link"
      data-href={href}
      data-type="link"
      href={href}
      onAuxClick={open}
      onClick={open}
    >
      {children}
    </a>
  );
}

function RetrospectiveItems({
  items,
  sprintCode,
  onPromoteImprovement,
}: {
  items: readonly RetrospectiveItem[];
  sprintCode: string;
  onPromoteImprovement?: HistoryViewProps['onPromoteImprovement'];
}) {
  const sections: Array<{
    kind: RetrospectiveItem['kind'];
    heading: string;
  }> = [
    { kind: 'win', heading: 'Wins' },
    { kind: 'friction', heading: 'Friction' },
    { kind: 'improvement', heading: 'Improvements' },
  ];
  return <div className="focus-flow__retrospective-notes">{sections.map(({ kind, heading }) => {
    const matching = items.filter((item) => item.kind === kind);
    return matching.length === 0 ? null : (
      <section className="focus-flow__retrospective-section" data-kind={kind} key={kind}>
        <h3>{kind === 'win' ? <CheckIcon /> : kind === 'friction' ? <AttentionIcon /> : <PlusIcon />}{heading}</h3>
        <ul>
          {matching.map((item, index) => (
            <li key={`${item.text}:${index}`}>
              <p>{item.text}</p>
              {kind === 'improvement' && onPromoteImprovement && (
                <button
                  type="button"
                  className="focus-flow__button-quiet"
                  aria-label={`Promote ${item.text}`}
                  onClick={() => onPromoteImprovement(item.text, sprintCode)}
                >
                  <PlusIcon /> Save to Inbox
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    );
  })}</div>;
}

function uniqueSorted(values: readonly string[]) {
  return Array.from(new Set(values)).sort(compareOrdinal);
}
import { TagChip } from '../ui/Tags';
