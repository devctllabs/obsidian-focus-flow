import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, type FocusFlowSettings } from '../../settings';
import type { WorkspaceSetupIntent } from '../../application/root/root-workspace';
import { AppearanceStore } from '../appearance/appearance';
import { SettingsSurface, type SettingsController } from './SettingsSurface';

function controller() {
  let settings: FocusFlowSettings = { ...DEFAULT_SETTINGS, setupCompleted: true };
  return {
    getSettings: () => settings,
    updateSettings: vi.fn(async (update: (current: FocusFlowSettings) => FocusFlowSettings) => { settings = update(settings); }),
    previewRootSetup: vi.fn(async (_intent: WorkspaceSetupIntent, root: string) => ({ root, missingFolders: [], missingTemplates: [], warnings: [], errors: [] })),
    confirmRootSetup: vi.fn(async (_intent: WorkspaceSetupIntent, root: string) => { settings = { ...settings, rootFolder: root, setupCompleted: true }; }),
    requestRootMove: vi.fn(async (root: string) => { settings = { ...settings, rootFolder: root }; }),
    requestResumeRootMove: vi.fn(async () => undefined),
    hasPendingRootMove: () => false,
    listFolders: () => ['Projects/Existing Flow'],
  } satisfies SettingsController;
}

describe('SettingsSurface', () => {
  it('chooses an accent with the same compact swatch pattern as tag colors', async () => {
    const user = userEvent.setup();
    const settings = controller();
    const save = vi.fn(async () => undefined);
    const appearance = new AppearanceStore({ source: 'obsidian' }, save);
    render(<SettingsSurface controller={{ ...settings, appearance }} />);

    await user.click(screen.getByRole('button', { name: 'Accent color' }));
    expect(screen.getByRole('button', { name: 'Obsidian' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Indigo' })).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Teal' }));
    expect(save).toHaveBeenLastCalledWith({ source: 'custom', seed: '#0F766E' });
    expect(screen.getByRole('button', { name: 'Teal' })).toHaveAttribute('aria-pressed', 'true');

    const hex = screen.getByRole('textbox', { name: 'Custom accent HEX' });
    await user.clear(hex);
    await user.type(hex, '#F5D90A');
    await user.click(screen.getByRole('button', { name: 'Save color' }));
    expect(save).toHaveBeenLastCalledWith({ source: 'custom', seed: '#F5D90A' });
    await user.click(screen.getByRole('button', { name: 'Accent color' }));
    const value = screen.getByText('#F5D90A').parentElement!;
    expect(value).toHaveClass('focus-flow__settings-disclosure-value');
    expect(value.querySelector('.focus-flow__accent-marker')).not.toBeNull();
  });

  it('keeps Terminal notes at the end of Settings', () => {
    const settings = {
      ...controller(),
      appearance: new AppearanceStore({ source: 'obsidian' }, vi.fn(async () => undefined)),
      lifecycle: {
        previewArchive: vi.fn(async () => ({ entries: [], diagnostics: [], resuming: false })),
        organize: vi.fn(async () => undefined),
        previewReopen: vi.fn(),
        reopen: vi.fn(),
      },
    } satisfies SettingsController;
    render(<SettingsSurface controller={settings} />);
    const templates = screen.getByText('Templates', { exact: true }).closest('details')!;
    const accent = screen.getByRole('button', { name: 'Accent color' }).closest('section')!;
    const terminalNotes = screen.getByRole('heading', { name: 'Terminal notes' }).closest('section')!;
    expect(templates.compareDocumentPosition(accent) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(accent.compareDocumentPosition(terminalNotes) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(templates.compareDocumentPosition(terminalNotes) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(terminalNotes.nextElementSibling).toBeNull();
    const review = screen.getByRole('button', { name: 'Review terminal notes' });
    expect(review).toHaveClass('focus-flow__button-quiet');
    expect(review).toHaveTextContent('Review…');
  });

  it('explains the collapsed Templates section without revealing the editor', () => {
    render(<SettingsSurface controller={controller()} />);
    expect(screen.getByText('Candidate, Task and Retrospective note bodies')).toBeVisible();
    expect(screen.getByText('3 files')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Choose task template' })).not.toBeVisible();
  });
  it('offers Create and Open before initialization without offering Move', async () => {
    const user = userEvent.setup();
    const settings = controller();
    settings.getSettings().setupCompleted = false;
    render(<SettingsSurface controller={settings} />);
    await user.click(screen.getByRole('button', { name: 'Set up' }));
    expect(screen.getByRole('dialog', { name: 'Set up Focus Flow' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Create new workspace' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Open existing workspace' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Move current workspace' })).not.toBeInTheDocument();
  });
  it('confirms a folder move in the picker itself, without a second dialog', async () => {
    const user = userEvent.setup();
    const settings = controller();
    render(<SettingsSurface controller={settings} />);
    await user.click(screen.getByRole('button', { name: 'Change…' }));
    expect(screen.getByRole('button', { name: 'Create new workspace' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Open existing workspace' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Move current workspace' }));
    expect(screen.getByRole('button', { name: 'Move workspace' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Open folder Projects' }));
    expect(screen.getByText('Vault / Projects / FocusFlow')).toBeInTheDocument();
    expect(screen.getByText('Moves the Active Workspace from FocusFlow. Its old path will disappear.')).toBeInTheDocument();
    expect(settings.requestRootMove).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Move workspace' }));
    expect(settings.requestRootMove).toHaveBeenCalledWith('Projects/FocusFlow', true);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('chooses the weekday directly and a template through the vault file browser', async () => {
    const user = userEvent.setup();
    const settings = { ...controller(), listTemplateFiles: () => ['Templates/My task.md'] };
    render(<SettingsSurface controller={settings} />);
    await user.click(screen.getByRole('button', { name: 'Tuesday' }));
    expect(settings.getSettings().firstWeekday).toBe(2);
    await user.click(screen.getByText('Templates', { exact: true }));
    await user.click(screen.getByRole('button', { name: 'Choose task template' }));
    await user.type(screen.getByRole('searchbox', { name: 'Find a file' }), 'My task');
    await user.click(screen.getByRole('button', { name: 'Select file Templates/My task.md' }));
    expect(settings.getSettings().templates.task).not.toBe('Templates/My task.md');
    await user.click(screen.getByRole('button', { name: 'Use template' }));
    expect(settings.getSettings().templates.task).toBe('Templates/My task.md');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('shows current values without storage and WIP input fields until editing', async () => {
    const user = userEvent.setup();
    const settings = controller();
    render(<SettingsSurface controller={settings} />);
    expect(screen.getAllByText('FocusFlow')[0]).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'New folder' })).not.toBeInTheDocument();
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Change…' }));
    await user.click(screen.getByRole('button', { name: 'Create new workspace' }));
    expect(screen.getByRole('searchbox', { name: 'Find a folder' })).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Folder name' })).toHaveValue('FocusFlow');
    expect(screen.queryByRole('textbox', { name: 'Workspace folder' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Browse folders…' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(settings.requestRootMove).not.toHaveBeenCalled();
    expect(screen.getByText('FocusFlow')).toBeInTheDocument();
  });

  it('distinguishes switching an existing workspace from moving current files', async () => {
    const user = userEvent.setup();
    const settings = controller();
    render(<SettingsSurface controller={settings} />);
    await user.click(screen.getByRole('button', { name: 'Change…' }));
    await user.click(screen.getByRole('button', { name: 'Open existing workspace' }));
    await user.click(screen.getByRole('button', { name: 'Open folder Projects' }));
    await user.click(screen.getByRole('button', { name: 'Open folder Projects/Existing Flow' }));
    await user.click(screen.getByRole('button', { name: 'Review setup' }));
    await user.click(screen.getByRole('button', { name: 'Use this workspace' }));
    expect(settings.confirmRootSetup).toHaveBeenCalledWith('open', 'Projects/Existing Flow', expect.anything());
    expect(settings.requestRootMove).not.toHaveBeenCalled();
    expect(screen.getByText('Projects/Existing Flow')).toBeInTheDocument();
  });

  it('keeps the location unchanged if the move does not complete', async () => {
    const user = userEvent.setup();
    const settings = { ...controller(), requestRootMove: vi.fn(async () => { throw new Error('Move interrupted'); }) };
    render(<SettingsSurface controller={settings} />);
    await user.click(screen.getByRole('button', { name: 'Change…' }));
    await user.click(screen.getByRole('button', { name: 'Move current workspace' }));
    await user.click(screen.getByRole('button', { name: 'Open folder Projects' }));
    await user.clear(screen.getByRole('textbox', { name: 'Folder name' }));
    await user.type(screen.getByRole('textbox', { name: 'Folder name' }), 'My Flow');
    await user.click(screen.getByRole('button', { name: 'Move workspace' }));
    expect(screen.getByText('FocusFlow')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Folder name' })).toHaveValue('My Flow');
    expect(screen.queryByText('Storage updated')).not.toBeInTheDocument();
  });

  it('saves a WIP limit explicitly and folds the editor', async () => {
    const user = userEvent.setup();
    const settings = controller();
    render(<SettingsSurface controller={settings} />);
    await user.click(screen.getByRole('button', { name: 'Edit In progress limit' }));
    const limit = screen.getByRole('spinbutton', { name: 'In progress limit' });
    await user.clear(limit);
    await user.type(limit, '2');
    await user.click(screen.getByRole('button', { name: 'Enforce' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(settings.getSettings().wip.inProgress).toEqual({ mode: 'hard', limit: 2 });
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  });
});
