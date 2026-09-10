import { useState } from 'react';
import { flushSync } from 'react-dom';
import type { FocusFlowSettings } from '../../settings';
import type { SettingsController } from './SettingsSurface';
import { VaultPathPicker } from './VaultPathPicker';
import { DialogSurface } from '../ui/DialogSurface';
import { formatErrorMessage } from '../ui/error-message';

type RootOperation = 'move' | 'existing' | 'resume';
type RootPickerKind = 'move' | 'existing';

export function RootFolderSetting({ settings, controller, onUpdated }: {
  settings: FocusFlowSettings;
  controller: SettingsController;
  onUpdated: () => void;
}) {
  const [picker, setPicker] = useState<RootPickerKind | null>(null);
  const [location, setLocation] = useState(settings.rootFolder.split('/').slice(0, -1).join('/'));
  const [workspaceName, setWorkspaceName] = useState(settings.rootFolder.split('/').at(-1) ?? 'Focus Flow');
  const [switchTarget, setSwitchTarget] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasPendingMove = controller.hasPendingRootMove();
  const apply = async (path: string, operation: RootOperation) => {
    setPending(true); setError(null);
    if (closesPickerBeforeNativeFlow(operation, settings.setupCompleted)) flushSync(() => setPicker(null));
    try {
      await performRootOperation(controller, settings, path, operation);
      onUpdated();
      settleRootPicker({ operation, setupCompleted: settings.setupCompleted, requestedPath: path, currentPath: controller.getSettings().rootFolder, setPicker, setSwitchTarget });
    } catch (cause) {
      setError(formatErrorMessage(cause, 'Could not update the workspace folder.'));
      if (operation === 'move') setPicker('move');
    } finally { setPending(false); }
  };
  const chooseFolder = (folder: string) => {
    setLocation(folder);
    if (picker === 'existing') { setPicker(null); setSwitchTarget(folder); }
    else void apply([folder, workspaceName.trim()].filter(Boolean).join('/'), 'move');
  };
  return <section className="focus-flow__storage-setting">
    <RootFolderHeader settings={settings} pending={pending} hasPendingMove={hasPendingMove} onChange={() => { setError(null); if (settings.setupCompleted) setPicker('move'); else void apply(settings.rootFolder, 'move'); }} />
    <PendingMoveNotice visible={hasPendingMove} pending={pending} onResume={() => void apply('', 'resume')} />
    <RootPicker picker={picker} settings={settings} controller={controller} location={location} workspaceName={workspaceName} pending={pending} error={error} onClose={() => { if (!pending) setPicker(null); }} onOpenExisting={() => { setPicker('existing'); setError(null); }} onNameChange={setWorkspaceName} onChoose={chooseFolder} />
    <SwitchWorkspaceDialog target={switchTarget} pending={pending} error={error} onClose={() => { if (!pending) setSwitchTarget(null); }} onConfirm={() => { if (switchTarget !== null) void apply(switchTarget, 'existing'); }} />
    <RootFolderError error={error} visible={!picker && switchTarget === null} />
  </section>;
}

function closesPickerBeforeNativeFlow(operation: RootOperation, setupCompleted: boolean): boolean { return operation === 'resume' || operation === 'move' && !setupCompleted; }

async function performRootOperation(controller: SettingsController, settings: FocusFlowSettings, path: string, operation: RootOperation): Promise<void> {
  if (operation === 'resume') return controller.requestResumeRootMove();
  if (operation === 'existing') return controller.selectExistingRoot(path);
  if (!settings.setupCompleted) return controller.requestRootSetup(path);
  return controller.requestRootMove(path, true);
}

function settleRootPicker({ operation, setupCompleted, requestedPath, currentPath, setPicker, setSwitchTarget }: { operation: RootOperation; setupCompleted: boolean; requestedPath: string; currentPath: string; setPicker: (picker: RootPickerKind | null) => void; setSwitchTarget: (target: string | null) => void }): void {
  if (operation === 'existing') { setSwitchTarget(null); return; }
  // Native confirmation cancellation is not success. Keep the picker available.
  if (operation === 'move' && setupCompleted && currentPath !== requestedPath) setPicker('move');
  else setPicker(null);
}

