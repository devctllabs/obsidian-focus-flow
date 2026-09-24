import { useState, type ReactNode } from 'react';
import type { RootSetupController } from './RootSetupSurface';
import { RootSetupSurface } from './RootSetupSurface';
import { VaultPathPickerContent } from './VaultPathPicker';
import { formatErrorMessage } from '../ui/error-message';
import { ChevronIcon, FolderOpenIcon, FolderPlusIcon, MoveIcon } from '../ui/Icons';

type WorkspaceOperation = 'create' | 'open' | 'move';

export interface WorkspaceChangeController extends RootSetupController {
  move?: (root: string) => Promise<void>;
}

export function WorkspaceChangeSurface({ controller, allowMove, onDone }: { controller: WorkspaceChangeController; allowMove: boolean; onDone: () => void }) {
  const [operation, setOperation] = useState<WorkspaceOperation | null>(null);
  const move = controller.move;
  let content;
  if (operation === 'create' || operation === 'open') {
    content = <RootSetupSurface key={operation} controller={controller} intent={operation} initialRoot={operation === 'create' ? 'FocusFlow' : controller.settings.rootFolder} onDone={onDone} onBack={() => setOperation(null)} />;
  } else if (operation === 'move' && move) {
    content = <MoveWorkspaceSurface controller={controller} move={move} onBack={() => setOperation(null)} onDone={onDone} />;
  } else {
    content = <WorkspaceActions allowMove={allowMove && move !== undefined} onChoose={(choice) => setOperation(choice)} />;
  }
  return <div className="focus-flow focus-flow__workspace-change">{content}</div>;
}

function WorkspaceActions({ allowMove, onChoose }: { allowMove: boolean; onChoose: (operation: WorkspaceOperation) => void }) {
  return <div className="focus-flow__workspace-actions">
    <div className="focus-flow__workspace-action-group">
      <WorkspaceAction icon={<FolderPlusIcon />} label="Create new workspace" description="Create an empty, independent Workspace at a new path." onClick={() => onChoose('create')} />
      <WorkspaceAction icon={<FolderOpenIcon />} label="Open existing workspace" description="Select a Focus Flow folder and complete any missing standard structure." onClick={() => onChoose('open')} />
    </div>
    {allowMove && <div className="focus-flow__workspace-action-group focus-flow__workspace-action-group--current"><p>Current workspace</p><WorkspaceAction icon={<MoveIcon />} label="Move current workspace" description="Relocate the Active Workspace and all files. Its old path will disappear." onClick={() => onChoose('move')} /></div>}
  </div>;
}

function WorkspaceAction({ icon, label, description, onClick }: { icon: ReactNode; label: string; description: string; onClick: () => void }) {
  return <button aria-label={label} className="focus-flow__workspace-action" type="button" onClick={onClick}><span className="focus-flow__workspace-action-icon">{icon}</span><span className="focus-flow__workspace-action-copy"><strong>{label}</strong><span>{description}</span></span><ChevronIcon className="focus-flow__workspace-action-chevron" direction="right" /></button>;
}

function MoveWorkspaceSurface({ controller, move: moveWorkspace, onBack, onDone }: { controller: WorkspaceChangeController; move: (root: string) => Promise<void>; onBack: () => void; onDone: () => void }) {
  const settings = controller.settings;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(settings.rootFolder.split('/').at(-1) ?? 'FocusFlow');
  const parent = settings.rootFolder.split('/').slice(0, -1).join('/');
  const folders = controller.folders;
  const move = async (root: string) => {
    setPending(true); setError(null);
    try { await moveWorkspace(root); onDone(); }
    catch (cause) { setError(formatErrorMessage(cause, 'Could not move the Active Workspace.')); }
    finally { setPending(false); }
  };
  return <section className="focus-flow__workspace-step"><h3>Move current workspace</h3><p>Choose a new parent folder or name for the same Workspace.</p><VaultPathPickerContent title="" confirmation={`Moves the Active Workspace from ${settings.rootFolder}. Its old path will disappear.`} validateSelection={(path) => validateMoveDestination(path, settings.rootFolder, folders)} folders={folders} initialFolder={parent} workspaceName={name} onNameChange={setName} disabled={pending || invalidWorkspaceName(name)} error={error} action={pending ? 'Moving…' : 'Move workspace'} secondaryAction={{ label: 'Back', onClick: onBack }} onClose={onBack} onChoose={(root) => void move([root, name.trim()].filter(Boolean).join('/'))} /></section>;
}

function validateMoveDestination(path: string, root: string, folders: readonly string[]): string | null {
  if (path === root) return 'Choose a different destination.';
  if (path.startsWith(`${root}/`)) return 'Choose a folder outside the current Workspace.';
  return folders.includes(path) ? 'That folder name is already in use here. Choose a different name.' : null;
}

function invalidWorkspaceName(name: string): boolean {
  return !name.trim() || /[/\\]/.test(name) || ['.', '..'].includes(name.trim());
}
