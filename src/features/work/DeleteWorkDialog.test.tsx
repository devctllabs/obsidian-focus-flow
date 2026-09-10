import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { story } from '../../test/storybook/fixtures';
import { DeleteWorkDialog } from './DeleteWorkDialog';

it('requires acknowledgement for content and retains the preview on failure', async () => {
  const user = userEvent.setup();
  const preview = { note: story, content: 'Research', warnings: ['This note contains content.'], blockers: [] };
  const onDelete = vi.fn().mockRejectedValue(new Error('This note changed. Reopen Delete.'));
  const onClose = vi.fn();
  render(<DeleteWorkDialog item={story} onPreview={async () => preview} onDelete={onDelete} onClose={onClose} />);
  const trash = await screen.findByRole('button', { name: 'Move to trash' });
  expect(trash).toBeDisabled();
  await user.click(screen.getByRole('checkbox', { name: 'I have reviewed this note and want to remove its content' }));
  await user.click(trash);
  expect(onDelete).toHaveBeenCalledWith(preview);
  expect(await screen.findByRole('alert')).toHaveTextContent('Reopen Delete');
  expect(screen.getByRole('alert')).toHaveTextContent('Could not delete note');
  expect(onClose).not.toHaveBeenCalled();
});
it('shows why a parent cannot be deleted', async () => {
  render(<DeleteWorkDialog item={story} onPreview={async () => ({ note: story, content: '', warnings: [], blockers: ['Move its Tasks first.'] })} onDelete={vi.fn()} onClose={vi.fn()} />);
  expect(await screen.findByText('Move its Tasks first.')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Move to trash' })).toBeDisabled();
});
