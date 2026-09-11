import { useId, useMemo, useState, type CSSProperties } from 'react';
import type { TagCatalogService } from '../../application/tags/tag-catalog';
import { isTagColor, normalizeCatalogTag, type TagCatalogEntry } from '../../domain/tag-catalog';
import { ActionMenu, MenuAction } from '../ui/ActionMenu';
import { DialogSurface } from '../ui/DialogSurface';
import { CheckIcon, ChevronIcon } from '../ui/Icons';
import { TagChip } from '../ui/Tags';
import { useTagCatalog } from '../ui/TagCatalog';
import { formatErrorMessage } from '../ui/error-message';

const SWATCHES = [
  ['Violet', '#6750A4'], ['Blue', '#2563EB'], ['Teal', '#0F766E'],
  ['Green', '#4D7C0F'], ['Amber', '#B45309'], ['Rose', '#BE185D'],
] as const;
const PAGE_SIZE = 6;
const VALID_TAG = /^[\p{L}\p{N}_/-]+$/u;

type CatalogWriter = Pick<TagCatalogService, 'upsert' | 'remove'>;
type RunCatalogOperation = (operation: () => Promise<void>, success: string) => Promise<boolean>;

export function TagCatalogSettings({
  service,
  tags,
  currentTagUsage = {},
}: {
  service: CatalogWriter;
  tags: readonly string[];
  currentTagUsage?: Readonly<Record<string, number>>;
}) {
  const { entries, diagnostics } = useTagCatalog();
  const panelId = useId();
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [removingTag, setRemovingTag] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [hex, setHex] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState('');
  const catalogTags = useMemo(() => Object.keys(entries).sort((a, b) => a.localeCompare(b)), [entries]);
  const allTags = useMemo(() => [...new Set([...catalogTags, ...tags])], [catalogTags, tags]);
  const view = catalogView({ entries, allTags, query, page, removingTag, currentTagUsage });
  const changePage = (next: number) => {
    setPage(next);
    setEditing(null);
    setError(null);
  };
  const run = async (operation: () => Promise<void>, success: string) => {
    setPending(true);
    setError(null);
    setSaved('');
    try {
      await operation();
      setSaved(success);
      return true;
    } catch (caught) {
      setError(formatErrorMessage(caught, 'Could not update this tag. Try again.'));
      return false;
    } finally {
      setPending(false);
    }
  };
  const edit = (tag: string) => {
    setEditing(editing === tag ? null : tag);
    setDescription(entries[tag]?.description ?? '');
    setHex(entries[tag]?.color ?? '');
    setError(null);
  };
  const saveColor = (tag: string, color: string | null) => {
    setHex(color ?? '');
    void run(() => service.upsert(tag, { color }), color === null ? `Color cleared for #${tag}` : `Color saved for #${tag}`);
  };
  const removeEntry = async () => {
    if (removingTag === null) return;
    const removed = await run(() => service.remove(removingTag), `Removed #${removingTag} from the catalog`);
    if (removed) {
      setEditing(null);
      setRemovingTag(null);
    }
  };

  return <>
    <section className="focus-flow__tag-catalog-settings" aria-label="Tags">
      <h2><button className="focus-flow__settings-disclosure" type="button" aria-label="Tags" aria-describedby={`${panelId}-description`} aria-expanded={expanded} aria-controls={panelId} disabled={pending} onClick={() => setExpanded(!expanded)}><span className="focus-flow__settings-disclosure-copy"><span>Tags</span><small id={`${panelId}-description`}>{catalogTags.length} cataloged · {view.customColorCount} custom {plural(view.customColorCount, 'color', 'colors')}</small></span><span className="focus-flow__settings-disclosure-value">{allTags.length} {plural(allTags.length, 'tag', 'tags')}</span><ChevronIcon direction={expanded ? 'down' : 'right'} /></button></h2>
      {diagnostics.map((diagnostic) => <p className="focus-flow__error" role="alert" key={diagnostic}>{diagnostic} Other notes are unaffected.</p>)}
      <div id={panelId} hidden={!expanded}>{expanded && <>
        <input type="search" aria-label="Find or add a tag" placeholder="Find or add a tag…" value={query} disabled={pending} onChange={(event) => { setQuery(event.currentTarget.value); changePage(0); }} />
        <TagSearchFeedback canAdd={view.canAddQuery} tag={view.normalizedQuery} total={allTags.length} matches={view.options.length} pending={pending} onAdd={() => void run(() => service.upsert(view.normalizedQuery), `Added #${view.normalizedQuery} to the catalog`).then((didSave) => { if (didSave) setQuery(''); })} />
        <ul className="focus-flow__tag-catalog-list">{view.options.slice(view.offset, view.offset + PAGE_SIZE).map((tag) => <TagCatalogRow key={tag} tag={tag} entry={entries[tag]} editing={editing === tag} pending={pending} description={description} hex={hex} error={error} service={service} run={run} onEdit={edit} onRemove={(value) => { setError(null); setRemovingTag(value); }} onDescriptionChange={setDescription} onHexChange={setHex} onSaveColor={saveColor} />)}</ul>
        <TagPagination total={view.options.length} offset={view.offset} page={view.currentPage} lastPage={view.lastPage} pending={pending} onChange={changePage} />
        <p className="focus-flow__sr-only" role="status">{saved}</p>
      </>}</div>
    </section>
    <TagRemovalDialog tag={removingTag} currentUses={view.currentUses} pending={pending} error={error} onClose={() => setRemovingTag(null)} onRemove={removeEntry} />
  </>;
}

