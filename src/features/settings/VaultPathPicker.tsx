import { useRef, useState, type ReactNode, type RefObject } from 'react';
import { DialogSurface } from '../ui/DialogSurface';
import { AttentionIcon, ChevronIcon } from '../ui/Icons';

export interface VaultPathPickerProps {
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
  onFolderChange?: (path: string) => void;
  action: string;
  workspaceName?: string;
  onNameChange?: (name: string) => void;
  disabled?: boolean;
  error?: string | null;
  children?: ReactNode;
}

export function VaultPathPicker(props: VaultPathPickerProps) {
  const { title, description, onClose } = props;
  const searchRef = useRef<HTMLInputElement>(null);
  return <DialogSurface title={title} description={description} initialFocusRef={searchRef} onClose={onClose}>
    <VaultPathPickerContent {...props} searchRef={searchRef} />
  </DialogSurface>;
}

export function VaultPathPickerContent(props: VaultPathPickerProps & { searchRef?: RefObject<HTMLInputElement | null> }) {
  const { confirmation, secondaryAction, validateSelection, folders, files, initialFolder, onChoose, onFolderChange, action, workspaceName, onNameChange, disabled = false, error, children, searchRef: providedSearchRef } = props;
  const [folder, setFolder] = useState(initialFolder);
  const [query, setQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState('');
  const localSearchRef = useRef<HTMLInputElement>(null);
  const searchRef = providedSearchRef ?? localSearchRef;
  const search = query.trim().toLocaleLowerCase();
  const directories = visiblePaths([...folderSet(folders, files)], search, folder);
  const documents = visiblePaths(files ?? [], search, folder);
  const location = (path: string) => { setFolder(path); setQuery(''); setSelectedFile(''); onFolderChange?.(path); };
  const segments = folder.split('/').filter(Boolean);
  const destination = workspaceName !== undefined ? [folder, workspaceName.trim()].filter(Boolean).join('/') : folder;
  const selectionError = validateSelection?.(destination);
  return <div className="focus-flow__vault-picker">
      <input ref={searchRef} type="search" aria-label={files ? 'Find a file' : 'Find a folder'} placeholder={files ? 'Search files in vault…' : 'Search folders in vault…'} value={query} onChange={(event) => setQuery(event.currentTarget.value)} />
      <VaultBreadcrumbs segments={segments} onSelect={location} />
      <VaultEntries directories={directories} documents={documents} search={search} hasFiles={files !== undefined} selectedFile={selectedFile} onOpenFolder={location} onSelectFile={setSelectedFile} />
      <WorkspaceNameField value={workspaceName} onChange={onNameChange} />
      <SelectionNotice message={selectionError} />
      {children}
      <PickerMessage error={error} confirmation={confirmation} />
      <PickerFooter files={files} folder={folder} selectedFile={selectedFile} workspaceName={workspaceName} action={action} secondaryAction={secondaryAction} disabled={disabled} selectionError={selectionError} onChoose={onChoose} />
  </div>;
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

function PickerFooter({ files, folder, selectedFile, workspaceName, action, secondaryAction, disabled, selectionError, onChoose }: { files?: readonly string[]; folder: string; selectedFile: string; workspaceName?: string; action: string; secondaryAction?: { label: string; onClick: () => void }; disabled: boolean; selectionError?: string | null; onChoose: (path: string) => void }) {
  const choosingFile = files !== undefined;
  const target = choosingFile ? selectedFile : folder;
  const label = pickerDestination(choosingFile, selectedFile, folder, workspaceName);
  return <footer><p>{workspaceName !== undefined && <span className="focus-flow__destination-label">Destination</span>}{label}</p><div className="focus-flow__picker-actions">{secondaryAction && <button className="focus-flow__picker-back" type="button" onClick={secondaryAction.onClick}><ChevronIcon direction="left" />{secondaryAction.label}</button>}<button className="focus-flow__button-primary" disabled={disabled || Boolean(selectionError) || (choosingFile && selectedFile === '')} type="button" onClick={() => onChoose(target)}>{action}</button></div></footer>;
}

function pickerDestination(choosingFile: boolean, selectedFile: string, folder: string, workspaceName?: string): string {
  if (choosingFile) return selectedFile || 'Select a file';
  if (workspaceName !== undefined) return ['Vault', folder, workspaceName.trim()].filter(Boolean).join(' / ');
  return folder || 'Vault root';
}

function SelectionNotice({ message }: { message?: string | null }) { return message ? <p className="focus-flow__picker-warning" role="status"><AttentionIcon />{message}</p> : null; }
