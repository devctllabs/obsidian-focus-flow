import type { AcceptanceCriterion } from '../../domain/work-note';
import { CloseIcon, PlusIcon } from '../ui/Icons';

export function AcceptanceCriteriaEditor({ value, onChange, disabled = false }: { value: readonly AcceptanceCriterion[]; onChange: (value: AcceptanceCriterion[]) => void; disabled?: boolean }) {
  return <fieldset className="focus-flow__criteria-editor"><legend>Acceptance Criteria</legend><ol>{value.map((criterion, index) => <li key={index}>
    <input aria-label={`Criterion ${index + 1} met`} type="checkbox" checked={criterion.checked} disabled={disabled} onChange={(event) => onChange(value.map((item, position) => position === index ? { ...item, checked: event.currentTarget.checked } : item))} />
    <textarea aria-label={`Criterion ${index + 1}`} rows={2} placeholder="An observable result… · Markdown" value={criterion.text} disabled={disabled} onChange={(event) => onChange(value.map((item, position) => position === index ? { ...item, text: event.currentTarget.value } : item))} />
    <button aria-label={`Remove criterion ${index + 1}`} className="focus-flow__icon-button" disabled={disabled} onClick={() => onChange(value.filter((_, position) => position !== index))} type="button"><CloseIcon /></button>
  </li>)}</ol><button className="focus-flow__button-quiet" disabled={disabled || value.at(-1)?.text.trim() === ''} onClick={() => onChange([...value, { text: '', checked: false }])} type="button"><PlusIcon /> Add criterion</button></fieldset>;
}
