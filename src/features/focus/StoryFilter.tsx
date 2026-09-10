import { useRef, useState } from 'react';
import { DialogSurface } from '../ui/DialogSurface';
import { CheckIcon, CloseIcon, FilterIcon } from '../ui/Icons';

interface FilterStory { id: string; key: string; title: string }

export function StoryFilter({ stories, value, onChange }: { stories: readonly FilterStory[]; value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = stories.find((story) => story.id === value);
  const matching = stories.filter((story) => `${story.key} ${story.title}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const choose = (id: string) => { onChange(id); setOpen(false); };
  return <div className="focus-flow__story-filter">
    <button type="button" aria-label="Filter by Story" aria-haspopup="dialog" className="focus-flow__button-quiet" onClick={() => { setQuery(''); setOpen(true); }}><FilterIcon />{selected?.key ?? 'Stories'}{!selected && <small>{stories.length}</small>}</button>
    {selected && <button type="button" className="focus-flow__icon-button" aria-label="Clear Story filter" title="Show all Stories" onClick={() => onChange('')}><CloseIcon /></button>}
    {open && <DialogSurface title="Stories" initialFocusRef={inputRef} onClose={() => setOpen(false)}><div className="focus-flow__story-picker">
      <input type="search" aria-label="Find a Story" ref={inputRef} placeholder="Find a Story…" value={query} onChange={(event) => setQuery(event.currentTarget.value)} />
      <div className="focus-flow__archive-results"><ol>
        <li><button type="button" onClick={() => choose('')} aria-current={!selected ? 'true' : undefined}><span>All Stories</span>{!selected && <CheckIcon />}</button></li>
        {matching.map((story) => <li key={story.id}><button type="button" aria-label={`Show ${story.key} ${story.title}`} aria-current={selected?.id === story.id ? 'true' : undefined} onClick={() => choose(story.id)}><span><strong>{story.key}</strong><small>{story.title}</small></span>{selected?.id === story.id && <CheckIcon />}</button></li>)}
      </ol>{matching.length === 0 && <p>No matching Stories.</p>}</div>
    </div></DialogSurface>}
  </div>;
}
