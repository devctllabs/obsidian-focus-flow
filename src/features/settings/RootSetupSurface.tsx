import type { RootSetupPreview, WorkspaceSetupIntent } from '../../application/root/root-workspace';
import { remapTemplates } from '../../application/root/root-workspace';
import type { FocusFlowSettings } from '../../settings';
import { useState } from 'react';
import { VaultPathPickerContent } from './VaultPathPicker';
import { formatErrorMessage } from '../ui/error-message';

type TemplateKind = keyof FocusFlowSettings['templates'];

export interface RootSetupController {
  settings: FocusFlowSettings;
  folders: readonly string[];
  files: readonly string[];
  preview(intent: WorkspaceSetupIntent, root: string, templates: FocusFlowSettings['templates']): Promise<RootSetupPreview>;
  confirm(intent: WorkspaceSetupIntent, root: string, templates: FocusFlowSettings['templates']): Promise<void>;
}

export function RootSetupSurface({ controller, intent, initialRoot, onDone, onBack }: { controller: RootSetupController; intent: WorkspaceSetupIntent; initialRoot?: string; onDone: () => void; onBack: () => void }) {
  const initialPath = initialRoot ?? controller.settings.rootFolder;
  const [folder, setFolder] = useState(parentOf(initialPath));
  const [name, setName] = useState(lastSegment(initialPath) || 'FocusFlow');
  const [overrides, setOverrides] = useState<Partial<FocusFlowSettings['templates']>>({});
  const [templatePicker, setTemplatePicker] = useState<TemplateKind | null>(null);
  const [preview, setPreview] = useState<RootSetupPreview | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const templates = { ...remapTemplates(controller.settings.templates, controller.settings.rootFolder, setupRoot(intent, folder, name)), ...overrides };
  const changeFolder = (path: string) => { setFolder(path); setOverrides({}); setError(null); };
  const changeName = (value: string) => { setName(value); setOverrides({}); setError(null); };
  const review = async (selectedFolder: string) => {
    const selectedRoot = setupRoot(intent, selectedFolder, name);
    const selectedTemplates = { ...remapTemplates(controller.settings.templates, controller.settings.rootFolder, selectedRoot), ...overrides };
    setPending(true); setError(null);
    try { setPreview(await controller.preview(intent, selectedRoot, selectedTemplates)); }
    catch (cause) { setError(formatErrorMessage(cause, 'Could not review this workspace. Check the folder and templates, then try again.')); }
    finally { setPending(false); }
  };
  const confirm = async () => {
    if (!preview) return;
    setPending(true); setError(null);
    try { await controller.confirm(intent, preview.root, templates); onDone(); }
    catch (cause) { setError(formatErrorMessage(cause, 'Could not set up this workspace. Review the folder and templates, then try again.')); }
    finally { setPending(false); }
  };
  return <div className="focus-flow focus-flow__setup-surface">
    {templatePicker
      ? <TemplatePicker kind={templatePicker} folders={controller.folders} files={controller.files} templates={templates} overrides={overrides} onBack={() => setTemplatePicker(null)} onChange={(next) => { setOverrides(next); setError(null); }} />
      : preview
        ? <SetupReview intent={intent} preview={preview} pending={pending} error={error} onBack={() => { setPreview(null); setError(null); }} onConfirm={confirm} />
        : <WorkspacePicker intent={intent} folder={folder} name={name} folders={controller.folders} files={controller.files} templates={templates} pending={pending} error={error} onFolderChange={changeFolder} onNameChange={changeName} onChooseTemplate={setTemplatePicker} onBack={onBack} onReview={review} />}
  </div>;
}

function WorkspacePicker({ intent, folder, name, folders, files, templates, pending, error, onFolderChange, onNameChange, onChooseTemplate, onBack, onReview }: { intent: WorkspaceSetupIntent; folder: string; name: string; folders: readonly string[]; files: readonly string[]; templates: FocusFlowSettings['templates']; pending: boolean; error: string | null; onFolderChange: (path: string) => void; onNameChange: (name: string) => void; onChooseTemplate: (kind: TemplateKind) => void; onBack: () => void; onReview: (folder: string) => Promise<void> }) {
  const create = intent === 'create';
  return <section className="focus-flow__workspace-step">
    <h3>{create ? 'Create new workspace' : 'Open existing workspace'}</h3>
    <p>{create ? 'Choose a parent folder and name for the independent Workspace.' : 'Choose an existing Focus Flow folder. Existing files stay in place.'}</p>
    <VaultPathPickerContent title="" folders={folders} initialFolder={folder} workspaceName={create ? name : undefined} onNameChange={create ? onNameChange : undefined} onFolderChange={onFolderChange} validateSelection={(path) => validateSetupTarget(intent, path, folders)} disabled={pending || create && invalidWorkspaceName(name)} error={error} action={pending ? 'Reviewing…' : 'Review setup'} secondaryAction={{ label: 'Back', onClick: onBack }} onClose={onBack} onChoose={(selectedFolder) => void onReview(selectedFolder)}>
      <TemplateChoices templates={templates} files={files} disabled={pending} onChoose={onChooseTemplate} />
    </VaultPathPickerContent>
  </section>;
}

