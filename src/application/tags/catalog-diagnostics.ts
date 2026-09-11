import type { TagCatalog } from '../../domain/tag-catalog';
import type { WorkNoteDiagnostic } from '../../domain/work-note';
import type { ProjectedManagedEntity } from '../indexing/work-index';

export function uncatalogedTagDiagnostics(
  entities: readonly ProjectedManagedEntity[],
  catalog: TagCatalog,
): WorkNoteDiagnostic[] {
  const usage = currentNativeTagUsage(entities);
  const firstPath = new Map<string, string>();
  for (const entity of entities) {
    if (!isCurrentWork(entity)) continue;
    for (const tag of new Set(entity.tags)) {
      if (!firstPath.has(tag)) firstPath.set(tag, entity.path);
    }
  }
  return Object.entries(usage).filter(([tag]) => catalog.entries[tag] === undefined).map(([tag, count]) => ({
    code: 'uncataloged-tag',
    message: `#${tag} is used on ${count} current ${count === 1 ? 'note' : 'notes'} but is not in the Tag Catalog.`,
    path: firstPath.get(tag)!,
    severity: 'warning',
    repair: { kind: 'catalog-tag', tag },
  }));
}

export function currentNativeTagUsage(entities: readonly ProjectedManagedEntity[]): Readonly<Record<string, number>> {
  const usage: Record<string, number> = {};
  for (const entity of entities) {
    if (!isCurrentWork(entity)) continue;
    for (const tag of new Set(entity.tags)) usage[tag] = (usage[tag] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(usage).sort(([left], [right]) => left.localeCompare(right)));
}

function isCurrentWork(entity: ProjectedManagedEntity): entity is Exclude<ProjectedManagedEntity, { type: 'sprint' }> {
  if (entity.type === 'sprint') return false;
  if (entity.type === 'candidate') return entity.lifecycle === 'inbox';
  if (entity.type === 'epic') return entity.lifecycle === 'backlog';
  if (entity.type === 'story') return entity.lifecycle !== 'done' && entity.lifecycle !== 'closed';
  return entity.lifecycle === 'active';
}
