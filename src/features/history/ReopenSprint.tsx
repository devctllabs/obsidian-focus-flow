import { useEffect, useState } from 'react';
import type { WorkspaceLifecycle, ReopenPreview } from '../../application/workspace/workspace-lifecycle';
import { DialogSurface } from '../ui/DialogSurface';
import { formatErrorMessage } from '../ui/error-message';

export function ReopenSprint({ sprintId, code, resuming, blocked, lifecycle, revision }: { sprintId: string; code: string; resuming: boolean; blocked?: string; lifecycle: Pick<WorkspaceLifecycle, 'previewReopen' | 'reopen'>; revision?: unknown }) {
  const [preview, setPreview] = useState<ReopenPreview | null>(null);
  const [eligible, setEligible] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!blocked) void lifecycle.previewReopen(sprintId).then(() => {
      if (!cancelled) { setEligible(true); setError(null); }
    }, (error: unknown) => {
      if (!cancelled) { setEligible(false); setError(formatErrorMessage(error, 'Could not check Reopen eligibility. Refresh and retry.')); }
    });
    return () => { cancelled = true; };
  }, [sprintId, lifecycle, blocked, revision]);
  const inspect = async () => {
    setPending(true); setError(null);
    try { setPreview(await lifecycle.previewReopen(sprintId)); }
    catch (error) { setError(formatErrorMessage(error, 'Could not check Reopen eligibility. Refresh and retry.')); }
    finally { setPending(false); }
  };
  const reopen = async () => {
    setPending(true); setError(null);
    try { await lifecycle.reopen(sprintId); setPreview(null); }
    catch (error) { setError(formatErrorMessage(error, 'Reopen stopped safely. Review the notes and resume from History.')); }
    finally { setPending(false); }
  };
  return <div className="focus-flow__reopen-sprint"><button type="button" className="focus-flow__button-quiet" disabled={pending || !eligible || Boolean(blocked)} onClick={() => void inspect()}>{reopenTriggerLabel(resuming, code)}</button>
    <ReopenNotice blocked={blocked} error={preview ? null : error} />
    <ReopenDialog preview={preview} code={code} pending={pending} error={error} onCancel={() => setPreview(null)} onReopen={reopen} />
  </div>;
}

function reopenTriggerLabel(resuming: boolean, code: string): string {
  return resuming ? `Resume reopening ${code}` : `Reopen ${code}`;
}

function ReopenNotice({ blocked, error }: { blocked?: string; error: string | null }) {
  if (blocked) return <p className="focus-flow__report-caption">{blocked}</p>;
  if (error) return <p role="alert" className="focus-flow__error">{error}</p>;
  return null;
}

function ReopenDialog({ preview, code, pending, error, onCancel, onReopen }: { preview: ReopenPreview | null; code: string; pending: boolean; error: string | null; onCancel: () => void; onReopen: () => Promise<void> }) {
  if (preview === null) return null;
  return <DialogSurface title={`${preview.resuming ? 'Resume reopening' : 'Reopen'} ${code}?`} onClose={() => { if (!pending) onCancel(); }}>
      <p>Restore this Sprint and its work to their exact pre-close state. Its boundary will leave History until you close it again.</p><p>Your note text, tags and retrospective stay as they are. The original calendar dates do not change.</p>
      {error && <p role="alert" className="focus-flow__error">{error}</p>}
      <div className="focus-flow__dialog-actions"><button type="button" disabled={pending} onClick={onCancel}>Cancel</button><button type="button" className="focus-flow__button-primary" disabled={pending} onClick={() => void onReopen()}>{reopenActionLabel(pending, preview.resuming)}</button></div>
    </DialogSurface>;
}

function reopenActionLabel(pending: boolean, resuming: boolean): string {
  if (pending) return 'Reopening…';
  return resuming ? 'Resume Reopen' : 'Reopen Sprint';
}
