import { parseTagCatalog, updateTagCatalog, type TagCatalog, type TagCatalogEntryUpdate } from '../../domain/tag-catalog';

export interface TagCatalogStore {
  read(): Promise<string | null>;
  update(transform: (markdown: string | null) => string): Promise<void>;
}

/** Independent of WorkIndex: a broken catalog must never make work read-only. */
export class TagCatalogService {
  private snapshot: TagCatalog = parseTagCatalog(null);
  private listeners = new Set<() => void>();
  private revision = 0;
  private saving: Promise<void> = Promise.resolve();
  constructor(private readonly store: TagCatalogStore) {}
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  async refresh() {
    const revision = ++this.revision;
    let snapshot: TagCatalog;
    try { snapshot = parseTagCatalog(await this.store.read()); }
    catch { snapshot = { entries: {}, diagnostics: ['Could not read TAGS.md. Check the file and refresh.'] }; }
    if (revision !== this.revision) return;
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener();
  }
  upsert = (tag: string, update: TagCatalogEntryUpdate = {}): Promise<void> => this.mutate((markdown) => updateTagCatalog(markdown, tag, update));
  remove = (tag: string): Promise<void> => this.mutate((markdown) => updateTagCatalog(markdown, tag, null));
  async ensureAdded(tags: readonly string[], previousTags: readonly string[] = []): Promise<void> {
    const previous = new Set(previousTags);
    const missing = [...new Set(tags)].filter((tag) => !previous.has(tag) && this.snapshot.entries[tag] === undefined);
    for (const tag of missing) await this.upsert(tag);
  }
  private mutate(transform: (markdown: string | null) => string): Promise<void> {
    const run = this.saving.then(async () => {
      await this.store.update(transform);
      await this.refresh();
    });
    this.saving = run.catch(() => undefined);
    return run;
  }
}
