import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../settings';
import { RootSetupSurface } from './RootSetupSurface';

it('reviews a chosen existing root, reuses its templates, and keeps setup open on failure', async () => {
  const user = userEvent.setup();
  const confirm = vi.fn().mockRejectedValue(new Error('Could not save settings. Try again.'));
  const onDone = vi.fn();
  const preview = vi.fn(async (root: string) => ({ root, missingFolders: [], missingTemplates: [], warnings: [], errors: [] }));
  render(<RootSetupSurface controller={{ settings: DEFAULT_SETTINGS, folders: ['Existing'], files: ['Existing/Templates/Candidate.md'], preview, confirm }} onDone={onDone} onCancel={vi.fn()} />);
  await user.clear(screen.getByLabelText('Workspace folder'));
  await user.type(screen.getByLabelText('Workspace folder'), 'Existing');
  await user.click(screen.getByRole('button', { name: 'Review setup' }));
  expect(within(await screen.findByRole('region', { name: 'Setup preview' })).getByText(/Existing files will be kept/)).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Use this workspace' }));
  expect(confirm).toHaveBeenCalledWith('Existing', { candidate: 'Existing/Templates/Candidate.md', task: 'Existing/Templates/Task.md', retrospective: 'Existing/Templates/Retrospective.md' });
  expect(await screen.findByRole('alert')).toHaveTextContent('Try again');
  expect(onDone).not.toHaveBeenCalled();
});
