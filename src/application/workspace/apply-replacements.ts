import { managedEqual, type ManagedBlock, type ManagedReplacement } from '../../domain/managed-replacement';

export interface ManagedReplacementStore {
  read(path: string): Promise<ManagedBlock | null>;
  replace(path: string, expected: ManagedBlock, replacement: ManagedBlock): Promise<void>;
  move(path: string, destination: string, expected: ManagedBlock): Promise<void>;
}
export async function validateReplacements(store: ManagedReplacementStore, entries: readonly ManagedReplacement[], resuming = false): Promise<void> {
  const destinations = new Set<string>();
  for (const entry of entries) {
    await validateReplacement(store, entry, destinations, resuming);
  }
}

async function validateReplacement(store: ManagedReplacementStore, entry: ManagedReplacement, destinations: Set<string>, resuming: boolean): Promise<void> {
  if (destinations.has(entry.after.path)) throw new Error(`Two notes target ${entry.after.path}. Resolve the collision first.`);
  destinations.add(entry.after.path);
  const source = await store.read(entry.before.path);
  const moved = entry.before.path !== entry.after.path;
  const destination = moved ? await store.read(entry.after.path) : source;
  if (moved && source && destination) throw new Error(`Destination already exists: ${entry.after.path}. No file was overwritten.`);
  const before = managedEqual(source, entry.before.managed);
  const after = managedEqual(destination, entry.after.managed);
  // A durable operation can stop between replacing frontmatter and renaming.
  const intermediate = source !== null && managedEqual(source, entry.after.managed);
  if (!before && !canResumeReplacement(resuming, after, intermediate)) throw new Error(`Work changed at ${entry.before.path}. Review the note before resuming; no unsafe replacement was applied.`);
}

function canResumeReplacement(resuming: boolean, after: boolean, intermediate: boolean): boolean {
  return resuming && (after || intermediate);
}
export async function applyReplacements(store: ManagedReplacementStore, entries: readonly ManagedReplacement[]): Promise<void> {
  await validateReplacements(store, entries, true);
  const ordered = [...entries].sort((a, b) => a.id.localeCompare(b.id));
  // Complete every derived link before any owner path changes.
  for (const entry of ordered) {
    const source = await store.read(entry.before.path);
    if (source !== null && !managedEqual(source, entry.after.managed)) await store.replace(entry.before.path, entry.before.managed, entry.after.managed);
  }
  for (const entry of ordered) {
    if (entry.before.path !== entry.after.path && await store.read(entry.before.path) !== null) await store.move(entry.before.path, entry.after.path, entry.after.managed);
  }
}
