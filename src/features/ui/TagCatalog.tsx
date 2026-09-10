import { createContext, useContext, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import type { TagCatalogService } from '../../application/tags/tag-catalog';
import type { TagCatalog } from '../../domain/tag-catalog';

const EMPTY: TagCatalog = { entries: {}, diagnostics: [] };
const Context = createContext<TagCatalog>(EMPTY);
const subscribeEmpty = () => () => undefined;
const getEmpty = () => EMPTY;

export function TagCatalogProvider({ service, children }: { service?: Pick<TagCatalogService, 'subscribe' | 'getSnapshot'>; children: ReactNode }) {
  const catalog = useSyncExternalStore(service?.subscribe ?? subscribeEmpty, service?.getSnapshot ?? getEmpty, service?.getSnapshot ?? getEmpty);
  return <Context value={catalog}>{children}</Context>;
}

export const useTagCatalog = () => useContext(Context);

export function tagColorStyle(entries: TagCatalog['entries'], tag: string): CSSProperties | undefined {
  const color = entries[tag]?.color;
  return color ? { '--ff-tag-color': color } as CSSProperties : undefined;
}
