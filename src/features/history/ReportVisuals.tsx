import { useId, useState, type ReactNode } from 'react';
import type { SprintReview } from '../../application/history/review-history';
import { reportTotals } from './history-reports';
import { useTagCatalog } from '../ui/TagCatalog';

export function ReportVisuals({ reviews }: { reviews: readonly SprintReview[] }) {
  const { entries } = useTagCatalog();
  const [unit, setUnit] = useState<'tasks' | 'stories' | 'epics'>('tasks');
  const totals = reportTotals(reviews);
  const tags = tagCounts(reviews, unit);
  const copy = tagUnitCopy(unit);
  const rankedTags = [...tags].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const maximum = Math.max(1, ...rankedTags.map(([, count]) => count));
  const tagRow = ([tag, count]: [string, number]) => <li key={tag}><div><span>{tag}</span><strong>{count}</strong></div><span className="focus-flow__tag-bar" aria-hidden="true"><span style={{ width: `${count / maximum * 100}%`, backgroundColor: entries[tag]?.color }} /></span></li>;
  return <>
    <div className="focus-flow__report-visuals">
      <OutcomeVisual totals={totals} />
      <section className="focus-flow__tags-visual" aria-label={copy.title}>
        <h3>Where your work landed</h3>
        <div className="focus-flow__backlog-tabs focus-flow__tag-units" role="group" aria-label="Count by entity">{(['tasks', 'stories', 'epics'] as const).map((value) => <button type="button" key={value} aria-pressed={unit === value} onClick={() => setUnit(value)}>{value[0]!.toUpperCase() + value.slice(1)}</button>)}</div>
        <TagChart rankedTags={rankedTags} unit={unit} row={tagRow} />
        <p className="focus-flow__report-caption">{copy.caption} Each item can count toward several tags.</p>
      </section>
    </div>
    {reviews.length > 1 && <CompletionChart reviews={reviews} />}
    <ReflectionHighlight reviews={reviews} />
  </>;
}

type TagUnit = 'tasks' | 'stories' | 'epics';

function tagCounts(reviews: readonly SprintReview[], unit: TagUnit): Map<string, number> {
  const tags = new Map<string, number>();
  for (const review of reviews) addReviewTagCounts(tags, review, unit);
  return tags;
}

function addReviewTagCounts(tags: Map<string, number>, review: SprintReview, unit: TagUnit): void {
  if (unit === 'tasks') {
    for (const entry of review.sprint.closeSnapshot.effectiveTagSummary) tags.set(entry.tag, (tags.get(entry.tag) ?? 0) + entry.completedTasks);
    return;
  }
  const items = unit === 'stories' ? review.stories.filter((story) => story.outcome === 'achieved').map((story) => story.effectiveTags) : review.finalizedEpics.filter((epic) => epic.lifecycle === 'done').map((epic) => epic.tags);
  for (const itemTags of items) for (const tag of new Set(itemTags)) tags.set(tag, (tags.get(tag) ?? 0) + 1);
}

function tagUnitCopy(unit: TagUnit) {
  if (unit === 'tasks') return { title: 'Completed Tasks by Effective Tag', caption: 'Task completions · frozen own and inherited tags.' };
  if (unit === 'stories') return { title: 'Achieved Story Attempts by Effective Tag', caption: 'Achieved Story Attempts · frozen own and Epic tags.' };
  return { title: 'Completed Epics by own tag', caption: 'Completed Epics · current note tags, not a historical tag snapshot.' };
}

function OutcomeVisual({ totals }: { totals: ReturnType<typeof reportTotals> }) {
  const outcomes = [
    { label: 'Achieved', value: totals.achieved, color: 'var(--ff-accent)' },
    { label: 'Not achieved', value: totals.notAchieved, color: 'var(--ff-muted)' },
    { label: 'Closed', value: totals.closed, color: 'var(--ff-border-hover)' },
  ];
  return <section className="focus-flow__outcomes-visual" aria-label="Story outcome chart"><h3>What moved forward</h3><div className="focus-flow__outcome-composition"><div className="focus-flow__outcome-ring"><svg viewBox="0 0 160 160" aria-hidden="true"><circle cx="80" cy="80" r="66" fill="none" stroke="var(--ff-border)" strokeWidth="8" />{outcomeSegments(outcomes, totals.attempted)}</svg><div><strong>{achievementRate(totals)}</strong><span>achieved</span></div></div><ul className="focus-flow__outcome-legend">{outcomes.map((outcome) => <li key={outcome.label}><span className="focus-flow__chart-dot" style={{ background: outcome.color }} aria-hidden="true" /><span>{outcome.label}</span><strong>{outcome.value}</strong></li>)}</ul></div><p className="focus-flow__report-caption">{outcomeCaption(totals)}</p></section>;
}

