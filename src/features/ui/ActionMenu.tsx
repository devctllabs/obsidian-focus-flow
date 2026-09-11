import {
  Children,
  Fragment,
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import { MoreIcon } from './Icons';
import { portalTheme } from './portal-theme';
import { accentAttributes, useAccentPreference } from '../appearance/AppearanceRoot';

export function ActionMenu({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null);
  const [position, setPosition] = useState<CSSProperties>({ top: 0, right: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const accent = accentAttributes(useAccentPreference());

  useLayoutEffect(() => {
    if (!open || buttonRef.current === null) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const view = buttonRef.current.ownerDocument.defaultView!;
    const menuHeight = menuRef.current?.getBoundingClientRect().height ?? 0;
    setPosition({
      ...portalTheme(buttonRef.current),
      top: Math.max(8, Math.min(rect.bottom + 6, view.innerHeight - menuHeight - 8)),
      right: Math.max(8, view.innerWidth - rect.right),
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const ownerDocument = buttonRef.current?.ownerDocument ?? document;
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      handleMenuKey(event, { ownerDocument, menu: menuRef.current, trigger: buttonRef.current, close: () => setOpen(false) });
    };
    ownerDocument.addEventListener('pointerdown', closeOutside);
    ownerDocument.addEventListener('keydown', closeOnEscape);
    const closeOnResize = () => setOpen(false);
    ownerDocument.defaultView?.addEventListener('resize', closeOnResize);
    queueMicrotask(() => menuRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus());
    return () => {
      ownerDocument.removeEventListener('pointerdown', closeOutside);
      ownerDocument.removeEventListener('keydown', closeOnEscape);
      ownerDocument.defaultView?.removeEventListener('resize', closeOnResize);
    };
  }, [open]);

  const closeChildren = withClose(children, () => {
    setOpen(false);
    trigger?.focus();
  });

  return (
    <>
      <button
        aria-controls={open ? menuId : undefined}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        className="focus-flow__icon-button"
        onClick={(event) => { setTrigger(event.currentTarget); setOpen((value) => !value); }}
        ref={buttonRef}
        title={label}
        type="button"
      >
        <MoreIcon />
      </button>
      {open && createPortal(
        <div
          className="focus-flow focus-flow__popover-menu"
          data-ff-accent={accent['data-ff-accent']}
          id={menuId}
          ref={menuRef}
          role="menu"
          style={{ ...position, ...accent.style }}
        >
          {closeChildren}
        </div>,
        trigger?.ownerDocument.body ?? document.body,
      )}
    </>
  );
}

function handleMenuKey(event: KeyboardEvent, context: { ownerDocument: Document; menu: HTMLDivElement | null; trigger: HTMLButtonElement | null; close: () => void }): void {
  if (event.key === 'Escape' || event.key === 'Tab') {
    event.preventDefault();
    context.close();
    context.trigger?.focus();
    return;
  }
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const items = Array.from(context.menu?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
  items[nextMenuIndex(event.key, items.indexOf(context.ownerDocument.activeElement as HTMLButtonElement), items.length)]?.focus();
}

function nextMenuIndex(key: string, current: number, length: number): number {
  if (key === 'Home') return 0;
  if (key === 'End') return length - 1;
  const direction = key === 'ArrowDown' ? 1 : -1;
  return (current + direction + length) % length;
}

function withClose(children: ReactNode, close: () => void): ReactNode {
  return Children.map(children, (child) => {
    if (!isValidElement(child)) return child;
    if (child.type === Fragment) {
      const fragment = child as ReactElement<{ children?: ReactNode }>;
      return <>{withClose(fragment.props.children, close)}</>;
    }
    const element = child as ReactElement<{ onClick?: () => void }>;
    return cloneElement(element, {
      onClick: () => {
        close();
        element.props.onClick?.();
      },
    });
  });
}

export function MenuAction({
  children,
  destructive = false,
  disabled = false,
  onClick,
}: {
  children: ReactNode;
  destructive?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      className={destructive ? 'is-destructive' : undefined}
      disabled={disabled}
      onClick={onClick}
      role="menuitem"
      type="button"
    >
      {children}
    </button>
  );
}
