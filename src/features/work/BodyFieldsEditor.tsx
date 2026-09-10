import { readBodyFields, type WorkBodyFields, type WorkBodyHeading } from '../../application/work/work-body-fields';
import { useState } from 'react';
import { readAcceptanceCriteria, replaceAcceptanceCriteria } from '../../domain/acceptance-criteria';
import { AcceptanceCriteriaEditor } from './AcceptanceCriteriaEditor';

export function BodyFieldsEditor({ headings, value, onChange, disabled = false }: {
  headings: readonly WorkBodyHeading[];
  value: WorkBodyFields;
  onChange: (value: WorkBodyFields) => void;
  disabled?: boolean;
}) {
  return <div className="focus-flow__body-fields">{headings.map((heading) => heading === 'Acceptance Criteria' ? <MarkdownCriteriaField key={heading} value={value[heading] ?? ''} onChange={(text) => onChange({ ...value, [heading]: text })} disabled={disabled} /> : <label key={heading}><span>{heading}<small>Markdown</small></span><textarea aria-label={heading} rows={4} value={value[heading] ?? ''} disabled={disabled} onChange={(event) => onChange({ ...value, [heading]: event.currentTarget.value })} /></label>)}</div>;
}

function MarkdownCriteriaField({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled: boolean }) {
  const prefix = '## Acceptance Criteria\n\n';
  const [criteria, setCriteria] = useState(() => readAcceptanceCriteria(prefix + value));
  const guidance = readBodyFields(replaceAcceptanceCriteria(prefix + value, []))['Acceptance Criteria'];
  return <div>{guidance && <p className="focus-flow__criteria-guidance">{guidance}</p>}<AcceptanceCriteriaEditor value={criteria} disabled={disabled} onChange={(items) => {
    setCriteria(items);
    onChange(readBodyFields(replaceAcceptanceCriteria(prefix + value, items.filter((item) => item.text.trim() !== '')))['Acceptance Criteria'] ?? '');
  }} /></div>;
}
