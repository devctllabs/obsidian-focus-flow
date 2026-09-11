import { useId, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { ProjectedManagedEntity } from '../../application/indexing/work-index';

export function EpicPicker({ epics, value, onChange, disabled = false, label = 'Parent Epic' }: {
  epics: readonly Extract<ProjectedManagedEntity, { type: 'epic' }>[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  label?: string;
}) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const available = epics.filter(isBacklogEpic);
  const selected = available.find((epic) => epic.id === value);
  const options = available.filter((epic) => `${epic.key} ${epic.title}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const position = Math.min(active, Math.max(0, options.length - 1));
  const choose = (next: string) => { onChange(next); setQuery(''); setOpen(false); };
  return <div className="focus-flow__epic-picker">
    <label htmlFor={id}>{label}</label>
    <input id={id} role="combobox" aria-label={label} aria-autocomplete="list" aria-expanded={open} aria-controls={open ? `${id}-options` : undefined} aria-activedescendant={open && options.length > 0 ? `${id}-${position}` : undefined} autoComplete="off" disabled={disabled} placeholder="Search active Epics…" value={epicPickerValue(open, query, selected)}
      onFocus={() => { setQuery(''); setOpen(true); }} onBlur={() => setOpen(false)}
      onChange={(event) => { setQuery(event.currentTarget.value); onChange(''); setActive(0); setOpen(true); }}
      onKeyDown={(event) => {
        handleEpicKey(event, { open, position, options, choose, setOpen, setActive });
      }} />
    <EpicOptions open={open} id={id} options={options} availableCount={available.length} position={position} onChoose={choose} />
  </div>;
}

type Epic = Extract<ProjectedManagedEntity, { type: 'epic' }>;
function isBacklogEpic(epic: Epic): boolean { return epic.lifecycle === 'backlog'; }
function epicPickerValue(open: boolean, query: string, selected: Epic | undefined): string {
  if (open || selected === undefined) return query;
  return `${selected.key} ${selected.title}`;
}

function handleEpicKey(event: ReactKeyboardEvent<HTMLInputElement>, context: { open: boolean; position: number; options: readonly Epic[]; choose: (id: string) => void; setOpen: (open: boolean) => void; setActive: (index: number) => void }): void {
  if (event.nativeEvent.isComposing) return;
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault(); context.setOpen(true);
    const direction = event.key === 'ArrowDown' ? 1 : -1;
    const length = Math.max(1, context.options.length);
    context.setActive((context.position + direction + length) % length);
  }
  if (event.key === 'Enter' && context.open) {
    event.preventDefault();
    const option = context.options[context.position];
    if (option) context.choose(option.id);
  }
  if (event.key === 'Escape' && context.open) {
    event.preventDefault(); event.stopPropagation(); context.setOpen(false);
  }
}

function EpicOptions({ open, id, options, availableCount, position, onChoose }: { open: boolean; id: string; options: readonly Epic[]; availableCount: number; position: number; onChoose: (id: string) => void }) {
  if (!open) return null;
  const empty = availableCount === 0 ? 'No active Epics. Create an Epic in Inbox first.' : 'No active Epics match. Try a different title or key.';
  return <div className="focus-flow__tag-suggestions"><ul role="listbox" id={`${id}-options`} aria-label="Active Epics">{options.map((epic, index) => <li key={epic.id} id={`${id}-${index}`} role="option" aria-selected={position === index} onPointerDown={(event) => event.preventDefault()} onClick={() => onChoose(epic.id)}>{epic.key} {epic.title}</li>)}</ul>{options.length === 0 && <p role="status">{empty}</p>}</div>;
}
