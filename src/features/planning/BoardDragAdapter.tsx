import { DragDropProvider, useDroppable } from '@dnd-kit/react';
import { isSortable, useSortable } from '@dnd-kit/react/sortable';
import type { ComponentProps, ReactNode } from 'react';
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

interface BoardDragSurfaceProps {
  children: ReactNode;
  onMove: (
    id: string,
    initialGroup: string,
    targetGroup: string,
    targetIndex: number,
  ) => void;
}

export function BoardDragSurface({ children, onMove }: BoardDragSurfaceProps) {
  return (
    <DragDropProvider
      onDragOver={preventCrossListSorting}
      onDragEnd={(event) => finishSurfaceDrag(event, onMove)}
    >
      {children}
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

function finishSurfaceDrag(event: DragEndEvent, onMove: BoardDragSurfaceProps['onMove']) {
  const { canceled, operation } = event;
  const source = operation.source;
  if (canceled || !isSortable(source)) return;
  const initialGroup = String(source.initialGroup ?? '');
  const destination = surfaceDragDestination(
    operation.target,
    source.initialGroup,
    source.group,
    source.index,
  );
  if (source.initialIndex === destination.index && initialGroup === destination.group) return;
  onMove(String(source.id), initialGroup, destination.group, destination.index);
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
  return (
    <ol className={props.listClassName}>
      {props.items.length === 0 && (
        <EmptyDropTarget
          disabled={props.disabled ?? false}
          group={props.group}
        />
      )}
      {props.items.map((item, index) => (
        <SortableItem
          disabled={props.disabled ?? false}
          group={props.group}
          item={item}
          itemClassName={props.itemClassName}
          key={item.id}
          index={index}
        >
          {props.renderItem(item, index)}
        </SortableItem>
      ))}
    </ol>
  );
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
  const { ref, handleRef, isDragging } = useSortable({
    id: item.id,
    index,
    group,
    disabled,
  });

  return (
    <li
      className={itemClassName}
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
