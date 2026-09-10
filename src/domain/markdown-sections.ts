export interface MarkdownHeading {
  index: number;
  level: number;
}

function markdownHeading(
  line: string,
): { level: number; title: string } | null {
  const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
  return match?.[1] && match[2]
    ? { level: match[1].length, title: match[2] }
    : null;
}

export function findMarkdownHeadings(
  lines: readonly string[],
  title: string,
): MarkdownHeading[] {
  return lines.flatMap((line, index) => {
    const heading = markdownHeading(line);
    return heading?.title === title
      ? [{ index, level: heading.level }]
      : [];
  });
}

export function sectionEnd(
  lines: readonly string[],
  start: number,
  level: number,
): number {
  const end = lines.findIndex((line, index) => {
    if (index <= start) return false;
    const heading = markdownHeading(line);
    return heading !== null && heading.level <= level;
  });
  return end < 0 ? lines.length : end;
}
