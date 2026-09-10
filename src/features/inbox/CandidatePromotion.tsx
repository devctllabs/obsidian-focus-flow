import { useRef, useState } from 'react';
import type { ProjectedManagedEntity } from '../../application/indexing/work-index';
import type { CandidateAcceptanceFields } from '../../application/work/triage-candidate';
import { DialogSurface } from '../ui/DialogSurface';
import { TagInput } from '../ui/TagInput';
import { BodyFieldsEditor } from '../work/BodyFieldsEditor';
import { formatErrorMessage } from '../ui/error-message';
import { EpicPicker } from '../work/EpicPicker';

export function CandidatePromotion({ candidate, target, epics, suggestions, onAccept, onClose }: {
  candidate: Extract<ProjectedManagedEntity, { type: 'candidate' }>;
  target: 'story' | 'epic';
  epics: readonly Extract<ProjectedManagedEntity, { type: 'epic' }>[];
  suggestions: readonly string[];
  onAccept: (fields: CandidateAcceptanceFields, epicId?: string) => void | Promise<unknown>;
  onClose: () => void;
}) {
  const titleRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(candidate.title);
  const [tags, setTags] = useState([...candidate.tags]);
  const [bodyFields, setBodyFields] = useState(() => promotionBodyFields(candidate, target));
  const [epicId, setEpicId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = promotionName(target);
  const canSave = canPromote({ saving, title, target, epicId });
  const save = async () => {
    if (!canSave) return;
    setSaving(true); setError(null);
    try {
      await onAccept({ title: title.trim(), tags, bodyFields, expected: { title: candidate.title, tags: candidate.tags, bodyFields: candidate.bodyFields ?? {} } }, promotionEpicId(target, epicId));
      onClose();
    } catch (error) { setError(formatErrorMessage(error, 'Could not create this item. Your edits are kept.')); }
    finally { setSaving(false); }
  };
  return <DialogSurface title={`Create ${name} from ${candidate.key}`} initialFocusRef={titleRef} onClose={() => closeUnlessSaving(saving, onClose)}><form className="focus-flow__candidate-form" onSubmit={(event) => { event.preventDefault(); void save(); }}>
    <label>Title<input aria-label="Title" ref={titleRef} value={title} disabled={saving} onChange={(event) => setTitle(event.currentTarget.value)} /></label>
    <PromotionEpic target={target} epics={epics} epicId={epicId} saving={saving} onChange={setEpicId} />
    <TagInput value={tags} onChange={setTags} suggestions={suggestions} disabled={saving} />
    <BodyFieldsEditor headings={[promotionHeading(target), 'Acceptance Criteria']} value={bodyFields} onChange={setBodyFields} disabled={saving} />
    <p className="focus-flow__field-hint">Same note, same ID. Entry Review and other notes are kept.</p>
    {error && <p role="alert">{error}</p>}
    <footer><button aria-label={`Create ${name}`} className="focus-flow__button-primary" type="submit" disabled={!canSave}>{saving ? 'Creating…' : `Create ${name}`}</button></footer>
  </form></DialogSurface>;
}

type PromotionTarget = 'story' | 'epic';
type Candidate = Extract<ProjectedManagedEntity, { type: 'candidate' }>;
type Epic = Extract<ProjectedManagedEntity, { type: 'epic' }>;

function promotionBodyFields(candidate: Candidate, target: PromotionTarget) {
  if (target !== 'epic') return { ...candidate.bodyFields };
  return { ...candidate.bodyFields, Intent: candidate.bodyFields?.Intent || candidate.bodyFields?.Description || '' };
}

function promotionName(target: PromotionTarget): 'Epic' | 'Story' { return target === 'epic' ? 'Epic' : 'Story'; }
function promotionHeading(target: PromotionTarget): 'Intent' | 'Description' { return target === 'epic' ? 'Intent' : 'Description'; }
function promotionEpicId(target: PromotionTarget, epicId: string): string | undefined { return target === 'story' ? epicId : undefined; }
function closeUnlessSaving(saving: boolean, close: () => void): void { if (!saving) close(); }
function canPromote({ saving, title, target, epicId }: { saving: boolean; title: string; target: PromotionTarget; epicId: string }): boolean {
  if (saving || !title.trim()) return false;
  return target === 'epic' || Boolean(epicId);
}

function PromotionEpic({ target, epics, epicId, saving, onChange }: { target: PromotionTarget; epics: readonly Epic[]; epicId: string; saving: boolean; onChange: (id: string) => void }) {
  if (target !== 'story') return null;
  return <EpicPicker epics={epics} value={epicId} onChange={onChange} disabled={saving} />;
}
