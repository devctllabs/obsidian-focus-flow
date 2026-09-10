import { tagColorStyle, useTagCatalog } from './TagCatalog';

export function CompactTags({ tags }: { tags: readonly string[] }) {
  const { entries } = useTagCatalog();
  const unique = [...new Set(tags)];
  if (unique.length === 0) return null;
  return <span className="focus-flow__compact-tags" title={unique.map((tag) => `#${tag}`).join(', ')}>
    {unique.slice(0, 2).map((tag) => <span className={tagClassName(entries[tag]?.color)} style={tagColorStyle(entries, tag)} key={tag}>#{tag}</span>)}
    {unique.length > 2 && <span className="focus-flow__tag-overflow">+{unique.length - 2}</span>}
  </span>;
}

export function TagChip({
  tag,
  selected,
  onClick,
}: {
  tag: string;
  selected?: boolean;
  onClick?: () => void;
}) {
  const { entries } = useTagCatalog();
  const className = tagClassName(entries[tag]?.color, onClick !== undefined);
  if (onClick === undefined) {
    return <span className={className} style={tagColorStyle(entries, tag)}>#{tag}</span>;
  }
  return (
    <button
      aria-pressed={selected}
      style={tagColorStyle(entries, tag)}
      className={className}
      onClick={onClick}
      type="button"
    >
      #{tag}
    </button>
  );
}

function tagClassName(color?: string, button = false): string {
  return ['focus-flow__tag', color && 'focus-flow__tag--colored', button && 'focus-flow__tag-button'].filter(Boolean).join(' ');
}