function RootFolderHeader({ settings, pending, hasPendingMove, onChange }: { settings: FocusFlowSettings; pending: boolean; hasPendingMove: boolean; onChange: () => void }) {
  return <div className="focus-flow__setting-row"><div><h2>Workspace folder</h2><code title={settings.rootFolder}>{settings.rootFolder}</code></div><div className="focus-flow__storage-actions">{!hasPendingMove && <button className="focus-flow__button-quiet" disabled={pending} onClick={onChange} type="button">{settings.setupCompleted ? 'Change…' : 'Set up'}</button>}</div></div>;
}

function PendingMoveNotice({ visible, pending, onResume }: { visible: boolean; pending: boolean; onResume: () => void }) {
  if (!visible) return null;
  return <div className="focus-flow__storage-notice"><p>A folder move was interrupted.</p><button disabled={pending} onClick={onResume} type="button">Resume move</button></div>;
}

function RootPicker({ picker, settings, controller, location, workspaceName, pending, error, onClose, onOpenExisting, onNameChange, onChoose }: { picker: RootPickerKind | null; settings: FocusFlowSettings; controller: SettingsController; location: string; workspaceName: string; pending: boolean; error: string | null; onClose: () => void; onOpenExisting: () => void; onNameChange: (name: string) => void; onChoose: (folder: string) => void }) {
  if (!picker) return null;
  const model = rootPickerModel(picker, settings);
  const moveMode = picker === 'move';
  const folders = rootFolders(controller);
  return <VaultPathPicker error={error} key={picker} title={model.title} description={model.description} secondaryAction={moveMode ? { label: 'Open an existing workspace instead…', onClick: onOpenExisting } : undefined} confirmation={model.confirmation} validateSelection={moveMode && settings.setupCompleted ? (path) => validateRootDestination(path, settings.rootFolder, folders) : undefined} folders={folders} initialFolder={location} workspaceName={moveMode ? workspaceName : undefined} onNameChange={moveMode ? onNameChange : undefined} disabled={pending || moveMode && invalidWorkspaceName(workspaceName)} action={model.action} onClose={onClose} onChoose={onChoose} />;
}

function rootFolders(controller: SettingsController): readonly string[] { return controller.listFolders?.() ?? []; }

function rootPickerModel(picker: RootPickerKind, settings: FocusFlowSettings) {
  if (picker === 'existing') return { title: 'Open existing workspace', description: 'Choose a Focus Flow folder to open. No notes will be moved.', action: 'Use this folder', confirmation: undefined };
  if (settings.setupCompleted) return { title: 'Move workspace folder', description: 'Choose the parent folder below. Your workspace folder and notes will move inside it.', action: 'Move folder', confirmation: `Moves all notes from ${settings.rootFolder}. Existing folders are never overwritten.` };
  return { title: 'Create workspace folder', description: 'Choose the parent folder below. Your workspace folder will be created inside it.', action: 'Review setup', confirmation: undefined };
}

function validateRootDestination(path: string, root: string, folders: readonly string[]): string | null {
  if (path === root) return 'Choose a different destination.';
  if (path.startsWith(`${root}/`)) return 'Choose a folder outside the current workspace.';
  return folders.includes(path) ? 'A folder already exists here. Choose another name.' : null;
}

function invalidWorkspaceName(name: string): boolean { return !name.trim() || /[/\\]/.test(name) || ['.', '..'].includes(name.trim()); }

function SwitchWorkspaceDialog({ target, pending, error, onClose, onConfirm }: { target: string | null; pending: boolean; error: string | null; onClose: () => void; onConfirm: () => void }) {
  if (target === null) return null;
  return <DialogSurface title="Switch workspace?" description="Your current notes stay where they are." onClose={onClose}><p><code>{target || 'Vault root'}</code></p>{error && <p role="alert">{error}</p>}<button className="focus-flow__button-primary" disabled={pending || !target} type="button" onClick={onConfirm}>Use this workspace</button></DialogSurface>;
}

function RootFolderError({ error, visible }: { error: string | null; visible: boolean }) { return error && visible ? <p className="focus-flow__form-error" role="alert">{error}</p> : null; }
