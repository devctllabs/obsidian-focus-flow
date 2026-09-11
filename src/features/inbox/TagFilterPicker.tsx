import { useMemo, useRef, useState, type RefObject } from 'react';
import { SearchIcon } from '../ui/Icons';
import { DialogSurface } from '../ui/DialogSurface';
import { TagChip } from '../ui/Tags';

interface InboxTagOption {
  tag: string;
  count: number;
}

interface TagFilterPickerProps {
  id: string;
  options: readonly InboxTagOption[];
  selectedTags: ReadonlySet<string>;
  hintedTags?: readonly string[];
  triggerRef: RefObject<HTMLButtonElement | null>;
  onToggle: (tag: string) => void;
  onClear: () => void;
  onClose: () => void;
}

export function TagFilterPicker({ id, options, selectedTags, hintedTags = [], onToggle, onClear, onClose }: TagFilterPickerProps) {
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(6);
  const searchRef = useRef<HTMLInputElement>(null);
  const orderedOptions = useMemo(() => {
    const hinted = new Set(hintedTags);
    return [...options.filter((option) => hinted.has(option.tag)), ...options.filter((option) => !hinted.has(option.tag))];
  }, [hintedTags, options]);
  const visible = orderedOptions.filter((option) => option.tag.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <DialogSurface title="Filter by tags" description="Matches all selected tags" initialFocusRef={searchRef} onClose={onClose}>
    <div className="focus-flow__inbox-filter-dialog" id={id}>
      <label className="focus-flow__search-field"><SearchIcon /><input aria-label="Find a tag" placeholder="Find a tag" ref={searchRef} type="search" value={query} onChange={(event) => { setQuery(event.currentTarget.value); setLimit(6); }} /></label>
      <fieldset className="focus-flow__tag-options"><legend className="focus-flow__sr-only">Available tags</legend>
        {visible.slice(0, limit).map((option) => <label className="focus-flow__tag-option" key={option.tag}><input aria-label={`#${option.tag}, ${formatCount(option.count)}`} checked={selectedTags.has(option.tag)} disabled={option.count === 0 && !selectedTags.has(option.tag)} onChange={() => onToggle(option.tag)} type="checkbox" /><span className="focus-flow__tag-option-name"><TagChip tag={option.tag} /></span><span className="focus-flow__tag-option-count">{option.count}</span></label>)}
        {visible.length === 0 && <p className="focus-flow__tag-picker-empty">No tags match this search.</p>}
      </fieldset>
      {visible.length > limit && <button className="focus-flow__button-quiet" onClick={() => setLimit((value) => value + 20)} type="button">Show more ({visible.length - limit})</button>}
      <footer className="focus-flow__tag-picker-actions"><button className="focus-flow__button-quiet" disabled={selectedTags.size === 0} onClick={onClear} type="button">Clear filters</button><button onClick={onClose} type="button">Done</button></footer>
    </div>
  </DialogSurface>;
}

function formatCount(count: number): string {
  return `${count} ${count === 1 ? 'Candidate' : 'Candidates'}`;
}
