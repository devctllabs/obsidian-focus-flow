import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { activeStory, epic } from '../../test/storybook/fixtures';
import { OutcomeEditor } from './OutcomeEditor';

describe('typed outcome editor', () => {
  it('keeps the typed draft on save failure', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<OutcomeEditor item={activeStory} suggestions={[]} onSave={vi.fn().mockRejectedValue(new Error('This item changed. Reopen the editor.'))} onClose={onClose} />);
    await user.clear(screen.getByLabelText('Title'));
    await user.type(screen.getByLabelText('Title'), 'My unsaved result');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(screen.getByRole('alert')).toHaveTextContent('This item changed');
    expect(screen.getByLabelText('Title')).toHaveValue('My unsaved result');
    expect(onClose).not.toHaveBeenCalled();
  });
  it.each([activeStory, epic])('edits $type fields without changing planning or lifecycle', async (item) => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<OutcomeEditor item={item} suggestions={['focus']} onSave={onSave} onClose={vi.fn()} />);
    expect(screen.getByLabelText('Title')).toHaveFocus();
    await user.clear(screen.getByLabelText('Title'));
    await user.type(screen.getByLabelText('Title'), 'A clearer outcome');
    await user.type(screen.getByLabelText(item.type === 'epic' ? 'Intent' : 'Description'), 'A **meaningful** result.');
    await user.click(screen.getByRole('button', { name: 'Add criterion' }));
    const criteria = screen.getAllByRole('textbox', { name: /^Criterion / });
    expect(criteria.at(-1)!.tagName).toBe('TEXTAREA');
    await user.type(criteria.at(-1)!, 'Can be observed\n- On narrow screens');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(onSave).toHaveBeenCalledWith({ id: item.id, type: item.type, title: 'A clearer outcome', tags: item.tags, bodyFields: { [item.type === 'epic' ? 'Intent' : 'Description']: 'A **meaningful** result.' }, acceptanceCriteria: [...(item.acceptanceCriteria ?? []), { text: 'Can be observed\n- On narrow screens', checked: false }], expected: { title: item.title, tags: item.tags, bodyFields: {}, acceptanceCriteria: item.acceptanceCriteria ?? [] } });
  });
});
