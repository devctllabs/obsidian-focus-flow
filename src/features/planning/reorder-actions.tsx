import { MenuAction } from '../ui/ActionMenu';

export interface ReorderProps {
  item: { id: string; key: string };
  index: number;
  length: number;
  onReorder?: (id: string, targetIndex: number) => void;
  disabled: boolean;
  adjacentDisabled?: boolean;
}

export function reorderActionsFor({ item, index, length, onReorder, disabled, adjacentDisabled = false }: ReorderProps) {
  const move = (target: number) => {
    if (target !== index) onReorder?.(item.id, target);
  };
  const unavailable = disabled || onReorder === undefined;
  return <>
    <MenuAction disabled={unavailable || index === 0} onClick={() => move(0)}>Move to top</MenuAction>
    <MenuAction disabled={unavailable || adjacentDisabled || index === 0} onClick={() => move(index - 1)}>Move up</MenuAction>
    <MenuAction disabled={unavailable || adjacentDisabled || index === length - 1} onClick={() => move(index + 1)}>Move down</MenuAction>
    <MenuAction disabled={unavailable || index === length - 1} onClick={() => move(length - 1)}>Move to bottom</MenuAction>
  </>;
}
