import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { InfoIcon } from '../ui/Icons';
import { portalTheme } from '../ui/portal-theme';

export function SprintCriteriaHint({ storyKey, onEdit, disabled }: { storyKey: string; onEdit?: () => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({});
  const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null);
  const content = useRef<HTMLDivElement>(null);
  const focusContent = useRef(false);
  const id = useId();

  useLayoutEffect(() => {
    const button = trigger;
    if (!open || !button) return;
    const rect = button.getBoundingClientRect();
    const view = button.ownerDocument.defaultView!;
    const height = content.current?.getBoundingClientRect().height ?? 0;
    setPosition({ ...portalTheme(button), top: Math.max(8, Math.min(rect.bottom, view.innerHeight - height - 8)), right: Math.max(8, view.innerWidth - rect.right) });
    if (focusContent.current) { content.current?.focus(); focusContent.current = false; }
  }, [open, trigger]);

  useEffect(() => {
    if (!open) return;
    if (!trigger) return;
    const doc = trigger.ownerDocument;
    const outside = (event: PointerEvent | FocusEvent) => {
      if (!trigger.contains(event.target as Node) && !content.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault(); setOpen(false); trigger.focus();
    };
    const close = () => setOpen(false);
    doc.addEventListener('pointerdown', outside);
    doc.addEventListener('focusin', outside);
    doc.addEventListener('keydown', escape);
    doc.defaultView?.addEventListener('resize', close);
    doc.addEventListener('scroll', close, true);
    return () => {
      doc.removeEventListener('pointerdown', outside);
      doc.removeEventListener('focusin', outside);
      doc.removeEventListener('keydown', escape);
      doc.defaultView?.removeEventListener('resize', close);
      doc.removeEventListener('scroll', close, true);
    };
  }, [open, trigger]);

  return <span onPointerEnter={(event) => { if (event.pointerType === 'mouse') setOpen(true); }} onPointerLeave={() => {
    const active = trigger?.ownerDocument.activeElement;
    if (active !== trigger && !content.current?.contains(active ?? null)) setOpen(false);
  }}>
    <button ref={setTrigger} className="focus-flow__icon-button" type="button" aria-label={`Why ${storyKey} cannot enter a Sprint`} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => {
      if (open) content.current?.focus();
      else { focusContent.current = true; setOpen(true); }
    }}><InfoIcon /></button>
    {open && trigger && createPortal(<div ref={content} id={id} className="focus-flow focus-flow__criteria-hint" role="dialog" aria-label="Sprint requirement" tabIndex={-1} style={position}>
      <p>Add at least one Acceptance Criterion before adding this Story to a Sprint.</p>
      {onEdit && <button type="button" className="focus-flow__button-quiet" disabled={disabled} aria-label={`Add criteria to ${storyKey}`} onClick={() => { setOpen(false); onEdit(); }}>Add criteria</button>}
    </div>, trigger.ownerDocument.body)}
  </span>;
}
