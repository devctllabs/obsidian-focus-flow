import { useState } from 'react';
import type { ArchivePreview, WorkspaceLifecycle } from '../../application/workspace/workspace-lifecycle';
import { DialogSurface } from '../ui/DialogSurface';
import { formatErrorMessage } from '../ui/error-message';

export function ArchiveSettings({ lifecycle }: { lifecycle: Pick<WorkspaceLifecycle, 'previewArchive' | 'organize'> }) {
  const [preview, setPreview] = useState<ArchivePreview | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const inspect = async () => {
    setPending(true); setError(null); setDone(false);
    try { setPreview(await lifecycle.previewArchive()); }
    catch (error) { setError(formatErrorMessage(error, 'Could not inspect terminal notes. Refresh and retry.')); }
    finally { setPending(false); }
  };
  const organize = async () => {
    if (!preview) return;
    setPending(true); setError(null);
    try { await lifecycle.organize(preview); setPreview(null); setDone(true); }
    catch (error) { setError(formatErrorMessage(error, 'The operation stopped safely. Reopen the preview to resume it.')); }
    finally { setPending(false); }
  };
  const closePreview = () => { if (!pending) { setPreview(null); setError(null); } };
  return <section className="focus-flow__archive-settings"><div className="focus-flow__setting-row"><div><h2>Terminal notes</h2><p>Done and Closed work stays in its typed folder, organized by month. History and links stay connected.</p></div>
    <button aria-label="Review terminal notes" className="focus-flow__button-quiet" type="button" disabled={pending} onClick={() => void inspect()}>{reviewLabel(pending, preview)}</button></div>
    <ArchiveStatus done={done} error={preview ? null : error} />
    <ArchivePreviewDialog preview={preview} pending={pending} error={error} onClose={closePreview} onCancel={() => setPreview(null)} onOrganize={organize} />
  </section>;
}

function reviewLabel(pending: boolean, preview: ArchivePreview | null): string {
  return pending && preview === null ? 'Reviewing…' : 'Review…';
}

function ArchiveStatus({ done, error }: { done: boolean; error: string | null }) {
  if (done) return <p role="status">Terminal notes are organized.</p>;
  if (error) return <p role="alert">{error}</p>;
  return null;
}

function ArchivePreviewDialog({ preview, pending, error, onClose, onCancel, onOrganize }: { preview: ArchivePreview | null; pending: boolean; error: string | null; onClose: () => void; onCancel: () => void; onOrganize: () => Promise<void> }) {
  if (preview === null) return null;
  const disabled = pending || preview.entries.length === 0 || preview.diagnostics.length > 0;
  const copy = archiveDialogCopy(preview.resuming, pending);
  return <DialogSurface title={copy.title} onClose={onClose}>
    <p>{copy.description}</p>
    <ArchivePreviewNotices preview={preview} error={error} />
    <ul className="focus-flow__archive-preview">{preview.entries.filter((entry) => entry.before.path !== entry.after.path).map((entry) => <li key={entry.id}><span>{entry.before.path}</span><span>→ {entry.after.path}</span></li>)}</ul>
    {preview.diagnostics.map((message) => <p key={message} role="alert">{message}</p>)}
    <div className="focus-flow__dialog-actions"><button type="button" disabled={pending} onClick={onCancel}>Cancel</button><button type="button" className="focus-flow__button-primary" disabled={disabled} onClick={() => void onOrganize()}>{copy.action}</button></div>
  </DialogSurface>;
}

function ArchivePreviewNotices({ preview, error }: { preview: ArchivePreview; error: string | null }) {
  const nothingToDo = preview.entries.length === 0 && preview.diagnostics.length === 0;
  const hasDerivedLinks = preview.entries.some((entry) => entry.before.path === entry.after.path);
  return <>{nothingToDo && <p>Everything is already in place. No changes needed.</p>}{hasDerivedLinks && <p>Derived child links will be updated before their parent notes move.</p>}{error && <p role="alert" className="focus-flow__error">{error}</p>}</>;
}

function archiveDialogCopy(resuming: boolean, pending: boolean) {
  if (resuming) return { title: 'Resume workspace operation', description: 'Continue the saved operation. Already-applied changes will be kept.', action: pending ? 'Applying…' : 'Resume operation' };
  return { title: 'Organize terminal notes', description: 'Move the canonical notes to their timestamp month. No copies, lifecycle changes or History edits.', action: pending ? 'Applying…' : 'Organize notes' };
}
