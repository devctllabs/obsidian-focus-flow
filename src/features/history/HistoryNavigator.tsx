import { useRef, useState } from 'react';
import { DialogSurface } from '../ui/DialogSurface';
import { ChevronIcon } from '../ui/Icons';
import type { HistoryReport, ReportLevel } from './history-reports';

export function HistoryNavigator({ reports, selected, level, onSelect }: {
  reports: readonly HistoryReport[];
  selected: HistoryReport;
  level: ReportLevel;
  onSelect: (report: HistoryReport) => void;
}) {
  const [open, setOpen] = useState(false);
  const index = reports.findIndex((report) => report.id === selected.id);
  const noun = level[0]!.toUpperCase() + level.slice(1);
  return <div className="focus-flow__history-navigator" role="group" aria-label="Navigate reports">
    <button className="focus-flow__icon-button" type="button" aria-label={`Previous ${noun}`} title={`Previous ${noun}`} disabled={index === reports.length - 1} onClick={() => onSelect(reports[index + 1]!)}><ChevronIcon direction="left" /></button>
    <button className="focus-flow__period-trigger" type="button" aria-label="Browse history" aria-haspopup="dialog" onClick={() => setOpen(true)}><span>{selected.label}</span><ChevronIcon /></button>
    <button className="focus-flow__icon-button" type="button" aria-label={`Next ${noun}`} title={`Next ${noun}`} disabled={index === 0} onClick={() => onSelect(reports[index - 1]!)}><ChevronIcon direction="right" /></button>
    {open && <PeriodBrowser reports={reports} selected={selected} level={level} onClose={() => setOpen(false)} onSelect={(report) => { onSelect(report); setOpen(false); }} />}
  </div>;
}

function PeriodBrowser({ reports, selected, level, onClose, onSelect }: {
  reports: readonly HistoryReport[];
  selected: HistoryReport;
  level: ReportLevel;
  onClose: () => void;
  onSelect: (report: HistoryReport) => void;
}) {
  const [query, setQuery] = useState('');
  const [year, setYear] = useState(yearOf(selected));
  const [limit, setLimit] = useState(40);
  const searchRef = useRef<HTMLInputElement>(null);
  const years = [...new Set(reports.map(yearOf))];
  const terms = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  const matching = matchingReports(reports, terms, level, year);
  const months = [...new Set(matching.map(monthOf))];
  return <DialogSurface title="Browse history" description="Find a commitment or explore its review cycle." initialFocusRef={searchRef} onClose={onClose}>
    <div className="focus-flow__period-browser">
      <input ref={searchRef} type="search" aria-label="Find a period" placeholder="Sprint number, cycle, or Story…" value={query} onChange={(event) => { setQuery(event.currentTarget.value); setLimit(40); }} />
      <YearSelector visible={terms.length === 0 && level !== 'year' && years.length > 1} years={years} selected={year} onSelect={setYear} />
      <SearchSummary searching={terms.length > 0} count={matching.length} />
      <PeriodResults reports={matching} months={months} year={year} selected={selected} level={level} searching={terms.length > 0} limit={limit} onSelect={onSelect} onShowMore={() => setLimit(limit + 40)} />
      <LatestReportButton visible={selected.id !== reports[0]?.id} report={reports[0]} level={level} onSelect={onSelect} />
    </div>
  </DialogSurface>;
}

function matchingReports(reports: readonly HistoryReport[], terms: readonly string[], level: ReportLevel, year: number): HistoryReport[] {
  return reports.filter((report) => {
    if (terms.length === 0) return level === 'year' || yearOf(report) === year;
    return terms.every((term) => searchableReportText(report).includes(term));
  });
}

function searchableReportText(report: HistoryReport): string {
  return `${report.label} Year ${yearOf(report)} ${report.reviews.flatMap((review) => [review.sprint.code, ...review.stories.flatMap((story) => [story.key, story.title])]).join(' ')}`.toLocaleLowerCase();
}

function YearSelector({ visible, years, selected, onSelect }: { visible: boolean; years: readonly number[]; selected: number; onSelect: (year: number) => void }) {
  if (!visible) return null;
  return <div className="focus-flow__archive-years" role="group" aria-label="Review years">{years.map((year) => <button type="button" key={year} aria-pressed={selected === year} onClick={() => onSelect(year)}>Year {year}</button>)}</div>;
}

function SearchSummary({ searching, count }: { searching: boolean; count: number }) {
  if (!searching) return null;
  return <p className="focus-flow__report-caption" role="status">{count} matching {count === 1 ? 'report' : 'reports'} across all years</p>;
}

function PeriodResults({ reports, months, year, selected, level, searching, limit, onSelect, onShowMore }: { reports: readonly HistoryReport[]; months: readonly number[]; year: number; selected: HistoryReport; level: ReportLevel; searching: boolean; limit: number; onSelect: (report: HistoryReport) => void; onShowMore: () => void }) {
  if (reports.length === 0) return <div className="focus-flow__archive-results"><p>No matching periods. Try a Sprint number or a Story title.</p></div>;
  const rows = reports.slice(0, limit).map((report) => <ReportRow key={report.id} report={report} selected={selected.id === report.id} onSelect={onSelect} />);
  if (level !== 'sprint' || searching) return <div className="focus-flow__archive-results"><ol>{rows}</ol>{reports.length > limit && <button className="focus-flow__button-quiet" type="button" onClick={onShowMore}>Show more reports</button>}</div>;
  return <div className="focus-flow__archive-results">{months.map((month) => <details className="focus-flow__archive-month" key={`${year}-${month}`} open={month === monthOf(selected) && year === yearOf(selected) || months.length === 1 ? true : undefined}>
    <summary>Month {month} <small>Year {year}</small></summary><ol>{reports.filter((report) => monthOf(report) === month).map((report) => <ReportRow key={report.id} report={report} selected={selected.id === report.id} onSelect={onSelect} />)}</ol>
  </details>)}</div>;
}

function ReportRow({ report, selected, onSelect }: { report: HistoryReport; selected: boolean; onSelect: (report: HistoryReport) => void }) {
  return <li><button type="button" aria-label={`Open report ${report.label}`} aria-current={selected ? 'true' : undefined} onClick={() => onSelect(report)}><span><strong>{report.label}</strong><small>{reportDescription(report)}</small></span><ChevronIcon direction="right" /></button></li>;
}

function LatestReportButton({ visible, report, level, onSelect }: { visible: boolean; report: HistoryReport | undefined; level: ReportLevel; onSelect: (report: HistoryReport) => void }) {
  if (!visible || report === undefined) return null;
  return <button className="focus-flow__button-quiet" type="button" onClick={() => onSelect(report)}>Go to latest {level}</button>;
}

function yearOf(report: HistoryReport) { return Math.ceil(report.reviews[0]!.sequence / 48); }
function monthOf(report: HistoryReport) { return Math.floor((report.reviews[0]!.sequence - 1) % 48 / 4) + 1; }
function reportDescription(report: HistoryReport) {
  if (report.target === 1) return report.reviews[0]!.stories[0]?.title ?? 'No Story outcomes';
  const codes = report.reviews.map((review) => review.sprint.code);
  return `${codes.at(-1)} – ${codes[0]} · ${report.reviews.length} / ${report.target} Sprints`;
}
