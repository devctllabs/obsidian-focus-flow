import { useRef, useState } from 'react';
import { DialogSurface } from '../ui/DialogSurface';
import { TagChip } from '../ui/Tags';

export interface HistoryFilterOption { value: string; label: string }

export function HistoryFilters({ epics, tags, selectedEpics, selectedTags, onEpicsChange, onTagsChange, closedFrom, closedTo, onFromChange, onToChange, onClose, matchingSprints }: {
  epics: readonly HistoryFilterOption[];
  tags: readonly HistoryFilterOption[];
  selectedEpics: readonly string[];
  selectedTags: readonly string[];
  onEpicsChange: (values: string[]) => void;
  onTagsChange: (values: string[]) => void;
  closedFrom: string;
  closedTo: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onClose: () => void;
  matchingSprints: number;
}) {
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(6);
  const inputRef = useRef<HTMLInputElement>(null);
  const search = query.trim().toLocaleLowerCase();
  const groups = [
    { label: 'Epics', options: epics, selected: selectedEpics, onChange: onEpicsChange },
    { label: 'Tags', options: tags, selected: selectedTags, onChange: onTagsChange },
  ].map((group) => ({ ...group, matching: group.options.filter((option) => option.label.toLocaleLowerCase().includes(search)) }));
  const selectedCount = selectedEpics.length + selectedTags.length + Number(Boolean(closedFrom)) + Number(Boolean(closedTo));
  return <DialogSurface title="Filter history" initialFocusRef={inputRef} onClose={onClose}>
    <div className="focus-flow__filter-browser">
      <input ref={inputRef} type="search" aria-label="Find Epics or tags" placeholder="Find an Epic or tag…" value={query} onChange={(event) => { setQuery(event.currentTarget.value); setLimit(6); }} />
      <div className="focus-flow__filter-browser-results">
        {groups.map((group) => group.matching.length === 0 ? null : <fieldset key={group.label}><legend>{group.label}</legend>{group.matching.slice(0, limit).map((option) => <label key={option.value}>{group.label === 'Tags' ? <TagChip tag={option.value} /> : <span>{option.label}</span>}<input type="checkbox" checked={group.selected.includes(option.value)} onChange={() => group.onChange(group.selected.includes(option.value) ? group.selected.filter((value) => value !== option.value) : [...group.selected, option.value])} /></label>)}</fieldset>)}
        {groups.every((group) => group.matching.length === 0) && <p>No matching Epics or tags.</p>}
        {groups.some((group) => group.matching.length > limit) && <button type="button" className="focus-flow__button-quiet" onClick={() => setLimit(limit + 20)}>Show more</button>}
      </div>
      <details className="focus-flow__filter-dates"><summary>Closed date</summary><div><label>From<input aria-label="Closed from" type="date" value={closedFrom} onChange={(event) => onFromChange(event.currentTarget.value)} /></label><label>To<input aria-label="Closed to" type="date" value={closedTo} onChange={(event) => onToChange(event.currentTarget.value)} /></label></div></details>
      <footer><span role="status">{matchingSprints} matching {matchingSprints === 1 ? 'Sprint' : 'Sprints'}</span><div>{selectedCount > 0 && <button className="focus-flow__button-quiet" type="button" onClick={() => { onEpicsChange([]); onTagsChange([]); onFromChange(''); onToChange(''); }}>Clear</button>}<button className="focus-flow__button-primary" type="button" onClick={onClose}>Done</button></div></footer>
      <p className="focus-flow__filter-footnote">Any selected Epic and any selected tag. Totals cover whole Sprints.</p>
    </div>
  </DialogSurface>;
}
