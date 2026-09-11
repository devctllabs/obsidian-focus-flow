import { sprintFolder, workFolder } from '../../domain/terminal-archive';
import { managedEqual, type ManagedReplacement, type ManagedState } from '../../domain/managed-replacement';
import type { WorkEntity } from '../../domain/work-note';

/** Adds archive placement and all current UUID-owned child links to the same plan. */
export function planArchive(root: string, notes: readonly ManagedState[], changes: readonly ManagedReplacement[], organize = false): ManagedReplacement[] {
  assertUniqueIdentities(notes);
  const replacements = new Map(changes.map((entry) => [entry.id, structuredClone(entry)]));
  addArchiveMoves(root, notes, replacements, organize);
  updateParentLinks(notes, replacements);
  return [...replacements.values()].filter(replacementChanged).sort((a, b) => a.id.localeCompare(b.id));
}

function assertUniqueIdentities(notes: readonly ManagedState[]): void {
  const ids = new Set<unknown>();
  for (const note of notes) {
    if (!note.managed.id || ids.has(note.managed.id)) throw new Error(`Missing or duplicate identity at ${note.path}. Repair IDs before organizing notes.`);
    ids.add(note.managed.id);
  }
}

function addArchiveMoves(root: string, notes: readonly ManagedState[], replacements: Map<string, ManagedReplacement>, organize: boolean): void {
  for (const note of notes) {
    const replacement = archiveMove(root, note, replacements.get(String(note.managed.id)), organize);
    if (replacement) replacements.set(replacement.id, replacement);
  }
}

function archiveMove(root: string, note: ManagedState, changed: ManagedReplacement | undefined, organize: boolean): ManagedReplacement | null {
  const current = changed?.after ?? note;
  if (!isArchivable(current.managed) || (!organize && !changed)) return null;
  const folder = archiveFolder(current.managed);
  const destination = `${root}/${folder}/${current.path.split('/').at(-1)!}`;
  if (destination === current.path) return null;
  const id = String(note.managed.id);
  return { id, before: changed?.before ?? note, after: { path: destination, managed: { ...current.managed } } };
}

function isArchivable(managed: Record<string, unknown>): boolean {
  const supported = managed.type === 'sprint' || ['epic', 'story', 'task'].includes(String(managed.type));
  return supported && (managed.lifecycle === 'done' || managed.lifecycle === 'closed');
}

function archiveFolder(managed: Record<string, unknown>): string {
  if (managed.type === 'sprint') return sprintFolder({ lifecycle: 'closed', closedAt: managed.closed_at as string | null });
  return workFolder({ type: managed.type as WorkEntity['type'], lifecycle: managed.lifecycle as WorkEntity['lifecycle'], completedAt: managed.completed_at as string | null, closedAt: managed.closed_at as string | null });
}

function updateParentLinks(notes: readonly ManagedState[], replacements: Map<string, ManagedReplacement>): void {
  // Compute links against final parent paths, including moved/reclassified children.
  for (const note of notes) {
    const id = String(note.managed.id);
    const changed = replacements.get(id);
    const current = changed?.after ?? note;
    const field = parentField(current.managed.type);
    if (field === null) continue;
    const parent = replacements.get(String(current.managed[`${field}_id`]));
    if (!parent || parent.before.path === parent.after.path) continue;
    const link = `[[${parent.after.path.replace(/\.md$/, '')}]]`;
    if (current.managed[`${field}_link`] !== link) replacements.set(id, { id, before: changed?.before ?? note, after: { path: current.path, managed: { ...current.managed, [`${field}_link`]: link } } });
  }
}

function parentField(type: unknown): 'epic' | 'story' | null {
  if (type === 'story') return 'epic';
  if (type === 'task') return 'story';
  return null;
}

function replacementChanged(entry: ManagedReplacement): boolean {
  return entry.before.path !== entry.after.path || !managedEqual(entry.before.managed, entry.after.managed);
}
