import { useState } from 'react';
import type { WorkspaceSetupIntent } from '../../application/root/root-workspace';
import type { FocusFlowSettings } from '../../settings';
import type { SettingsController } from './SettingsSurface';
import { DialogSurface } from '../ui/DialogSurface';
import { formatErrorMessage } from '../ui/error-message';
import { WorkspaceChangeSurface } from './WorkspaceChangeSurface';

export function RootFolderSetting({ settings, controller, onUpdated }: {
  settings: FocusFlowSettings;
  controller: SettingsController;
  onUpdated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const hasPendingMove = controller.hasPendingRootMove();
  const dialog = workspaceDialogCopy(settings.setupCompleted);
  const finish = () => { onUpdated(); setOpen(false); };
  const setupController = {
    settings,
    folders: controller.listFolders?.() ?? [],
    files: controller.listTemplateFiles?.() ?? [],
    preview: (intent: WorkspaceSetupIntent, root: string, templates: FocusFlowSettings['templates']) => controller.previewRootSetup(intent, root, templates),
    confirm: (intent: WorkspaceSetupIntent, root: string, templates: FocusFlowSettings['templates']) => controller.confirmRootSetup(intent, root, templates),
    move: (root: string) => controller.requestRootMove(root, true),
  };
  return <section className="focus-flow__storage-setting">
    <div className="focus-flow__setting-row"><div><h2>Workspace folder</h2><code title={settings.rootFolder}>{settings.rootFolder}</code></div><div className="focus-flow__storage-actions">{!hasPendingMove && <button className="focus-flow__button-quiet" onClick={() => setOpen(true)} type="button">{dialog.action}</button>}</div></div>
    {hasPendingMove && <PendingRootMoveNotice controller={controller} onUpdated={onUpdated} />}
    {open && <DialogSurface title={dialog.title} description={dialog.description} onClose={() => setOpen(false)}><WorkspaceChangeSurface controller={setupController} allowMove={settings.setupCompleted} onDone={finish} /></DialogSurface>}
  </section>;
}

function workspaceDialogCopy(setupCompleted: boolean) {
  if (setupCompleted) return { action: 'Change…', title: 'Change workspace', description: 'Choose what you want to do with the Active Workspace.' };
  return { action: 'Set up', title: 'Set up Focus Flow', description: 'Create a Workspace or open one already in this vault.' };
}

function PendingRootMoveNotice({ controller, onUpdated }: { controller: SettingsController; onUpdated: () => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resume = async () => {
    setPending(true); setError(null);
    try { await controller.requestResumeRootMove(); onUpdated(); }
    catch (cause) { setError(formatErrorMessage(cause, 'Could not resume the Workspace move.')); }
    finally { setPending(false); }
  };
  return <><div className="focus-flow__storage-notice"><p>A folder move was interrupted.</p><button disabled={pending} onClick={() => void resume()} type="button">Resume move</button></div>{error && <p className="focus-flow__form-error" role="alert">{error}</p>}</>;
}