function outcomeSegments(outcomes: ReadonlyArray<{ label: string; value: number; color: string }>, attempted: number) {
  let offset = 0;
  return outcomes.map((outcome) => {
    const fraction = attempted === 0 ? 0 : outcome.value / attempted * 100;
    const start = offset;
    offset += fraction;
    return outcome.value === 0 ? null : <circle key={outcome.label} cx="80" cy="80" r="66" fill="none" stroke={outcome.color} strokeWidth="8" pathLength="100" strokeDasharray={`${fraction} ${100 - fraction}`} strokeDashoffset={-start} transform="rotate(-90 80 80)" />;
  });
}

function achievementRate(totals: ReturnType<typeof reportTotals>): string { return totals.attempted === 0 ? '—' : `${Math.round(totals.achieved / totals.attempted * 100)}%`; }
function outcomeCaption(totals: ReturnType<typeof reportTotals>): string { return totals.attempted === 0 ? 'No Story outcomes recorded.' : `${totals.achieved} of ${totals.attempted} Story Attempts achieved their outcome.`; }

function TagChart({ rankedTags, unit, row }: { rankedTags: Array<[string, number]>; unit: TagUnit; row: (entry: [string, number]) => ReactNode }) {
  if (rankedTags.length === 0) return <p className="focus-flow__report-caption">No tagged {unit === 'stories' ? 'achieved Story Attempts' : `completed ${unit}`} in this period.</p>;
  return <><ul className="focus-flow__tag-chart">{rankedTags.slice(0, 5).map(row)}</ul>{rankedTags.length > 5 && <details><summary>{rankedTags.length - 5} more tags</summary><ul className="focus-flow__tag-chart">{rankedTags.slice(5).map(row)}</ul></details>}</>;
}

function CompletionChart({ reviews }: { reviews: readonly SprintReview[] }) {
  const titleId = useId();
  const ordered = [...reviews].sort((a, b) => a.sequence - b.sequence);
  const max = Math.max(2, ...ordered.map((review) => review.sprint.closeSnapshot.summary.completedDuringSprint));
  const ceiling = Math.ceil(max / 2) * 2;
  const step = 560 / ordered.length;
  const labelEvery = Math.max(1, Math.ceil(ordered.length / 6));
  return <section className="focus-flow__completion-chart">
    <header><h3>The rhythm of your work</h3><span>Task completions · each closed Sprint</span></header>
    <svg viewBox="0 0 620 220" role="img" aria-labelledby={titleId}>
      <title id={titleId}>{ordered.map((review) => `${review.sprint.code}: ${review.sprint.closeSnapshot.summary.completedDuringSprint} Task completions`).join('; ')}</title>
      {[0, ceiling / 2, ceiling].map((value) => <g key={value}><line x1="36" x2="610" y1={180 - value / ceiling * 150} y2={180 - value / ceiling * 150} /><text x="25" y={184 - value / ceiling * 150} textAnchor="end">{value}</text></g>)}
      {ordered.map((review, index) => {
        const value = review.sprint.closeSnapshot.summary.completedDuringSprint;
        const height = value / ceiling * 150;
        const width = Math.min(46, step * .6);
        const x = 40 + step * (index + .5);
        return <g key={review.sprint.id}><rect x={x - width / 2} y={180 - height} width={width} height={height} rx="3"><title>{review.sprint.code}: {value}</title></rect>{ordered.length <= 12 && <text x={x} y={172 - height} textAnchor="middle">{value}</text>}{(index % labelEvery === 0 || index === ordered.length - 1) && <text x={x} y="206" textAnchor="middle">{review.sprint.code}</text>}</g>;
      })}
    </svg>
    <div className="focus-flow__completion-mobile" role="region" aria-label="Task completions per Sprint" tabIndex={0}><ol>{ordered.map((review) => {
      const count = review.sprint.closeSnapshot.summary.completedDuringSprint;
      return <li key={review.sprint.id}><span>{review.sprint.code}</span><span className="focus-flow__tag-bar" aria-hidden="true"><span style={{ width: `${count / ceiling * 100}%` }} /></span><strong>{count}</strong></li>;
    })}</ol></div>
  </section>;
}

function ReflectionHighlight({ reviews }: { reviews: readonly SprintReview[] }) {
  const observations = reviews.flatMap((review) => (review.sprint.retrospectiveItems ?? []).map((item) => ({ ...item, code: review.sprint.code })));
  const win = observations.find((item) => item.kind === 'win');
  const improvement = observations.find((item) => item.kind === 'improvement');
  if (!win && !improvement) return null;
  return <div className="focus-flow__reflection-highlights">{[{ item: win, label: 'A win to remember' }, { item: improvement, label: 'Take this forward' }].map(({ item, label }) => item ? <section key={label}><h3>{label}</h3><p>{item.text}</p><small>{item.code} · your reflection</small></section> : null)}</div>;
}
