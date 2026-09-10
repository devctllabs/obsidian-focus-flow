import { editableCriteria, editableNarrative, type EditableOutcome, type EditOutcomeRequest } from '../../application/work/edit-outcome';
import { useRef, useState } from 'react';
import { DialogSurface } from '../ui/DialogSurface';
import { TagInput } from '../ui/TagInput';
import { CompactTags } from '../ui/Tags';
import { AcceptanceCriteriaEditor } from './AcceptanceCriteriaEditor';
import { BodyFieldsEditor } from './BodyFieldsEditor';
import { formatErrorMessage } from '../ui/error-message';

export interface OutcomeEditorProps {
  item: EditableOutcome;
  suggestions: readonly string[];
  onSave: (request: EditOutcomeRequest) => Promise<unknown>;
  onClose: () => void;
}

export function OutcomeEditor({ item, suggestions, onSave, onClose }: OutcomeEditorProps) {
  const titleRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(item.title);
  const [tags, setTags] = useState<string[]>([...item.tags]);
  const [criteria, setCriteria] = useState([...editableCriteria(item)]);
  const [bodyFields, setBodyFields] = useState(editableNarrative(item));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inherited = item.effectiveTags.filter((tag) => !item.tags.includes(tag));
  const submit = async () => {
    if (saving || !title.trim()) return;
    setSaving(true); setError(null);
    try {
      await onSave({ id: item.id, type: item.type, title: title.trim(), tags, bodyFields, acceptanceCriteria: criteria.map((criterion) => ({ ...criterion, text: criterion.text.trim() })).filter((criterion) => criterion.text !== ''), expected: { title: item.title, tags: item.tags, bodyFields: editableNarrative(item), acceptanceCriteria: editableCriteria(item) } });
      onClose();
    } catch (error) { setError(formatErrorMessage(error, 'Could not save changes. Your edits are kept; try again.')); }
    finally { setSaving(false); }
  };
  return <DialogSurface title={`Edit ${item.key}`} initialFocusRef={titleRef} onClose={() => { if (!saving) onClose(); }}><form className="focus-flow__candidate-form" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
    <label>Title<input ref={titleRef} aria-label="Title" value={title} disabled={saving} onChange={(event) => setTitle(event.currentTarget.value)} /></label>
    <TagInput value={tags} onChange={setTags} suggestions={suggestions} disabled={saving} />
    {inherited.length > 0 && <div className="focus-flow__inherited-tags"><span>Inherited</span><CompactTags tags={inherited} /></div>}
    <BodyFieldsEditor headings={[item.type === 'epic' ? 'Intent' : 'Description']} value={bodyFields} onChange={setBodyFields} disabled={saving} />
    <AcceptanceCriteriaEditor value={criteria} onChange={setCriteria} disabled={saving} />
    {item.lifecycle === 'active_sprint' && <p className="focus-flow__field-hint">Criteria changes are included in this Sprint’s Delta.</p>}
    {error && <p role="alert">{error}</p>}
    <footer><button className="focus-flow__button-primary" disabled={saving || !title.trim()} type="submit">{saving ? 'Saving…' : 'Save changes'}</button></footer>
  </form></DialogSurface>;
}
