import { DragDropProvider, DragOverlay, useDroppable } from '@dnd-kit/react';
import { isSortable, useSortable } from '@dnd-kit/react/sortable';
import { createContext, useContext, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { GripIcon } from '../ui/Icons';

export interface BoardDragItem {
  id: string;
  label: string;
}

interface BoardDragAdapterProps {
  items: readonly BoardDragItem[];
  enabled: boolean;
  disabled?: boolean;
  group: string;
  listClassName: string;
  itemClassName?: string;
  onMove?: (id: string, targetIndex: number) => void;
  renderItem: (item: BoardDragItem, index: number) => ReactNode;
  managedByParent?: boolean;
}

export type BoardDropOutcome = 'committed' | 'reverted';

interface BoardDragSurfaceProps {
  children: ReactNode;
  canPreviewMove?: (
    id: string,
    initialGroup: string,
    targetGroup: string,
  ) => boolean;
  onMove: (
    id: string,
    initialGroup: string,
    targetGroup: string,
    targetIndex: number,
  ) => void | BoardDropOutcome | Promise<BoardDropOutcome>;
  renderOverlay?: (id: string) => ReactNode;
}

interface DragPreview {
  id: string;
  sourceGroup: string;
  targetGroup: string;
  targetIndex: number;
  height: number;
}

const DragPreviewContext = createContext<DragPreview | null>(null);

export function BoardDragSurface({ children, canPreviewMove, onMove, renderOverlay }: BoardDragSurfaceProps) {
  const [preview, setPreview] = useState<DragPreview | null>(null);
  const previewRef = useRef<DragPreview | null>(null);
  const outcomeRef = useRef<Promise<BoardDropOutcome>>(Promise.resolve('reverted'));
  const smooth = renderOverlay !== undefined;

  const updatePreview = (next: DragPreview | null) => {
    previewRef.current = next;
    setPreview(next);
  };

  const handleDragStart: NonNullable<ComponentProps<typeof DragDropProvider>['onDragStart']> = (event) => {
    if (!smooth || !isSortable(event.operation.source)) return;
    const source = event.operation.source;
    updatePreview({
      id: String(source.id),
      sourceGroup: String(source.initialGroup ?? source.group ?? ''),
      targetGroup: String(source.initialGroup ?? source.group ?? ''),
      targetIndex: source.initialIndex,
      height: source.element?.getBoundingClientRect().height ?? 0,
    });
  };

  const handleDragOver = (event: DragOverEvent) => {
    preventCrossListSorting(event);
    if (!smooth || !isSortable(event.operation.source)) return;
    const source = event.operation.source;
    const destination = surfaceDragDestination(
      event.operation.target,
      source.initialGroup,
      source.group,
      source.index,
    );
    const initialGroup = String(source.initialGroup ?? '');
    if (!previewAllowed(canPreviewMove, String(source.id), initialGroup, destination.group)) {
      updatePreview(previewRef.current === null ? null : { ...previewRef.current, targetGroup: initialGroup, targetIndex: source.initialIndex });
      return;
    }
    updatePreview({
      id: String(source.id),
      sourceGroup: initialGroup,
      targetGroup: destination.group,
      targetIndex: destination.index,
      height: dragPreviewHeight(previewRef.current, source.element),
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const active = previewRef.current;
    const destination = smooth && active !== null
      ? { group: active.targetGroup, index: active.targetIndex }
      : undefined;
    const result = finishSurfaceDrag(event, onMove, canPreviewMove, destination);
    outcomeRef.current = Promise.resolve(result ?? 'reverted').catch(() => 'reverted');
    if (!smooth) updatePreview(null);
  };

  const dropAnimation: NonNullable<ComponentProps<typeof DragOverlay>['dropAnimation']> = async ({ element, feedbackElement }) => {
    const active = previewRef.current;
    if (active === null) return;
    const target = findDropTarget(element.ownerDocument, active);
    if (target !== null) await animateBetween(feedbackElement, target, 180);
    const outcome = await outcomeRef.current;
    if (outcome === 'reverted') {
      const source = findBoardItem(element.ownerDocument, active.id, active.sourceGroup);
      if (source !== null) await animateBetween(feedbackElement, source, 180);
    } else {
      await waitForBoardItem(element.ownerDocument, active.id, active.targetGroup);
    }
    flushSync(() => updatePreview(null));
  };

  return (
    <DragDropProvider
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <DragPreviewContext.Provider value={smooth ? preview : null}>
        {children}
        {smooth && <DragOverlay className="focus-flow__drag-overlay" dropAnimation={dropAnimation}>
          {preview && <div data-board-drag-overlay={preview.id} data-board-drag-target-group={preview.targetGroup}>{renderOverlay(preview.id)}</div>}
        </DragOverlay>}
      </DragPreviewContext.Provider>
    </DragDropProvider>
  );
}

export function BoardDragAdapter(props: BoardDragAdapterProps) {
  if (
    !props.enabled ||
    (!props.managedByParent && props.onMove === undefined)
  ) {
    return <StaticList {...props} />;
  }

  if (props.managedByParent) return <SortableList {...props} />;

  return (
    <DragDropProvider
      onDragEnd={(event) => finishListDrag(event, props.onMove)}
    >
      <SortableList {...props} />
    </DragDropProvider>
  );
}

type DragEndEvent = Parameters<NonNullable<ComponentProps<typeof DragDropProvider>['onDragEnd']>>[0];
type DragOverEvent = Parameters<NonNullable<ComponentProps<typeof DragDropProvider>['onDragOver']>>[0];

function preventCrossListSorting(event: DragOverEvent) {
  const { source, target } = event.operation;
  // Cross-list membership is committed by React after domain validation.
  // Optimistic sorting would reparent a React-owned DOM node beforehand.
  if (isSortable(source) && isSortable(target) && source.initialGroup !== target.group) event.preventDefault();
}

function previewAllowed(
  canPreviewMove: BoardDragSurfaceProps['canPreviewMove'],
  id: string,
  initialGroup: string,
  targetGroup: string,
) {
  return canPreviewMove === undefined || canPreviewMove(id, initialGroup, targetGroup);
}

function dragPreviewHeight(preview: DragPreview | null, element: Element | undefined) {
  if (preview !== null) return preview.height;
  return element?.getBoundingClientRect().height ?? 0;
}

function finishSurfaceDrag(
  event: DragEndEvent,
  onMove: BoardDragSurfaceProps['onMove'],
  canPreviewMove?: BoardDragSurfaceProps['canPreviewMove'],
  previewDestination?: { group: string; index: number },
) {
  const { canceled, operation } = event;
  const source = operation.source;
  if (canceled || !isSortable(source)) return;
  const initialGroup = String(source.initialGroup ?? '');
  const destination = previewDestination ?? surfaceDragDestination(
    operation.target,
    source.initialGroup,
    source.group,
    source.index,
  );
  if (source.initialIndex === destination.index && initialGroup === destination.group) return;
  if (canPreviewMove && !canPreviewMove(String(source.id), initialGroup, destination.group)) return;
  return onMove(String(source.id), initialGroup, destination.group, destination.index);
}

function surfaceDragDestination(
  target: DragEndEvent['operation']['target'],
  initialGroup: string | number | undefined,
  currentGroup: string | number | undefined,
  currentIndex: number,
): { group: string; index: number } {
  const emptyTarget = emptyTargetData(target?.data);
  if (emptyTarget !== null) return emptyTarget;
  if (isSortable(target) && target.group !== initialGroup) return { group: String(target.group), index: target.index };
  return { group: String(currentGroup ?? ''), index: currentIndex };
}

function finishListDrag(event: DragEndEvent, onMove: BoardDragAdapterProps['onMove']) {
  const { canceled, operation } = event;
  const source = operation.source;
  if (canceled || !isSortable(source) || source.initialIndex === source.index) return;
  onMove?.(String(source.id), source.index);
}

function SortableList(props: BoardDragAdapterProps) {
  const preview = useContext(DragPreviewContext);
  const slotIndex = dropSlotIndex(preview, props.group, props.items);
  const disabled = props.disabled ?? false;
  const slotHeight = preview?.height ?? 0;
  return (
    <ol className={props.listClassName}>
      {props.items.length === 0 && slotIndex < 0 && (
        <EmptyDropTarget
          disabled={disabled}
          group={props.group}
        />
      )}
      {props.items.flatMap((item, index) => [
        slotIndex === index ? <DropSlot disabled={disabled} group={props.group} height={slotHeight} index={index} key={`slot:${props.group}`} /> : null,
        <SortableItem
          disabled={disabled}
          group={props.group}
          item={item}
          itemClassName={props.itemClassName}
          key={item.id}
          index={index}
        >
          {props.renderItem(item, index)}
        </SortableItem>,
      ])}
      {slotIndex === props.items.length && <DropSlot disabled={disabled} group={props.group} height={slotHeight} index={slotIndex} />}
    </ol>
  );
}

function dropSlotIndex(preview: DragPreview | null, group: string, items: readonly BoardDragItem[]) {
  if (
    preview === null ||
    preview.sourceGroup === group ||
    preview.targetGroup !== group ||
    items.some((item) => item.id === preview.id)
  ) return -1;
  return Math.max(0, Math.min(preview.targetIndex, items.length));
}

function DropSlot({ disabled, group, height, index }: { disabled: boolean; group: string; height: number; index: number }) {
  const { ref } = useDroppable({
    id: `focus-flow-slot:${group}`,
    data: { focusBoardGroup: group, focusBoardIndex: index },
    disabled,
  });
  return <li aria-hidden="true" className="focus-flow__board-drop-slot" data-board-drop-slot ref={ref} style={{ height }} />;
}

function StaticList({
  items,
  listClassName,
  itemClassName,
  renderItem,
}: BoardDragAdapterProps) {
  return (
    <ol className={listClassName}>
      {items.map((item, index) => (
        <li className={itemClassName} key={item.id}>
          {renderItem(item, index)}
        </li>
      ))}
    </ol>
  );
}

function SortableItem({
  item,
  index,
  group,
  disabled,
  itemClassName,
  children,
}: {
  item: BoardDragItem;
  index: number;
  group: string;
  disabled: boolean;
  itemClassName?: string;
  children: ReactNode;
}) {
  const preview = useContext(DragPreviewContext);
  const { ref, handleRef, isDragging } = useSortable({
    id: item.id,
    index,
    group,
    disabled,
  });

  return (
    <li
      className={itemClassName}
      data-board-drag-group={group}
      data-board-drag-hidden={preview?.id === item.id ? 'true' : undefined}
      data-board-drag-id={item.id}
      data-dragging={isDragging ? 'true' : undefined}
      ref={ref}
    >
      <button
        aria-label={`Drag ${item.label}`}
        className="focus-flow__drag-handle"
        disabled={disabled}
        ref={handleRef}
        type="button"
      >
        <GripIcon />
      </button>
      {children}
    </li>
  );
}

function findDropTarget(document: Document, preview: DragPreview): Element | null {
  if (preview.sourceGroup === preview.targetGroup) {
    return findBoardItem(document, preview.id, preview.sourceGroup);
  }
  return document.querySelector('[data-board-drop-slot]');
}

function findBoardItem(document: Document, id: string, group: string): Element | null {
  return Array.from(document.querySelectorAll('[data-board-drag-id]')).find((element) =>
    element.getAttribute('data-board-drag-id') === id &&
    element.getAttribute('data-board-drag-group') === group,
  ) ?? null;
}

async function waitForBoardItem(document: Document, id: string, group: string): Promise<Element | null> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const item = findBoardItem(document, id, group);
    if (item !== null) return item;
    await nextFrame(document);
  }
  return null;
}

async function animateBetween(element: Element, target: Element, duration: number): Promise<void> {
  const visual = element.firstElementChild ?? element;
  const from = visual.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  const view = element.ownerDocument.defaultView;
  const reducedMotion = prefersReducedMotion(view);
  const currentTransform = view?.getComputedStyle(visual).transform ?? 'none';
  const finalTransform = `translate(${to.left - from.left}px, ${to.top - from.top}px) ${currentTransform === 'none' ? '' : currentTransform}`;
  if (reducedMotion || duration === 0) {
    applyTransform(visual, finalTransform);
    return;
  }
  const animation = visual.animate(
    { transform: [currentTransform, finalTransform] },
    { duration, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' },
  );
  try {
    await Promise.race([animation.finished, delay(view, duration + 32)]);
    animation.finish();
    applyTransform(visual, finalTransform);
  } catch { /* A superseding drag may cancel the animation. */ }
}

function prefersReducedMotion(view: Window | null) {
  return view !== null && view.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function applyTransform(element: Element, transform: string) {
  if (element.instanceOf(HTMLElement)) element.style.transform = transform;
}

function nextFrame(document: Document): Promise<void> {
  return new Promise((resolve) => document.defaultView?.requestAnimationFrame(() => resolve()) ?? resolve());
}

function delay(view: Window | null, milliseconds: number): Promise<void> {
  return new Promise((resolve) => view?.setTimeout(resolve, milliseconds) ?? resolve());
}

function EmptyDropTarget({
  group,
  disabled,
}: {
  group: string;
  disabled: boolean;
}) {
  const { ref, isDropTarget } = useDroppable({
    id: `focus-flow-empty:${group}`,
    data: { focusBoardGroup: group, focusBoardIndex: 0 },
    disabled,
  });
  return (
    <li
      aria-hidden="true"
      className="focus-flow__empty-drop-target"
      data-drop-target={isDropTarget ? 'true' : undefined}
      ref={ref}
    />
  );
}

function emptyTargetData(
  data: Record<string, unknown> | undefined,
): { group: string; index: number } | null {
  return typeof data?.focusBoardGroup === 'string' &&
    typeof data.focusBoardIndex === 'number'
    ? { group: data.focusBoardGroup, index: data.focusBoardIndex }
    : null;
}
