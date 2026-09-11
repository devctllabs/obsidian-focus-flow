import type { CSSProperties } from 'react';

/** Portals retain the originating leaf's tokens, including in pop-out windows. */
export function portalTheme(origin: Element | null): CSSProperties {
  const view = origin?.ownerDocument.defaultView;
  if (!origin || !view) return {};
  const styles = view.getComputedStyle(origin);
  return { colorScheme: styles.colorScheme, ...Object.fromEntries(Array.from(styles)
    .filter((property) => property.startsWith('--ff-'))
    .map((property) => [property, styles.getPropertyValue(property)])) };
}
