import { useRef, useState } from 'react';
import type { RetrospectiveDraft } from '../../domain/sprint-close';
import { PlusIcon } from '../ui/Icons';
import { ActionMenu, MenuAction } from '../ui/ActionMenu';

const sections = [
  { key: 'wins', title: 'Wins', prompt: 'What should you keep?' },
  { key: 'friction', title: 'Friction', prompt: 'What made the work harder?' },
  { key: 'improvements', title: 'Improvements', prompt: 'What experiment is worth trying?' },
] as const;

export function RetrospectiveEditor({ value, onChange }: { value: RetrospectiveDraft; onChange: (value: RetrospectiveDraft) => void }) {
  return <section className="focus-flow__retrospective">
    <h2>What will you take forward?</h2>
    <p>One thought per item. Markdown supported; everything here is optional.</p>
    <div className="focus-flow__reflection-editor">{sections.map((section) => <ReflectionColumn key={section.key} title={section.title} prompt={section.prompt} items={value[section.key]} onChange={(items) => onChange({ ...value, [section.key]: items })} />)}</div>
  </section>;
}

function ReflectionColumn({ title, prompt, items, onChange }: { title: string; prompt: string; items: readonly string[]; onChange: (items: string[]) => void }) {
  const [editing, setEditing] = useState<{ index: number; original: string | null } | null>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const update = (index: number, text: string) => onChange(items.map((item, position) => position === index ? text : item));
  const finish = () => { setEditing(null); addRef.current?.focus(); };
  return <section className="focus-flow__reflection-column">
    <h3>{title}<span className="focus-flow__backlog-count">{items.filter((item) => item.trim()).length}</span></h3>
    <p className="focus-flow__field-hint">{prompt}</p>
    <ol className="focus-flow__reflection-items">{items.map((item, index) => <li key={index}>
      {editing?.index === index ? <div className="focus-flow__reflection-composer">
        <textarea ref={(node) => { node?.focus(); }} aria-label={index === 0 ? title : `${title} item ${index + 1}`} placeholder={prompt} rows={2} value={item} onChange={(event) => update(index, event.currentTarget.value)} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && item.trim()) { event.preventDefault(); finish(); } }} />
        <footer><button type="button" className="focus-flow__button-primary" aria-label={`Save ${title} item`} disabled={!item.trim()} onClick={finish}>Save item</button><button type="button" className="focus-flow__button-quiet" onClick={() => { if (editing.original === null) onChange(items.filter((_, position) => position !== index)); else update(index, editing.original); finish(); }}>Cancel</button></footer>
      </div> : <><button className="focus-flow__reflection-card" type="button" aria-label={`Edit ${title} item ${index + 1}`} onClick={() => setEditing({ index, original: item })}>{item || 'Empty item — click to write'}</button><ActionMenu label={`Actions for ${title} item ${index + 1}`}><MenuAction onClick={() => setEditing({ index, original: item })}>Edit item</MenuAction><MenuAction destructive onClick={() => onChange(items.filter((_, position) => position !== index))}>Remove item</MenuAction></ActionMenu></>}
    </li>)}</ol>
    <button ref={addRef} aria-label={`Add item to ${title}`} className="focus-flow__button-quiet" disabled={editing !== null} onClick={() => { setEditing({ index: items.length, original: null }); onChange([...items, '']); }} type="button"><PlusIcon /> Add item</button>
  </section>;
}
