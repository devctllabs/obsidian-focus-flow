import { generateNKeysBetween } from 'fractional-indexing';
import { sprintFolder, workFolder } from '../../domain/terminal-archive';
import type { ManagedEntity } from '../../domain/managed-note';
import { compareOrdinal, compareRank } from '../../domain/ordering';
import type { WorkBodyFields } from '../work/work-body-fields';
import type {
  IdRepairPlan,
  IdRepairReference,
  KeyRepairPlan,
  MoveNoteRepairPlan,
  RankField,
  WorkEntity,
  WorkNoteDiagnostic,
} from '../../domain/work-note';

export interface IndexedEntity {
  entity: ManagedEntity;
  path: string;
  bodyFields?: WorkBodyFields;
}

interface IndexedWorkEntity extends IndexedEntity {
  entity: WorkEntity;
}

interface RankContext {
  category: 0 | 1 | 2 | 3;
  rank: string;
  collectionLabel: string;
  field: RankField;
}

export interface WorkIndexAnalysis {
  diagnostics: WorkNoteDiagnostic[];
  entitiesById: ReadonlyMap<string, readonly IndexedEntity[]>;
}

export function analyzeIndexedEntities(
  indexedEntities: readonly IndexedEntity[],
  rootFolder?: string,
): WorkIndexAnalysis {
  const diagnostics: WorkNoteDiagnostic[] = [];
  diagnostics.push(...openSprintDiagnostics(indexedEntities));
  const indexedWorkEntities = indexedEntities.filter(isIndexedWorkEntity);
  const entitiesById = groupEntitiesBy(indexedEntities, (entity) => entity.id);
  diagnostics.push(...duplicateIdDiagnostics(indexedEntities, entitiesById));

  const entitiesByKey = groupEntitiesBy(
    indexedWorkEntities,
    (entity) => entity.key,
  );
  diagnostics.push(
    ...duplicateKeyDiagnostics(
      indexedWorkEntities,
      entitiesById,
      entitiesByKey,
    ),
    ...duplicateRankDiagnostics(indexedWorkEntities),
  );

  const epicIds = entityIdsOfType(indexedWorkEntities, 'epic');
  const storyIds = entityIdsOfType(indexedWorkEntities, 'story');
  for (const indexed of indexedEntities) diagnostics.push(...indexedEntityDiagnostics(indexed, { epicIds, storyIds, entitiesById, rootFolder }));

  return { diagnostics, entitiesById };
}

function openSprintDiagnostics(indexedEntities: readonly IndexedEntity[]): WorkNoteDiagnostic[] {
  const openSprints = indexedEntities.filter(({ entity }) => entity.type === 'sprint' && (entity.lifecycle === 'draft' || entity.lifecycle === 'active'));
  if (openSprints.length <= 1) return [];
  return openSprints.map(({ path }) => ({ code: 'multiple-open-sprints', message: 'Only one Draft or Active Sprint may exist.', path }));
}

function indexedEntityDiagnostics(indexed: IndexedEntity, context: { epicIds: ReadonlySet<string>; storyIds: ReadonlySet<string>; entitiesById: ReadonlyMap<string, readonly IndexedEntity[]>; rootFolder?: string }): WorkNoteDiagnostic[] {
  const diagnostics: WorkNoteDiagnostic[] = [];
  if (indexed.entity.type === 'story') diagnostics.push(...storyDiagnostics(indexed.entity, indexed.path, context));
  if (indexed.entity.type === 'task') diagnostics.push(...taskDiagnostics(indexed.entity, indexed.path, context));
  const placement = placementDiagnostic(indexed, context.rootFolder);
  if (placement) diagnostics.push(placement);
  return diagnostics;
}

function storyDiagnostics(entity: Extract<WorkEntity, { type: 'story' }>, path: string, context: { epicIds: ReadonlySet<string>; entitiesById: ReadonlyMap<string, readonly IndexedEntity[]> }): WorkNoteDiagnostic[] {
  const diagnostics: WorkNoteDiagnostic[] = [];
  if (!context.epicIds.has(entity.epicId)) diagnostics.push({ code: 'missing-parent', message: `Parent Epic ${entity.epicId} was not found.`, path });
  const parentMatches = context.entitiesById.get(entity.epicId);
  const parent = parentMatches?.length === 1 ? parentMatches[0]?.entity : undefined;
  if (terminalEpicOwnsCurrentStory(parent, entity)) diagnostics.push({ code: 'terminal-parent', severity: 'error', message: `Story parent Epic ${parent.key} is terminal.`, path });
  const mismatch = parentLinkMismatchDiagnostic(path, entity.epicLink, parentMatches, 'epic');
  if (mismatch) diagnostics.push(mismatch);
  return diagnostics;
}