interface TagCatalogRowProps {
  tag: string;
  entry?: TagCatalogEntry;
  editing: boolean;
  pending: boolean;
  description: string;
  hex: string;
  error: string | null;
  service: CatalogWriter;
  run: RunCatalogOperation;
  onEdit: (tag: string) => void;
  onRemove: (tag: string) => void;
  onDescriptionChange: (value: string) => void;
  onHexChange: (value: string) => void;
  onSaveColor: (tag: string, color: string | null) => void;
}

function TagCatalogRow(props: TagCatalogRowProps) {
  const { editing } = props;
  return <li>
    <div className={`focus-flow__tag-catalog-row-shell${editing ? ' is-expanded' : ''}`}>
      <TagRowButton {...props} />
      {editing && <TagRowMenu {...props} />}
    </div>
    {editing && <TagEditor {...props} />}
  </li>;
}

function TagRowButton({ tag, entry, editing, pending, onEdit }: TagCatalogRowProps) {
  const markerStyle = entry?.color ? { '--ff-tag-marker': entry.color } as CSSProperties : undefined;
  const description = entry?.description;
  return <button className="focus-flow__tag-catalog-row" type="button" disabled={pending} aria-label={description ?? `Edit #${tag}`} aria-description={description ? `Edit #${tag}` : undefined} aria-expanded={editing} data-tooltip-position={description ? 'top' : undefined} onClick={() => onEdit(tag)}>
    <TagChip tag={tag} />
    <span className="focus-flow__tag-catalog-row-value"><span className="focus-flow__tag-color-marker" style={markerStyle} aria-hidden="true" /><span>{entry?.color ?? 'Neutral'}</span><ChevronIcon direction={editing ? 'down' : 'right'} /></span>
  </button>;
}

function TagRowMenu({ tag, entry, pending, service, run, onRemove }: TagCatalogRowProps) {
  const action = entry
    ? <MenuAction destructive onClick={() => onRemove(tag)}>Remove from catalog…</MenuAction>
    : <MenuAction disabled={pending} onClick={() => void run(() => service.upsert(tag), `Added #${tag} to the catalog`)}>Add to catalog</MenuAction>;
  return <span className="focus-flow__tag-catalog-row-actions"><ActionMenu label={`More actions for #${tag}`}>{action}</ActionMenu></span>;
}

function TagEditor({ tag, entry, pending, description, hex, error, service, run, onDescriptionChange, onHexChange, onSaveColor }: TagCatalogRowProps) {
  const saveDescription = () => service.upsert(tag, { description: description.trim() ? description : null });
  const saveHex = () => service.upsert(tag, { color: hex });
  return <div className="focus-flow__tag-catalog-editor">
    <form className="focus-flow__tag-description-editor" onSubmit={(event) => { event.preventDefault(); void run(saveDescription, `Description saved for #${tag}`); }}>
      <label>Description <span className="focus-flow__optional">optional</span><textarea aria-label="Description" value={description} disabled={pending} onChange={(event) => onDescriptionChange(event.currentTarget.value)} /></label>
      <button type="submit" disabled={pending}>Save description</button>
    </form>
    <div className="focus-flow__color-swatches" role="group" aria-label={`Color for #${tag}`}>
      <button type="button" disabled={pending} aria-pressed={!entry?.color} onClick={() => onSaveColor(tag, null)}>Neutral</button>
      {SWATCHES.map(([name, color]) => <button className="focus-flow__color-swatch" type="button" key={color} title={name} aria-label={name} aria-pressed={entry?.color === color} disabled={pending} onClick={() => onSaveColor(tag, color)}><span style={{ backgroundColor: color }} aria-hidden="true" />{entry?.color === color && <CheckIcon />}</button>)}
    </div>
    <form className="focus-flow__custom-color" onSubmit={(event) => { event.preventDefault(); if (isTagColor(hex)) void run(saveHex, `Color saved for #${tag}`); }}>
      <label>Custom HEX<input aria-label="Custom HEX" autoComplete="off" spellCheck={false} maxLength={7} placeholder="#6750A4" value={hex} disabled={pending} onChange={(event) => onHexChange(event.currentTarget.value.toUpperCase())} /></label>
      <button type="submit" disabled={pending || !isTagColor(hex)}>{pending ? 'Saving…' : 'Save color'}</button>
    </form>
    {error && <p role="alert" className="focus-flow__error">{error}</p>}
  </div>;
}

