import type { MouseEvent as ReactMouseEvent } from 'react';
import { CompactTags } from '../ui/Tags';

interface WorkTitleButtonProps {
  item: { key: string; title: string; path: string; tags?: readonly string[]; effectiveTags?: readonly string[] };
  onOpenNote?: (path: string, event: MouseEvent) => void;
}

export function WorkTitleButton({ item, onOpenNote }: WorkTitleButtonProps) {
  const tags = [...new Set([...(item.tags ?? []), ...(item.effectiveTags ?? [])])];
  const open = (event: ReactMouseEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    onOpenNote?.(item.path, event.nativeEvent);
  };
  return (
    <button
      aria-label={`Open ${item.key} ${item.title}`}
      aria-description={tags.length > 0 ? `Tags: ${tags.map((tag) => `#${tag}`).join(', ')}` : undefined}
      className="focus-flow__title-link"
      onAuxClick={open}
      onClick={open}
      type="button"
    >
      <span className="focus-flow__key">{item.key}</span>
      <span className="focus-flow__title-content"><span className="focus-flow__title-text">{item.title}</span>{tags.length > 0 && <> <CompactTags tags={tags} /></>}</span>
    </button>
  );
}