function terminalEpicOwnsCurrentStory(parent: ManagedEntity | undefined, story: Extract<WorkEntity, { type: 'story' }>): parent is Extract<WorkEntity, { type: 'epic' }> {
  if (parent?.type !== 'epic' || story.lifecycle === 'done' || story.lifecycle === 'closed') return false;
  return parent.lifecycle === 'done' || parent.lifecycle === 'closed';
}

function taskDiagnostics(entity: Extract<WorkEntity, { type: 'task' }>, path: string, context: { storyIds: ReadonlySet<string>; entitiesById: ReadonlyMap<string, readonly IndexedEntity[]> }): WorkNoteDiagnostic[] {
  const diagnostics: WorkNoteDiagnostic[] = [];
  if (!context.storyIds.has(entity.storyId)) diagnostics.push({ code: 'missing-parent', message: `Parent Story ${entity.storyId} was not found.`, path });
  const timestamp = taskTimestampDiagnostic(entity, path);
  if (timestamp) diagnostics.push(timestamp);
  const mismatch = parentLinkMismatchDiagnostic(path, entity.storyLink, context.entitiesById.get(entity.storyId), 'story');
  if (mismatch) diagnostics.push(mismatch);
  return diagnostics;
}

function placementDiagnostic({ entity, path }: IndexedEntity, rootFolder?: string): WorkNoteDiagnostic | null {
  let placement: ReturnType<typeof placementFor>;
  try { placement = placementFor(entity); }
  catch (error) { return { code: 'wrong-folder', path, message: error instanceof Error ? error.message : 'Fix the terminal timestamp before organizing this note.' }; }
  if (pathIsInFolder(path, placement.folder, rootFolder)) return null;
  return { code: 'wrong-folder', message: placement.message, path, repair: { kind: 'move-note', path, id: entity.id, targetFolder: placement.folder } };
}

function taskTimestampDiagnostic(
  task: Extract<WorkEntity, { type: 'task' }>,
  path: string,
): WorkNoteDiagnostic | null {
  if (
    (task.status === 'in_progress' || task.status === 'external_in_progress') &&
    task.startedAt === null
  ) {
    const label = task.status === 'in_progress'
      ? 'In Progress'
      : 'External In Progress';
    return {
      code: 'missing-transition-timestamp',
      severity: 'warning',
      message: `${label} Task is missing started_at.`,
      path,
    };
  }
  if (task.status === 'done' && task.completedAt === null) {
    return {
      code: 'missing-transition-timestamp',
      severity: 'warning',
      message: 'Done Task is missing completed_at.',
      path,
    };
  }
  return null;
}

function isIndexedWorkEntity(
  indexedEntity: IndexedEntity,
): indexedEntity is IndexedWorkEntity {
  return indexedEntity.entity.type !== 'sprint';
}

function groupEntitiesBy<T extends IndexedEntity>(
  indexedEntities: readonly T[],
  identity: (entity: T['entity']) => string,
): Map<string, T[]> {
  const groups = new Map<string, T[]>();

  for (const indexedEntity of indexedEntities) {
    const key = identity(indexedEntity.entity);
    const matches = groups.get(key) ?? [];
    matches.push(indexedEntity);
    groups.set(key, matches);
  }

  return groups;
}

function duplicateGroups<T>(
  groups: ReadonlyMap<string, readonly T[]>,
): Array<[string, readonly T[]]> {
  return Array.from(groups).filter(([, matches]) => matches.length > 1);
}

function entityIdsOfType(
  indexedEntities: readonly IndexedWorkEntity[],
  type: WorkEntity['type'],
): Set<string> {
  return new Set(
    indexedEntities
      .filter(({ entity }) => entity.type === type)
      .map(({ entity }) => entity.id),
  );
}

function placementFor(
  entity: ManagedEntity,
): { folder: MoveNoteRepairPlan['targetFolder']; message: string } {
  if (entity.type === 'sprint') {
    const folder = sprintFolder(entity) as MoveNoteRepairPlan['targetFolder'];
    const lifecycle = entity.lifecycle === 'draft' ? 'Draft' : entity.lifecycle === 'active' ? 'Active' : 'Closed';
    return {
      folder,
      message: `${lifecycle} Sprint notes belong in ${folder}.`,
    };
  }
  if (entity.type === 'candidate') {
    const folder = entity.lifecycle === 'inbox' ? 'Inbox' : 'Distractions';
    return {
      folder,
      message: `Candidate notes with lifecycle ${entity.lifecycle} belong in ${folder}.`,
    };
  }
  const folder = workFolder(entity) as MoveNoteRepairPlan['targetFolder'];
  return { folder, message: `${entity.type === 'epic' ? 'Epic' : entity.type === 'story' ? 'Story' : 'Task'} notes belong in ${folder}.` };
}

