import { useState } from 'react';
import { TagInput } from '../ui/TagInput';
import { BodyFieldsEditor } from '../work/BodyFieldsEditor';
import { formatErrorMessage } from '../ui/error-message';
import type { WorkBodyFields } from '../../application/work/work-body-fields';

export interface CandidateFormProps {
  suggestions: readonly string[];
  initialValue?: { title: string; tags: readonly string[]; bodyFields?: WorkBodyFields };
  onSave: (title: string, tags: readonly string[], bodyFields?: WorkBodyFields) => void | Promise<unknown>;
  onSaved: () => void;
}

export function CandidateForm({ suggestions, initialValue, onSave, onSaved }: CandidateFormProps) {
  const [title, setTitle] = useState(initialValue?.title ?? '');
  const [tags, setTags] = useState<string[]>([...(initialValue?.tags ?? [])]);
  const [bodyFields, setBodyFields] = useState(initialValue?.bodyFields ?? {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editing = initialValue !== undefined;
  const submit = async () => {
    if (!title.trim() || saving) return;
    setSaving(true); setError(null);
    try { if (Object.keys(bodyFields).length) await onSave(title.trim(), tags, bodyFields); else await onSave(title.trim(), tags); onSaved(); }
    catch (error) { setError(formatErrorMessage(error, candidateFailure(editing))); }
    finally { setSaving(false); }
  };
  return <form className="focus-flow__candidate-form" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
    <label>Title<input aria-label="Candidate title" disabled={saving} placeholder="What would you like to explore?" value={title} onChange={(event) => setTitle(event.currentTarget.value)} /></label>
    <TagInput disabled={saving} value={tags} onChange={setTags} suggestions={suggestions} />
    <BodyFieldsEditor headings={['Description', 'Entry Review', 'Acceptance Criteria']} value={bodyFields} onChange={setBodyFields} disabled={saving} />
    {error && <p role="alert">{error}</p>}
    <footer><button className="focus-flow__button-primary" disabled={saving || !title.trim()} type="submit">{candidateAction(saving, editing)}</button></footer>
  </form>;
}

function candidateFailure(editing: boolean): string {
  return `Could not ${editing ? 'save' : 'create'} the Candidate. Your title and tags are kept; try again.`;
}

function candidateAction(saving: boolean, editing: boolean): string {
  if (saving) return 'Saving…';
  return editing ? 'Save changes' : 'Create Candidate';
}