function TemplateChoices({ templates, files, disabled, onChoose }: { templates: FocusFlowSettings['templates']; files: readonly string[]; disabled: boolean; onChoose: (kind: TemplateKind) => void }) {
  return <details className="focus-flow__setup-templates"><summary>Templates</summary><p className="focus-flow__field-hint">Existing templates at these paths are reused as they are. Choose another Markdown file to use a custom template.</p>
    {(Object.keys(templates) as TemplateKind[]).map((kind) => <button key={kind} className="focus-flow__template-row" type="button" aria-label={`Choose ${kind} template`} disabled={disabled} onClick={() => onChoose(kind)}><span>{kind[0]!.toUpperCase() + kind.slice(1)}</span><span title={templates[kind]}>{templates[kind]} · {files.includes(templates[kind]) ? 'Reuse' : 'Create'}</span></button>)}
  </details>;
}

function SetupReview({ intent, preview, pending, error, onBack, onConfirm }: { intent: WorkspaceSetupIntent; preview: RootSetupPreview; pending: boolean; error: string | null; onBack: () => void; onConfirm: () => Promise<void> }) {
  return <section className="focus-flow__setup" aria-label="Setup preview" aria-live="polite"><div><h3>{intent === 'open' ? 'Use existing workspace' : 'Create workspace'}</h3><code>{preview.root}</code></div><p>{preview.missingFolders.length} folders and {preview.missingTemplates.length} standard templates to create. Existing files will be kept.</p>{preview.warnings.map((warning) => <p key={warning}>{warning}</p>)}{preview.errors.length > 0 && <div role="alert">{preview.errors.map((problem) => <p key={problem}>{problem}</p>)}</div>}{error && <p role="alert">{error}</p>}<footer><button type="button" disabled={pending} onClick={onBack}>Back</button><button className="focus-flow__button-primary" disabled={pending || preview.errors.length > 0} type="button" onClick={() => void onConfirm()}>{pending ? 'Working…' : intent === 'open' ? 'Use this workspace' : 'Create workspace'}</button></footer></section>;
}

function TemplatePicker({ kind, folders, files, templates, overrides, onBack, onChange }: { kind: TemplateKind; folders: readonly string[]; files: readonly string[]; templates: FocusFlowSettings['templates']; overrides: Partial<FocusFlowSettings['templates']>; onBack: () => void; onChange: (overrides: Partial<FocusFlowSettings['templates']>) => void }) {
  const choose = (path: string) => { onChange({ ...overrides, [kind]: path }); onBack(); };
  return <section className="focus-flow__workspace-step"><h3>{`Choose ${kind} template`}</h3><VaultPathPickerContent title="" folders={folders} files={files} initialFolder={parentOf(templates[kind])} action="Use template" secondaryAction={{ label: 'Back', onClick: onBack }} onClose={onBack} onChoose={choose} /></section>;
}

function setupRoot(intent: WorkspaceSetupIntent, folder: string, name: string): string {
  return intent === 'create' ? [folder, name.trim()].filter(Boolean).join('/') : folder;
}

function validateSetupTarget(intent: WorkspaceSetupIntent, path: string, folders: readonly string[]): string | null {
  if (!path) return intent === 'create' ? 'Enter a folder name.' : 'Choose an existing Workspace folder.';
  if (intent === 'create') return folders.includes(path) ? 'That folder name is already in use here. Choose a different name.' : null;
  return folders.includes(path) ? null : 'Choose an existing Workspace folder.';
}

function invalidWorkspaceName(name: string): boolean { return !name.trim() || /[/\\]/.test(name) || ['.', '..'].includes(name.trim()); }
function parentOf(path: string): string { return path.split('/').slice(0, -1).join('/'); }
function lastSegment(path: string): string { return path.split('/').at(-1) ?? ''; }