function pathIsInFolder(
  path: string,
  folder: MoveNoteRepairPlan['targetFolder'],
  rootFolder?: string,
): boolean {
  const parentPath = path.split('/').slice(0, -1).join('/');
  if (rootFolder !== undefined) return parentPath === (rootFolder ? `${rootFolder}/${folder}` : folder);
  return parentPath === folder || parentPath.endsWith(`/${folder}`);
}

function rankContextFor(entity: WorkEntity): RankContext | null {
  if (entity.type === 'epic' && entity.lifecycle === 'backlog') {
    return {
      category: 0,
      rank: entity.backlogRank,
      collectionLabel: 'the Epic Backlog',
      field: 'backlog_rank',
    };
  }
  if (entity.type === 'story') return storyRankContext(entity);
  if (entity.type === 'task') {
    return {
      category: 3,
      rank: entity.taskRank,
      collectionLabel: `Tasks of Story ${entity.storyId}`,
      field: 'task_rank',
    };
  }
  return null;
}

function storyRankContext(entity: Extract<WorkEntity, { type: 'story' }>): RankContext | null {
  if (entity.lifecycle === 'backlog' && entity.backlogRank !== null) return { category: 1, rank: entity.backlogRank, collectionLabel: 'the Month Backlog', field: 'backlog_rank' };
  const inSprint = entity.lifecycle === 'draft_sprint' || entity.lifecycle === 'active_sprint';
  if (inSprint && entity.sprintId !== null && entity.sprintRank !== null) return { category: 2, rank: entity.sprintRank, collectionLabel: `Sprint ${entity.sprintId}`, field: 'sprint_rank' };
  return null;
}

function duplicateRankDiagnostics(
  indexedEntities: readonly IndexedWorkEntity[],
): WorkNoteDiagnostic[] {
  type RankedEntity = IndexedWorkEntity & { rank: string; field: RankField };
  const collections = [
    new Map<string, RankedEntity[]>(),
    new Map<string, RankedEntity[]>(),
    new Map<string, RankedEntity[]>(),
    new Map<string, RankedEntity[]>(),
  ] as const;

  for (const indexedEntity of indexedEntities) {
    const context = rankContextFor(indexedEntity.entity);
    if (context === null) continue;
    const collection = collections[context.category];
    const entries = collection.get(context.collectionLabel) ?? [];
    entries.push({ ...indexedEntity, rank: context.rank, field: context.field });
    collection.set(context.collectionLabel, entries);
  }

  const diagnostics: WorkNoteDiagnostic[] = [];
  for (const collectionsByLabel of collections) {
    for (const [collectionLabel, entries] of collectionsByLabel) {
      const entitiesByRank = new Map<string, RankedEntity[]>();
      for (const entry of entries) {
        const matches = entitiesByRank.get(entry.rank) ?? [];
        matches.push(entry);
        entitiesByRank.set(entry.rank, matches);
      }

      const duplicateRanks = duplicateGroups(entitiesByRank);
      if (duplicateRanks.length === 0) continue;

      const repair = buildRankRepairPlan(collectionLabel, entries);
      let repairAttached = false;

      for (const [rank, matches] of duplicateRanks) {
        diagnostics.push(
          ...matches.map(({ path }) => {
            const diagnostic: WorkNoteDiagnostic = {
              code: 'duplicate-rank',
              message: `Rank ${rank} is duplicated in ${collectionLabel}.`,
              path,
            };
            if (!repairAttached) {
              diagnostic.repair = repair;
              repairAttached = true;
            }
            return diagnostic;
          }),
        );
      }
    }
  }

  return diagnostics;
}

function buildRankRepairPlan(
  collectionLabel: string,
  entries: ReadonlyArray<
    IndexedEntity & { rank: string; field: RankField }
  >,
) {
  const orderedEntries = [...entries].sort((left, right) =>
    compareRank(left.rank, right.rank, left.entity.id, right.entity.id),
  );
  const replacementRanks = generateNKeysBetween(
    null,
    null,
    orderedEntries.length,
  );

  return {
    kind: 'rebalance-ranks' as const,
    collectionLabel,
    entries: orderedEntries.map((entry, index) => ({
      path: entry.path,
      id: entry.entity.id,
      field: entry.field,
      expectedValue: entry.rank,
      replacementValue: replacementRanks[index]!,
    })),
  };
}

