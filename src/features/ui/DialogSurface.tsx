import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { CloseIcon } from './Icons';
import { portalTheme } from './portal-theme';
import { accentAttributes, useAccentPreference } from '../appearance/AppearanceRoot';

export function DialogSurface({
  title,
  description,
  children,
  onClose,
  initialFocusRef,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  initialFocusRef?: RefObject<HTMLElement | null>;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  const [origin] = useState(() => document.activeElement as HTMLElement | null);
  const accent = useAccentPreference();
  const appearance = accentAttributes(accent);
  const theme = portalTheme(origin);
  const ownerDocument = origin?.ownerDocument ?? document;
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    (initialFocusRef?.current ?? closeRef.current)?.focus();
    const escape = (event: KeyboardEvent) => {
      handleDialogKey(event, { dialog: dialogRef.current, ownerDocument, close: () => onCloseRef.current() });
    };
    ownerDocument.addEventListener('keydown', escape);
    return () => {
      ownerDocument.removeEventListener('keydown', escape);
      origin?.focus();
    };
  }, [initialFocusRef, origin, ownerDocument]);

  return createPortal(
    <div data-ff-accent={appearance['data-ff-accent']} className="focus-flow focus-flow__dialog-backdrop" style={{ ...theme, ...appearance.style }} onMouseDown={(event) => {
      if (event.currentTarget === event.target) onClose();
    }}>
      <section aria-describedby={description ? descriptionId : undefined} aria-labelledby={titleId} aria-modal="true" className="focus-flow__dialog" ref={dialogRef} role="dialog">
        <header>
          <div>
            <h2 id={titleId}>{title}</h2>
            {description && <p id={descriptionId}>{description}</p>}
          </div>
          <button aria-label="Close dialog" className="focus-flow__icon-button" onClick={onClose} ref={closeRef} type="button">
            <CloseIcon />
          </button>
        </header>
        {children}
      </section>
    </div>,
    ownerDocument.body,
  );
}

function handleDialogKey(event: KeyboardEvent, context: { dialog: HTMLElement | null; ownerDocument: Document; close: () => void }): void {
  if (event.key === 'Escape') {
    event.stopPropagation();
    context.close();
  }
  if (event.key !== 'Tab') return;
  const controls = focusableControls(context.dialog, context.ownerDocument);
  const destination = event.shiftKey && context.ownerDocument.activeElement === controls[0]
    ? controls.at(-1)
    : !event.shiftKey && context.ownerDocument.activeElement === controls.at(-1) ? controls[0] : undefined;
  if (destination) {
    event.preventDefault();
    destination.focus();
  }
}

function focusableControls(dialog: HTMLElement | null, ownerDocument: Document): HTMLElement[] {
  const selector = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], summary, [tabindex="0"]';
  return Array.from(dialog?.querySelectorAll<HTMLElement>(selector) ?? []).filter((element) => isFocusable(element, dialog, ownerDocument));
}

function isFocusable(element: HTMLElement, dialog: HTMLElement | null, ownerDocument: Document): boolean {
  if (element.closest('[hidden], [inert]') || element.getAttribute('tabindex') === '-1') return false;
  for (let ancestor: HTMLElement | null = element; ancestor && ancestor !== dialog?.parentElement; ancestor = ancestor.parentElement) {
    if (ancestorHidesElement(ancestor, element, ownerDocument)) return false;
  }
  return true;
}

function ancestorHidesElement(ancestor: HTMLElement, element: HTMLElement, ownerDocument: Document): boolean {
  const style = ownerDocument.defaultView?.getComputedStyle(ancestor);
  if (style?.display === 'none' || style?.visibility === 'hidden') return true;
  if (ancestor.tagName !== 'DETAILS' || ancestor.hasAttribute('open')) return false;
  return !ancestor.querySelector(':scope > summary')?.contains(element);
}
