export function effectiveTags(
  ...levels: ReadonlyArray<readonly string[]>
): string[] {
  return Array.from(new Set(levels.flatMap((level) => level)));
}
