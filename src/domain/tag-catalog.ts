import { parseDocument } from 'yaml';

export interface TagCatalogEntry {
  readonly description?: string;
  readonly color?: string;
}

export interface TagCatalog {
  readonly entries: Readonly<Record<string, TagCatalogEntry>>;
  readonly diagnostics: readonly string[];
}

export interface TagCatalogEntryUpdate {
  readonly description?: string | null;
  readonly color?: string | null;
}

export const normalizeCatalogTag = (tag: string) => tag.trim().replace(/^#+/, '');
export const isTagColor = (color: unknown): color is string => typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color);

function readDocument(markdown: string) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) throw new Error('Add valid frontmatter to TAGS.md before editing its catalog.');
  const doc = parseDocument(match[1]!);
  if (doc.errors.length) throw new Error('Fix the YAML in TAGS.md (including duplicate keys), then refresh.');
  const data: unknown = doc.toJS();
  const managed = isRecord(data) ? data.focus_flow : undefined;
  if (!isRecord(managed) || managed.schema_version !== 1 || managed.type !== 'tag_catalog' || !isRecord(managed.tags)) {
    throw new Error('TAGS.md needs focus_flow type: tag_catalog, schema_version: 1 and a tags mapping.');
  }
  return { doc, tags: managed.tags, body: markdown.slice(match[0].length) };
}

export function parseTagCatalog(markdown: string | null): TagCatalog {
  const entries: Record<string, TagCatalogEntry> = Object.create(null) as Record<string, TagCatalogEntry>;
  const diagnostics: string[] = [];
  if (markdown === null) return { entries, diagnostics };
  try {
    const { tags } = readDocument(markdown);
    const state = { entries, diagnostics, seen: new Set<string>(), collided: new Set<string>() };
    for (const [rawTag, rawEntry] of Object.entries(tags)) {
      parseCatalogEntry(rawTag, rawEntry, state);
    }
  } catch (error) {
    diagnostics.push(error instanceof Error ? error.message : 'Could not read TAGS.md.');
  }
  return { entries, diagnostics };
}

export function updateTagCatalog(markdown: string | null, inputTag: string, update: TagCatalogEntryUpdate | null): string {
  const tag = normalizeCatalogTag(inputTag);
  validateCatalogUpdate(tag, update);
  const { doc, body, tags } = readDocument(markdown ?? '---\nfocus_flow:\n  schema_version: 1\n  type: tag_catalog\n  tags: {}\n---\n');
  const matchingKeys = Object.keys(tags).filter((key) => normalizeCatalogTag(key) === tag);
  if (matchingKeys.length > 1) throw new Error(`Keep one entry for #${tag} in TAGS.md before editing it.`);
  const key = matchingKeys[0] ?? tag;
  if (update === null) doc.deleteIn(['focus_flow', 'tags', key]);
  else applyCatalogUpdate({ doc, tags, key, tag, update });
  return `---\n${doc.toString()}---\n${body}`;
}

interface CatalogParseState {
  entries: Record<string, TagCatalogEntry>;
  diagnostics: string[];
  seen: Set<string>;
  collided: Set<string>;
}

function parseCatalogEntry(rawTag: string, rawEntry: unknown, state: CatalogParseState): void {
  const tag = normalizeCatalogTag(rawTag);
  if (!tag) {
    state.diagnostics.push('TAGS.md contains an empty tag key. Remove it or choose an exact tag.');
    return;
  }
  if (state.seen.has(tag)) {
    delete state.entries[tag];
    if (!state.collided.has(tag)) state.diagnostics.push(`Tag #${tag} appears more than once after normalization. Keep one entry in TAGS.md.`);
    state.collided.add(tag);
    return;
  }
  state.seen.add(tag);
  if (!isRecord(rawEntry)) {
    state.diagnostics.push(`Entry for #${tag} is invalid. Use a YAML mapping such as {} in TAGS.md.`);
    return;
  }
  state.entries[tag] = parseEntryFields(tag, rawEntry, state.diagnostics);
}

function parseEntryFields(tag: string, rawEntry: Record<string, unknown>, diagnostics: string[]): TagCatalogEntry {
  const entry: { description?: string; color?: string } = {};
  if (rawEntry.description !== undefined) {
    if (typeof rawEntry.description === 'string' && rawEntry.description.trim()) entry.description = rawEntry.description.trim();
    else diagnostics.push(`Description for #${tag} is invalid. Use a non-empty string or remove it from TAGS.md.`);
  }
  if (rawEntry.color !== undefined) {
    if (isTagColor(rawEntry.color)) entry.color = rawEntry.color.toUpperCase();
    else diagnostics.push(`Color for #${tag} is invalid. Use a six-digit HEX color such as #6750A4 in TAGS.md.`);
  }
  return entry;
}

function validateCatalogUpdate(tag: string, update: TagCatalogEntryUpdate | null): void {
  if (!tag) throw new Error('Choose a tag first.');
  if (update?.description !== undefined && update.description !== null && !update.description.trim()) throw new Error('Description must contain text or be cleared.');
  if (update?.color !== undefined && update.color !== null && !isTagColor(update.color)) throw new Error('Use a six-digit HEX color such as #6750A4.');
}

function applyCatalogUpdate({ doc, tags, key, tag, update }: {
  doc: ReturnType<typeof parseDocument>;
  tags: Record<string, unknown>;
  key: string;
  tag: string;
  update: TagCatalogEntryUpdate;
}): void {
  const existing = tags[key];
  if (existing !== undefined && !isRecord(existing)) throw new Error(`Fix the entry for #${tag} in TAGS.md before editing it.`);
  if (existing === undefined) doc.setIn(['focus_flow', 'tags', key], doc.createNode({}));
  if (update.description !== undefined) {
    if (update.description === null) doc.deleteIn(['focus_flow', 'tags', key, 'description']);
    else doc.setIn(['focus_flow', 'tags', key, 'description'], update.description.trim());
  }
  if (update.color !== undefined) {
    if (update.color === null) doc.deleteIn(['focus_flow', 'tags', key, 'color']);
    else doc.setIn(['focus_flow', 'tags', key, 'color'], update.color.toUpperCase());
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
