import { useId, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { CloseIcon } from './Icons';
import { TagChip } from './Tags';
import { useTagCatalog } from './TagCatalog';

export function TagInput({ value, onChange, suggestions, disabled = false }: { value: readonly string[]; onChange: (tags: string[]) => void; suggestions: readonly string[]; disabled?: boolean }) {
  const { entries } = useTagCatalog();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  const id = useId();
  const tag = query.trim().replace(/^#+/, '');
  const valid = /^[\p{L}\p{N}_/-]+$/u.test(tag);
  const options = tagOptions({ catalogTags: Object.keys(entries), suggestions, value, tag, valid });
  const open = focused && options.length > 0;
  const selectedIndex = Math.min(active, Math.max(0, options.length - 1));
  const add = (next: string) => {
    if (!value.includes(next)) onChange([...value, next]);
    setQuery(''); setActive(0); setFocused(false);
  };
  return <div className="focus-flow__tag-input">
    <label htmlFor={id}>Tags <span className="focus-flow__optional">optional</span></label>
    <SelectedTags value={value} disabled={disabled} onChange={onChange} />
    <input id={id} role="combobox" aria-label="Tags" aria-autocomplete="list" aria-expanded={open} aria-controls={open ? `${id}-options` : undefined} aria-activedescendant={open ? `${id}-${selectedIndex}` : undefined} autoComplete="off" disabled={disabled} value={query} placeholder="Find or create a tag…" onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onChange={(event) => { setQuery(event.currentTarget.value); setActive(0); setFocused(true); }} onKeyDown={(event) => {
      handleTagKey(event, { open, valid, tag, options, selectedIndex, add, setFocused, setActive });
    }} />
    <TagSuggestions open={open} id={id} options={options} selectedIndex={selectedIndex} entries={entries} suggestions={suggestions} onAdd={add} />
    <InvalidTagHint query={query} valid={valid} />
  </div>;
}

function tagOptions({ catalogTags, suggestions, value, tag, valid }: { catalogTags: readonly string[]; suggestions: readonly string[]; value: readonly string[]; tag: string; valid: boolean }): string[] {
  const options = [...new Set([...catalogTags].sort((left, right) => left.localeCompare(right)).concat(suggestions))]
    .filter((item) => !value.includes(item) && item.toLocaleLowerCase().includes(tag.toLocaleLowerCase())).slice(0, 6);
  if (valid && !value.includes(tag) && !options.includes(tag)) options.push(tag);
  return options;
}

function handleTagKey(event: ReactKeyboardEvent<HTMLInputElement>, context: { open: boolean; valid: boolean; tag: string; options: readonly string[]; selectedIndex: number; add: (tag: string) => void; setFocused: (focused: boolean) => void; setActive: (index: number) => void }): void {
  if (event.nativeEvent.isComposing) return;
  const move = (direction: number) => {
    event.preventDefault();
    context.setFocused(true);
    const length = Math.max(1, context.options.length);
    context.setActive((context.selectedIndex + direction + length) % length);
  };
  const enter = () => {
    event.preventDefault();
    const next = context.open ? context.options[context.selectedIndex] : context.valid ? context.tag : undefined;
    if (next) context.add(next);
  };
  const escape = () => {
    if (!context.open) return;
    event.preventDefault();
    event.stopPropagation();
    context.setFocused(false);
  };
  const handlers: Readonly<Record<string, () => void>> = {
    ArrowDown: () => move(1),
    ArrowUp: () => move(-1),
    Enter: enter,
    Escape: escape,
  };
  handlers[event.key]?.();
}

function SelectedTags({ value, disabled, onChange }: { value: readonly string[]; disabled: boolean; onChange: (tags: string[]) => void }) {
  if (value.length === 0) return null;
  return <div className="focus-flow__selected-tag-inputs">{value.map((item) => <button aria-label={`Remove tag ${item}`} disabled={disabled} key={item} onClick={() => onChange(value.filter((tag) => tag !== item))} type="button"><TagChip tag={item} /><CloseIcon /></button>)}</div>;
}

function TagSuggestions({ open, id, options, selectedIndex, entries, suggestions, onAdd }: { open: boolean; id: string; options: readonly string[]; selectedIndex: number; entries: Readonly<Record<string, { description?: string }>>; suggestions: readonly string[]; onAdd: (tag: string) => void }) {
  if (!open) return null;
  return <ul role="listbox" id={`${id}-options`} aria-label="Tag suggestions" className="focus-flow__tag-suggestions">{options.map((item, index) => <TagSuggestion key={item} item={item} index={index} id={id} selected={index === selectedIndex} description={entries[item]?.description} create={entries[item] === undefined && !suggestions.includes(item)} onAdd={onAdd} />)}</ul>;
}

function TagSuggestion({ item, index, id, selected, description, create, onAdd }: { item: string; index: number; id: string; selected: boolean; description?: string; create: boolean; onAdd: (tag: string) => void }) {
  return <li role="option" id={`${id}-${index}`} aria-label={`#${item}`} aria-selected={selected} onPointerDown={(event) => event.preventDefault()} onClick={() => onAdd(item)}><TagChip tag={item} />{description && <small>{description}</small>}{create && <small>Create tag</small>}</li>;
}

function InvalidTagHint({ query, valid }: { query: string; valid: boolean }) {
  if (query.trim() === '' || valid) return null;
  return <p className="focus-flow__field-hint">Use letters, numbers, hyphens, underscores or /.</p>;
}