function keySequence(key: string): bigint {
  return BigInt(key.slice(3));
}

function replacementPath(path: string, replacementKey: string): string {
  const segments = path.split('/');
  const filename = segments.pop();
  if (!filename) return path;
  segments.push(filename.replace(/^FF-[1-9]\d* /, `${replacementKey} `));
  return segments.join('/');
}

function keyRepairLinks(
  indexedEntities: readonly IndexedWorkEntity[],
  entries: KeyRepairPlan['entries'],
): KeyRepairPlan['links'] {
  const entriesById = new Map(entries.map((entry) => [entry.id, entry]));

  return indexedEntities
    .map(({ entity, path }) => {
      const context =
        entity.type === 'story'
          ? {
              parent: entriesById.get(entity.epicId),
              field: 'epic_link' as const,
              value: entity.epicLink,
            }
          : entity.type === 'task'
            ? {
                parent: entriesById.get(entity.storyId),
                field: 'story_link' as const,
                value: entity.storyLink,
              }
            : null;
      if (
        context === null ||
        context.parent === undefined ||
        !linkTargetsPath(context.value, context.parent.path)
      ) {
        return null;
      }

      return {
        path,
        parentId: context.parent.id,
        field: context.field,
        expectedValue: context.value,
        replacementValue: `[[${context.parent.replacementPath.replace(/\.md$/, '')}]]`,
      };
    })
    .filter((link) => link !== null)
    .sort((left, right) => compareOrdinal(left.path, right.path));
}

function duplicateKeyDiagnostics(
  indexedEntities: readonly IndexedWorkEntity[],
  entitiesById: ReadonlyMap<string, readonly IndexedEntity[]>,
  entitiesByKey: ReadonlyMap<string, readonly IndexedWorkEntity[]>,
): WorkNoteDiagnostic[] {
  const duplicateIds = new Set(
    Array.from(entitiesById)
      .filter(([, matches]) => matches.length > 1)
      .map(([id]) => id),
  );
  const duplicateKeys = duplicateGroups(entitiesByKey)
    .sort(([left], [right]) => {
      const leftSequence = keySequence(left);
      const rightSequence = keySequence(right);
      return leftSequence < rightSequence
        ? -1
        : leftSequence > rightSequence
          ? 1
          : 0;
    });
  const repairableLosers = duplicateKeys.flatMap(([, matches]) => {
    if (matches.some(({ entity }) => duplicateIds.has(entity.id))) return [];
    return [...matches]
      .sort((left, right) => compareOrdinal(left.entity.id, right.entity.id))
      .slice(1);
  });
  const maximumKey = indexedEntities.reduce(
    (maximum, { entity }) => {
      const sequence = keySequence(entity.key);
      return sequence > maximum ? sequence : maximum;
    },
    0n,
  );
  const entries = repairableLosers.map(({ entity, path }, index) => {
    const replacementKey = `FF-${maximumKey + BigInt(index + 1)}`;
    return {
      path,
      id: entity.id,
      expectedKey: entity.key,
      replacementKey,
      replacementPath: replacementPath(path, replacementKey),
    };
  });
  const links = keyRepairLinks(indexedEntities, entries);
  const repair: KeyRepairPlan | undefined =
    entries.length === 0
      ? undefined
      : { kind: 'repair-duplicate-keys', entries, links };
  const repairPath = entries[0]?.path;

  return duplicateKeys.flatMap(([key, matches]) =>
    matches.map(({ path }) => {
      const diagnostic: WorkNoteDiagnostic = {
        code: 'duplicate-key',
        message: `Key ${key} is used by multiple notes.`,
        path,
      };
      if (repair !== undefined && path === repairPath) {
        diagnostic.repair = repair;
      }
      return diagnostic;
    }),
  );
}

function duplicateIdDiagnostics(
  indexedEntities: readonly IndexedEntity[],
  entitiesById: ReadonlyMap<string, readonly IndexedEntity[]>,
): WorkNoteDiagnostic[] {
  const duplicateIds = duplicateGroups(entitiesById);
  const entries: IdRepairPlan['entries'][number][] = [];
  const references: IdRepairReference[] = [];

  for (const [id, matches] of duplicateIds) {
    const groupRepair = duplicateIdGroupRepair(indexedEntities, id, matches);
    if (groupRepair === null) continue;
    entries.push(...groupRepair.entries);
    references.push(...groupRepair.references);
  }
  const repair: IdRepairPlan | undefined =
    entries.length === 0
      ? undefined
      : { kind: 'repair-duplicate-ids', entries, references };
  const repairPath = entries[0]?.path;

  return duplicateIds.flatMap(([id, matches]) => duplicateIdGroupDiagnostics(id, matches, repair, repairPath));
}

