import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../settings';
import { RootSetupSurface } from './RootSetupSurface';

it('reviews a chosen existing root, reuses its templates, and keeps setup open on failure', async () => {
  const user = userEvent.setup();
  const confirm = vi.fn().mockRejectedValue(new Error('Could not save settings. Try again.'));
  const onDone = vi.fn();
  const preview = vi.fn(async (_intent: 'create' | 'open', root: string) => ({ root, missingFolders: [], missingTemplates: [], warnings: [], errors: [] }));
  render(<RootSetupSurface intent="open" controller={{ settings: DEFAULT_SETTINGS, folders: ['Existing'], files: ['Existing/Templates/Candidate.md'], preview, confirm }} onDone={onDone} onBack={vi.fn()} />);
  expect(screen.getByRole('searchbox', { name: 'Find a folder' })).toBeVisible();
  expect(screen.queryByLabelText('Workspace folder')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Browse folders…' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Open folder Existing' }));
  await user.click(screen.getByRole('button', { name: 'Review setup' }));
  expect(within(await screen.findByRole('region', { name: 'Setup preview' })).getByText(/Existing files will be kept/)).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Use this workspace' }));
  expect(confirm).toHaveBeenCalledWith('open', 'Existing', { candidate: 'Existing/Templates/Candidate.md', task: 'Existing/Templates/Task.md', retrospective: 'Existing/Templates/Retrospective.md' });
  expect(await screen.findByRole('alert')).toHaveTextContent('Try again');
  expect(onDone).not.toHaveBeenCalled();
});

it('creates inside the visible parent picker and keeps the selection when returning from review', async () => {
  const user = userEvent.setup();
  const preview = vi.fn(async (_intent: 'create' | 'open', root: string) => ({ root, missingFolders: [root], missingTemplates: [], warnings: [], errors: [] }));
  render(<RootSetupSurface intent="create" controller={{ settings: DEFAULT_SETTINGS, folders: ['Projects', 'Projects/FocusFlow'], files: [], preview, confirm: vi.fn() }} onDone={vi.fn()} onBack={vi.fn()} />);

  expect(screen.getByText('Templates', { exact: true })).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Open folder Projects' }));
  expect(screen.getByRole('status')).toHaveTextContent('That folder name is already in use here. Choose a different name.');
  expect(screen.getByRole('button', { name: 'Review setup' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Back' }).querySelector('svg')).not.toBeNull();
  await user.clear(screen.getByRole('textbox', { name: 'Folder name' }));
  await user.type(screen.getByRole('textbox', { name: 'Folder name' }), 'New Focus');
  await user.click(screen.getByRole('button', { name: 'Review setup' }));

  expect(preview).toHaveBeenCalledWith('create', 'Projects/New Focus', expect.objectContaining({ task: 'Projects/New Focus/Templates/Task.md' }));
  await user.click(screen.getByRole('button', { name: 'Back' }));

  expect(screen.getByRole('textbox', { name: 'Folder name' })).toHaveValue('New Focus');
  expect(screen.getByText('Vault / Projects / New Focus')).toBeVisible();
});
