import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { expect, it } from 'vitest';
import { BodyFieldsEditor } from './BodyFieldsEditor';
import type { WorkBodyFields } from '../../application/work/work-body-fields';

it('authors Markdown criteria as separate checklist items without discarding guidance', async () => {
  function Harness() {
    const [value, setValue] = useState<WorkBodyFields>({ 'Acceptance Criteria': 'Keep this guidance.\n\n- [ ] Existing' });
    return <><BodyFieldsEditor headings={['Acceptance Criteria']} value={value} onChange={setValue} /><output>{value['Acceptance Criteria']}</output></>;
  }
  const user = userEvent.setup();
  render(<Harness />);
  await user.click(screen.getByRole('button', { name: 'Add criterion' }));
  await user.type(screen.getByLabelText('Criterion 2'), '**Observable**\n- On mobile');
  await user.click(screen.getByLabelText('Criterion 2 met'));
  expect(screen.getByRole('status')).toHaveTextContent('Keep this guidance.');
  expect(screen.getByRole('status').textContent).toContain('- [x] **Observable**\n  - On mobile');
});