function TagRemovalDialog({ tag, currentUses, pending, error, onClose, onRemove }: { tag: string | null; currentUses: number; pending: boolean; error: string | null; onClose: () => void; onRemove: () => Promise<void> }) {
  if (tag === null) return null;
  if (currentUses > 0) return <DialogSurface title={`Remove #${tag} from current work first`} description={`#${tag} is used on ${currentUses} current ${currentUses === 1 ? 'note' : 'notes'}.`} onClose={onClose}>
    <p>Remove the tag from unfinished work before removing its catalog entry. Completed work and Sprint history do not block removal.</p>
  </DialogSurface>;
  return <DialogSurface title={`Remove #${tag} from catalog?`} description="This removes its description and custom color." onClose={() => { if (!pending) onClose(); }}>
    <p>Existing tags on completed work and Sprint history stay unchanged. Future automated authoring will no longer reuse this tag.</p>
    {error && <p role="alert" className="focus-flow__error">{error}</p>}
    <div className="focus-flow__dialog-actions"><button type="button" disabled={pending} onClick={onClose}>Cancel</button><button type="button" className="focus-flow__button-danger" disabled={pending} onClick={() => void onRemove()}>{pending ? 'Removing…' : 'Remove'}</button></div>
  </DialogSurface>;
}

function catalogView({ entries, allTags, query, page, removingTag, currentTagUsage }: {
  entries: Readonly<Record<string, TagCatalogEntry>>;
  allTags: readonly string[];
  query: string;
  page: number;
  removingTag: string | null;
  currentTagUsage: Readonly<Record<string, number>>;
}) {
  const normalizedQuery = normalizeCatalogTag(query);
  const options = allTags.filter((tag) => tag.toLocaleLowerCase().includes(normalizedQuery.toLocaleLowerCase()));
  const lastPage = Math.max(0, Math.ceil(options.length / PAGE_SIZE) - 1);
  const currentPage = Math.min(page, lastPage);
  return {
    normalizedQuery,
    options,
    lastPage,
    currentPage,
    offset: currentPage * PAGE_SIZE,
    canAddQuery: VALID_TAG.test(normalizedQuery) && !allTags.includes(normalizedQuery),
    customColorCount: Object.values(entries).filter((entry) => entry.color).length,
    currentUses: removingTag === null ? 0 : currentTagUsage[removingTag] ?? 0,
  };
}

function plural(count: number, singular: string, pluralForm: string): string {
  return count === 1 ? singular : pluralForm;
}

function TagSearchFeedback({ canAdd, tag, total, matches, pending, onAdd }: { canAdd: boolean; tag: string; total: number; matches: number; pending: boolean; onAdd: () => void }) {
  if (canAdd) return <button type="button" disabled={pending} onClick={onAdd}>Add #{tag} to catalog</button>;
  if (matches > 0) return null;
  return <p className="focus-flow__report-caption">{total === 0 ? 'Add a catalog tag or use a tag on work first.' : 'No tags match this search.'}</p>;
}

function TagPagination({ total, offset, page, lastPage, pending, onChange }: { total: number; offset: number; page: number; lastPage: number; pending: boolean; onChange: (page: number) => void }) {
  if (total <= PAGE_SIZE) return null;
  return <nav className="focus-flow__tag-catalog-pages" aria-label="Tag pages"><span aria-live="polite">{offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total} tags</span><button type="button" aria-label="Previous tags" disabled={pending || page === 0} onClick={() => onChange(page - 1)}>Previous</button><button type="button" aria-label="Next tags" disabled={pending || page === lastPage} onClick={() => onChange(page + 1)}>Next</button></nav>;
}
