import type { RootSetupPreview } from '../../application/root/root-workspace';
import { remapTemplates } from '../../application/root/root-workspace';
import type { FocusFlowSettings } from '../../settings';
import { useState } from 'react';
import { VaultPathPicker } from './VaultPathPicker';
import { formatErrorMessage } from '../ui/error-message';

export interface RootSetupController {
  settings: FocusFlowSettings;
  folders: readonly string[];
  files: readonly string[];
  preview(root: string, templates: FocusFlowSettings['templates']): Promise<RootSetupPreview>;
  confirm(root: string, templates: FocusFlowSettings['templates']): Promise<void>;
}

export function RootSetupSurface({ controller, onDone, onCancel }: { controller: RootSetupController; onDone: () => void; onCancel: () => void }) {
  const [root, setRoot] = useState(controller.settings.rootFolder);
  const [overrides, setOverrides] = useState<Partial<FocusFlowSettings['templates']>>({});
  const [picker, setPicker] = useState<'folder' | keyof FocusFlowSettings['templates'] | null>(null);
  const [preview, setPreview] = useState<RootSetupPreview | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cleanRoot = root.trim().replace(/\\/g, '/').replace(/\/{2,}/g, '/');
  const templates = { ...remapTemplates(controller.settings.templates, controller.settings.rootFolder, cleanRoot), ...overrides };
  const changeRoot = (value: string) => { setRoot(value); setOverrides({}); setPreview(null); setError(null); };
  const apply = async () => {
    if (pending) return;
    setPending(true); setError(null);
    try {
      if (!preview) setPreview(await controller.preview(cleanRoot, templates));
      else { await controller.confirm(preview.root, templates); onDone(); }
    } catch (cause) { setError(formatErrorMessage(cause, 'Could not set up this workspace. Review the folder and templates, then try again.')); }
    finally { setPending(false); }
  };
  const existing = controller.folders.includes(cleanRoot);
  return <div className="focus-flow focus-flow__setup-surface">
    <SetupForm root={root} templates={templates} files={controller.files} preview={preview} pending={pending} error={error} existing={existing} cleanRoot={cleanRoot} onRootChange={changeRoot} onOpenPicker={setPicker} onClearPreview={() => setPreview(null)} onCancel={onCancel} onSubmit={apply} />
    <SetupPathPicker picker={picker} folders={controller.folders} files={controller.files} cleanRoot={cleanRoot} templates={templates} overrides={overrides} onClose={() => setPicker(null)} onChangeRoot={changeRoot} onChangeOverrides={setOverrides} onClearPreview={() => setPreview(null)} onClearError={() => setError(null)} />
  </div>;
}

function SetupForm({ root, templates, files, preview, pending, error, existing, cleanRoot, onRootChange, onOpenPicker, onClearPreview, onCancel, onSubmit }: { root: string; templates: FocusFlowSettings['templates']; files: readonly string[]; preview: RootSetupPreview | null; pending: boolean; error: string | null; existing: boolean; cleanRoot: string; onRootChange: (root: string) => void; onOpenPicker: (picker: 'folder' | keyof FocusFlowSettings['templates']) => void; onClearPreview: () => void; onCancel: () => void; onSubmit: () => Promise<void> }) {
  return <form className="focus-flow__setup" onSubmit={(event) => { event.preventDefault(); void onSubmit(); }}>
    <p>Choose where your work lives. Use an existing Focus Flow folder or create a new one.</p>
    <label>Workspace folder<input aria-label="Workspace folder" value={root} disabled={pending} onChange={(event) => onRootChange(event.currentTarget.value)} required /></label>
    <button type="button" className="focus-flow__button-quiet" disabled={pending} onClick={() => onOpenPicker('folder')}>Browse folders…</button>
    <p className="focus-flow__field-hint">{existing ? 'Existing files will be kept. Only missing folders and standard templates will be added.' : 'A folder will be created inside your vault. You can also enter a nested path.'}</p>
    <details><summary>Templates</summary><p className="focus-flow__field-hint">Existing templates at these paths are reused as they are. Choose another Markdown file to use a custom template.</p>
      {(Object.keys(templates) as Array<keyof typeof templates>).map((kind) => <button key={kind} className="focus-flow__template-row" type="button" aria-label={`Choose ${kind} template`} disabled={pending} onClick={() => onOpenPicker(kind)}><span>{kind[0]!.toUpperCase() + kind.slice(1)}</span><span title={templates[kind]}>{templates[kind]} · {files.includes(templates[kind]) ? 'Reuse' : 'Create'}</span></button>)}
    </details>
    <SetupPreview preview={preview} existing={existing} pending={pending} onEdit={onClearPreview} />
    {error && <p role="alert">{error}</p>}
    <footer><button type="button" disabled={pending} onClick={onCancel}>Cancel</button><button className="focus-flow__button-primary" disabled={pending || !cleanRoot || Boolean(preview?.errors.length)} type="submit">{setupAction(pending, preview, existing)}</button></footer>
  </form>;
}

function SetupPreview({ preview, existing, pending, onEdit }: { preview: RootSetupPreview | null; existing: boolean; pending: boolean; onEdit: () => void }) {
  if (!preview) return null;
  return <section aria-label="Setup preview" aria-live="polite"><h3>{existing ? 'Use existing workspace' : 'Create workspace'}</h3><p>{preview.missingFolders.length} folders and {preview.missingTemplates.length} standard templates to create. Existing files will be kept.</p>{preview.warnings.map((warning) => <p key={warning}>{warning}</p>)}{preview.errors.length > 0 && <div role="alert">{preview.errors.map((problem) => <p key={problem}>{problem}</p>)}</div>}<button type="button" className="focus-flow__button-quiet" disabled={pending} onClick={onEdit}>Edit setup</button></section>;
}

function setupAction(pending: boolean, preview: RootSetupPreview | null, existing: boolean): string {
  if (pending) return 'Working…';
  if (!preview) return 'Review setup';
  return existing ? 'Use this workspace' : 'Create workspace';
}

function SetupPathPicker({ picker, folders, files, cleanRoot, templates, overrides, onClose, onChangeRoot, onChangeOverrides, onClearPreview, onClearError }: { picker: 'folder' | keyof FocusFlowSettings['templates'] | null; folders: readonly string[]; files: readonly string[]; cleanRoot: string; templates: FocusFlowSettings['templates']; overrides: Partial<FocusFlowSettings['templates']>; onClose: () => void; onChangeRoot: (root: string) => void; onChangeOverrides: (overrides: Partial<FocusFlowSettings['templates']>) => void; onClearPreview: () => void; onClearError: () => void }) {
  if (!picker) return null;
  const folderMode = picker === 'folder';
  const choose = (path: string) => {
    if (folderMode) onChangeRoot(path);
    else { onChangeOverrides({ ...overrides, [picker]: path }); onClearPreview(); onClearError(); }
    onClose();
  };
  return <VaultPathPicker title={folderMode ? 'Choose workspace folder' : `Choose ${picker} template`} folders={folders} files={folderMode ? undefined : files} initialFolder={folderMode ? cleanRoot : templates[picker].split('/').slice(0, -1).join('/')} action={folderMode ? 'Use this folder' : 'Use template'} onClose={onClose} onChoose={choose} />;
}
