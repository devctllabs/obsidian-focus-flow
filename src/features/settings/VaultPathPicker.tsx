import { useRef, useState } from 'react';
import { DialogSurface } from '../ui/DialogSurface';
import { ChevronIcon } from '../ui/Icons';

interface VaultPathPickerProps {
  title: string;
  description?: string;
  confirmation?: string;
  validateSelection?: (path: string) => string | null;
  secondaryAction?: { label: string; onClick: () => void };
  folders: readonly string[];
  files?: readonly string[];
  initialFolder: string;
  onClose: () => void;
  onChoose: (path: string) => void;
  action: string;
  workspaceName?: string;
  onNameChange?: (name: string) => void;
  disabled?: boolean;
  error?: string | null;
}

export function VaultPathPicker(props: VaultPathPickerProps) {
  const { title, description, confirmation, secondaryAction, validateSelection, folders, files, initialFolder, onClose, onChoose, action, workspaceName, onNameChange, disabled = false, error } = props;
  const [folder, setFolder] = useState(initialFolder);
  const [query, setQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const search = query.trim().toLocaleLowerCase();
  const directories = visiblePaths([...folderSet(folders, files)], search, folder);
  const documents = visiblePaths(files ?? [], search, folder);
  const location = (path: string) => { setFolder(path); setQuery(''); setSelectedFile(''); };
  const segments = folder.split('/').filter(Boolean);
  const destination = workspaceName !== undefined ? [folder, workspaceName.trim()].filter(Boolean).join('/') : folder;
  const selectionError = validateSelection?.(destination);
  return <DialogSurface title={title} description={description} initialFocusRef={searchRef} onClose={onClose}>
    <div className="focus-flow__vault-picker">
      <input ref={searchRef} type="search" aria-label={files ? 'Find a file' : 'Find a folder'} placeholder={files ? 'Search files in vault…' : 'Search folders in vault…'} value={query} onChange={(event) => setQuery(event.currentTarget.value)} />
      <VaultBreadcrumbs segments={segments} onSelect={location} />
      <VaultEntries directories={directories} documents={documents} search={search} hasFiles={files !== undefined} selectedFile={selectedFile} onOpenFolder={location} onSelectFile={setSelectedFile} />
      <WorkspaceNameField value={workspaceName} onChange={onNameChange} />
      <PickerMessage error={error} confirmation={confirmation} />
      <PickerFooter files={files} folder={folder} selectedFile={selectedFile} workspaceName={workspaceName} action={action} disabled={disabled} selectionError={selectionError} onChoose={onChoose} />
      <SelectionError error={selectionError} />
      <SecondaryPickerAction action={secondaryAction} />
    </div>
  </DialogSurface>;
}

function folderSet(folders: readonly string[], files: readonly string[] | undefined): Set<string> {
  const result = new Set(folders.map((path) => path.replace(/^\/+|\/+$/g, '')).filter(Boolean));
  for (const path of [...result, ...(files ?? [])]) {
    const parts = path.split('/');
    for (let index = 1; index < parts.length; index++) result.add(parts.slice(0, index).join('/'));
  }
  return result;
}

function visiblePaths(paths: readonly string[], search: string, folder: string): string[] {
  return paths.filter((path) => search ? path.toLocaleLowerCase().includes(search) : parentOf(path) === folder).sort();
}

function parentOf(path: string): string { return path.split('/').slice(0, -1).join('/'); }

function VaultBreadcrumbs({ segments, onSelect }: { segments: readonly string[]; onSelect: (path: string) => void }) {
  return <nav aria-label="Vault location" className="focus-flow__vault-breadcrumbs"><button type="button" onClick={() => onSelect('')}>Vault</button>{segments.map((segment, index) => <button key={index} type="button" onClick={() => onSelect(segments.slice(0, index + 1).join('/'))}><ChevronIcon direction="right" />{segment}</button>)}</nav>;
}

function VaultEntries({ directories, documents, search, hasFiles, selectedFile, onOpenFolder, onSelectFile }: { directories: readonly string[]; documents: readonly string[]; search: string; hasFiles: boolean; selectedFile: string; onOpenFolder: (path: string) => void; onSelectFile: (path: string) => void }) {
  return <div className="focus-flow__vault-files">
    {directories.slice(0, 50).map((path) => <button key={path} type="button" aria-label={`Open folder ${path}`} onClick={() => onOpenFolder(path)}><span className="focus-flow__folder-symbol" aria-hidden="true" /><span>{pathLabel(path, search)}</span><ChevronIcon direction="right" /></button>)}
    {documents.slice(0, 50).map((path) => <button key={path} type="button" aria-label={`Select file ${path}`} aria-pressed={selectedFile === path} onClick={() => onSelectFile(path)}><span className="focus-flow__file-symbol" aria-hidden="true" /><span>{pathLabel(path, search)}</span></button>)}
    <EmptyVaultEntries count={directories.length + documents.length} searching={Boolean(search)} hasFiles={hasFiles} />
    {(directories.length > 50 || documents.length > 50) && <p>Refine your search to see more results.</p>}
  </div>;
}

function pathLabel(path: string, search: string): string | undefined { return search ? path : path.split('/').at(-1); }
function EmptyVaultEntries({ count, searching, hasFiles }: { count: number; searching: boolean; hasFiles: boolean }) {
  if (count > 0) return null;
  if (searching) return <p>Nothing found. Try a different name.</p>;
  return <p>{hasFiles ? 'No templates in this folder.' : 'No subfolders. You can choose this location.'}</p>;
}

function WorkspaceNameField({ value, onChange }: { value?: string; onChange?: (name: string) => void }) {
  if (!onChange) return null;
  return <label className="focus-flow__workspace-name">Folder name<input aria-label="Folder name" value={value} onChange={(event) => onChange(event.currentTarget.value)} /></label>;
}

function PickerMessage({ error, confirmation }: { error?: string | null; confirmation?: string }) {
  return <>{error && <p role="alert">{error}</p>}{confirmation && <p className="focus-flow__picker-confirmation">{confirmation}</p>}</>;
}

function PickerFooter({ files, folder, selectedFile, workspaceName, action, disabled, selectionError, onChoose }: { files?: readonly string[]; folder: string; selectedFile: string; workspaceName?: string; action: string; disabled: boolean; selectionError?: string | null; onChoose: (path: string) => void }) {
  const choosingFile = files !== undefined;
  const target = choosingFile ? selectedFile : folder;
  const label = pickerDestination(choosingFile, selectedFile, folder, workspaceName);
  return <footer><p>{workspaceName !== undefined && <span className="focus-flow__destination-label">Destination</span>}{label}</p><button className="focus-flow__button-primary" disabled={disabled || Boolean(selectionError) || (choosingFile && selectedFile === '')} type="button" onClick={() => onChoose(target)}>{action}</button></footer>;
}

function pickerDestination(choosingFile: boolean, selectedFile: string, folder: string, workspaceName?: string): string {
  if (choosingFile) return selectedFile || 'Select a file';
  if (workspaceName !== undefined) return ['Vault', folder, workspaceName.trim()].filter(Boolean).join(' / ');
  return folder || 'Vault root';
}

function SelectionError({ error }: { error?: string | null }) { return error ? <p className="focus-flow__picker-confirmation" role="status">{error}</p> : null; }
function SecondaryPickerAction({ action }: { action?: { label: string; onClick: () => void } }) { return action ? <button className="focus-flow__picker-alternative focus-flow__button-quiet" type="button" onClick={action.onClick}>{action.label}</button> : null; }
