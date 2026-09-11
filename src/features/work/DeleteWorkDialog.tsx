import type { DeletableWork, WorkDeletionPreview } from '../../application/work/delete-work';
import { useEffect, useState } from 'react';
import { DialogSurface } from '../ui/DialogSurface';
import { formatErrorMessage } from '../ui/error-message';
import { AttentionIcon } from '../ui/Icons';

export interface DeleteWorkDialogProps {
  item: DeletableWork;
  onPreview: (id: string) => Promise<WorkDeletionPreview>;
  onDelete: (preview: WorkDeletionPreview) => Promise<void>;
  onClose: () => void;
  onOpenNote?: (path: string, event: MouseEvent) => void;
}
export function DeleteWorkDialog({ item, onPreview, onDelete, onClose, onOpenNote }: DeleteWorkDialogProps) {
  const [preview, setPreview] = useState<WorkDeletionPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    let current = true;
    void onPreview(item.id).then((result) => { if (current) setPreview(result); }).catch((cause: unknown) => { if (current) setError(formatErrorMessage(cause, 'Could not check this note. Cancel and try Delete again.')); });
    return () => { current = false; };
  }, [item.id, onPreview]);
  const remove = async () => {
    if (!canDelete(preview, pending, reviewed)) return;
    setPending(true); setError(null);
    try { await onDelete(preview); onClose(); }
    catch (cause) { setError(formatErrorMessage(cause, 'Could not move this note to trash. Check vault access and try again.')); }
    finally { setPending(false); }
  };
  return <DialogSurface title={`Delete ${item.key}?`} description={item.title} onClose={() => { if (!pending) onClose(); }}>
    <DeletePreviewStatus preview={preview} error={error} item={item} pending={pending} reviewed={reviewed} onOpenNote={onOpenNote} onReviewed={setReviewed} />
    <DeleteError error={error} />
    <footer className="focus-flow__dialog-actions"><button disabled={pending} type="button" onClick={onClose}>Cancel</button><button className="focus-flow__button-danger" disabled={!canDelete(preview, pending, reviewed)} type="button" onClick={() => void remove()}>{pending ? 'Moving to trash…' : 'Move to trash'}</button></footer>
  </DialogSurface>;
}

function canDelete(preview: WorkDeletionPreview | null, pending: boolean, reviewed: boolean): preview is WorkDeletionPreview {
  if (preview === null || pending || preview.blockers.length > 0) return false;
  return preview.warnings.length === 0 || reviewed;
}

function DeletePreviewStatus({ preview, error, item, pending, reviewed, onOpenNote, onReviewed }: { preview: WorkDeletionPreview | null; error: string | null; item: DeletableWork; pending: boolean; reviewed: boolean; onOpenNote?: (path: string, event: MouseEvent) => void; onReviewed: (reviewed: boolean) => void }) {
  if (preview === null) return error ? null : <p role="status">Checking content and relationships…</p>;
  const needsReview = preview.warnings.length > 0 && preview.blockers.length === 0;
  return <div className="focus-flow__delete-preview">
    <p>The entire note will move to trash using your Obsidian deletion preference.</p>
    <DeleteFindings preview={preview} />
    {onOpenNote && <button type="button" disabled={pending} onClick={(event) => onOpenNote(item.path, event.nativeEvent)}>Open note</button>}
    {needsReview && <label><input type="checkbox" checked={reviewed} disabled={pending} onChange={(event) => onReviewed(event.currentTarget.checked)} />I have reviewed this note and want to remove its content</label>}
  </div>;
}

function DeleteFindings({ preview }: { preview: WorkDeletionPreview }) {
  if (preview.blockers.length === 0) return <>{preview.warnings.map((warning) => <p key={warning}>{warning}</p>)}</>;
  return <><h3>Before you can delete this item</h3><ul>{preview.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul></>;
}

function DeleteError({ error }: { error: string | null }) {
  if (!error) return null;
  return <div className="focus-flow__delete-error" role="alert"><AttentionIcon /><div><strong>Could not delete note</strong><p>{error}</p></div></div>;
}
