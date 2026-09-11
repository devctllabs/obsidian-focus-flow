import type { TaskCreationDetails } from '../../application/work/create-work';
import { TagInput } from '../ui/TagInput';
import { BodyFieldsEditor } from './BodyFieldsEditor';

export function TaskFieldsEditor({ value, onChange, suggestions, disabled }: { value: TaskCreationDetails; onChange: (value: TaskCreationDetails) => void; suggestions: readonly string[]; disabled: boolean }) {
  return <><TagInput value={value.tags} onChange={(tags) => onChange({ ...value, tags })} suggestions={suggestions} disabled={disabled} /><BodyFieldsEditor headings={['Description', 'Acceptance Criteria']} value={value.bodyFields} onChange={(bodyFields) => onChange({ ...value, bodyFields })} disabled={disabled} /></>;
}