function duplicateIdGroupRepair(
  indexedEntities: readonly IndexedEntity[],
  id: string,
  matches: readonly IndexedEntity[],
): { entries: IdRepairPlan['entries']; references: IdRepairReference[] } | null {
  const orderedMatches = [...matches].sort((left, right) => compareOrdinal(left.path, right.path));
  const keeperPath = orderedMatches[0]!.path;
  const references = duplicateIdReferences(indexedEntities, id, matches, keeperPath);
  if (references === null) return null;
  return {
    entries: orderedMatches.slice(1).map(({ path }) => ({ path, expectedId: id })),
    references,
  };
}

function duplicateIdReferences(
  indexedEntities: readonly IndexedEntity[],
  id: string,
  matches: readonly IndexedEntity[],
  keeperPath: string,
): IdRepairReference[] | null {
  const repairs: IdRepairReference[] = [];
  for (const indexedEntity of indexedEntities) {
    for (const reference of idReferences(indexedEntity).filter(({ expectedId }) => expectedId === id)) {
      const targetPath = uniqueReferenceTarget(matches, reference);
      if (targetPath === null) return null;
      if (targetPath === keeperPath) continue;
      repairs.push({ path: indexedEntity.path, field: reference.field, expectedId: id, replacementForPath: targetPath });
    }
  }
  return repairs;
}

function uniqueReferenceTarget(
  matches: readonly IndexedEntity[],
  reference: ReturnType<typeof idReferences>[number],
): string | null {
  const targets = matches.filter(({ entity, path }) =>
    entity.type === reference.targetType &&
    (reference.link === undefined || linkTargetsPath(reference.link, path)),
  );
  return targets.length === 1 ? targets[0]!.path : null;
}

function duplicateIdGroupDiagnostics(
  id: string,
  matches: readonly IndexedEntity[],
  repair: IdRepairPlan | undefined,
  repairPath: string | undefined,
): WorkNoteDiagnostic[] {
  return matches.map(({ path }) => ({
    code: 'duplicate-id',
    message: `UUID ${id} is used by multiple notes.`,
    path,
    ...(repair !== undefined && path === repairPath ? { repair } : {}),
  }));
}

function idReferences(indexedEntity: IndexedEntity): Array<{
  field: IdRepairReference['field'];
  expectedId: string;
  targetType: ManagedEntity['type'];
  link?: string;
}> {
  const { entity } = indexedEntity;
  if (entity.type === 'story') {
    return [
      {
        field: 'epic_id',
        expectedId: entity.epicId,
        targetType: 'epic',
        link: entity.epicLink,
      },
      ...(entity.sprintId === null
        ? []
        : [
            {
              field: 'sprint_id' as const,
              expectedId: entity.sprintId,
              targetType: 'sprint' as const,
            },
          ]),
    ];
  }
  if (entity.type === 'task') {
    return [
      {
        field: 'story_id',
        expectedId: entity.storyId,
        targetType: 'story',
        link: entity.storyLink,
      },
    ];
  }
  return [];
}

function linkTargetsPath(link: string, path: string): boolean {
  const match = link
    .trim()
    .match(/^\[\[([^#|\]]+)(?:#[^|\]]*)?(?:\|[^\]]*)?\]\]$/);
  const target = match?.[1]?.trim().replace(/\.md$/, '');
  if (!target) return false;

  const pathWithoutExtension = path.replace(/\.md$/, '');
  return (
    target === pathWithoutExtension ||
    pathWithoutExtension.endsWith(`/${target}`)
  );
}

function parentLinkMismatchDiagnostic(
  childPath: string,
  link: string,
  parentMatches: readonly IndexedEntity[] | undefined,
  parentType: 'epic' | 'story',
): WorkNoteDiagnostic | null {
  const parent = parentMatches?.length === 1 ? parentMatches[0] : undefined;
  if (
    parent?.entity.type !== parentType ||
    linkTargetsPath(link, parent.path)
  ) {
    return null;
  }

  const parentLabel = parentType === 'epic' ? 'Epic' : 'Story';
  return {
    code: 'parent-link-mismatch',
    message: `Parent link does not match ${parentLabel} ${parent.entity.key} at ${parent.path}.`,
    path: childPath,
    repair: {
      kind: 'replace-parent-link',
      path: childPath,
      parentId: parent.entity.id,
      field: parentType === 'epic' ? 'epic_link' : 'story_link',
      expectedValue: link,
      replacementValue: `[[${parent.path.replace(/\.md$/, '')}]]`,
    },
  };
}
