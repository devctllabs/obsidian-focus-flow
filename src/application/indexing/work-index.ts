import { effectiveTags } from '../../domain/effective-tags';
import { parseManagedNote } from '../../domain/managed-note';
import type { SprintEntity } from '../../domain/sprint-note';
import type {
  WorkEntity,
  WorkNoteDiagnostic,
  WorkNoteSource,
} from '../../domain/work-note';
import {
  analyzeIndexedEntities,
  type IndexedEntity,
} from './work-index-analysis';
import type { WipPolicies } from '../../domain/wip-policy';
import { wipDiagnostics } from './wip-diagnostics';
import { readBodyFields, type WorkBodyFields } from '../work/work-body-fields';

export type ProjectedWorkEntity = WorkEntity & {
  readonly bodyFields?: WorkBodyFields;
  readonly effectiveTags: readonly string[];
  readonly path: string;
};
export type ProjectedManagedEntity =
  | (SprintEntity & { readonly path: string })
  | ProjectedWorkEntity;

export interface WorkIndexSnapshot {
  phase: 'loading' | 'ready' | 'error';
  entities: readonly ProjectedManagedEntity[];
  diagnostics: readonly WorkNoteDiagnostic[];
  errorMessage?: string;
}

export interface WorkNoteSourceRepository {
  list(): Promise<readonly WorkNoteSource[]>;
  read?(path: string): Promise<WorkNoteSource | null>;
  readMission(): Promise<{ path: string; body: string | null }>;
}

interface WorkIndexOptions {
  readonly batchSize?: number;
  readonly yieldToMain?: () => Promise<void>;
  readonly getWipPolicies?: () => WipPolicies;
}

interface CachedNote {
  readonly indexedEntity: IndexedEntity | null;
  readonly diagnostics: readonly WorkNoteDiagnostic[];
}

const DEFAULT_BATCH_SIZE = 200;

function projectEffectiveTags(
  indexedEntities: readonly IndexedEntity[],
  entitiesById: ReadonlyMap<string, readonly IndexedEntity[]>,
): ProjectedManagedEntity[] {
  return indexedEntities.map((indexedEntity) =>
    projectEffectiveTag(indexedEntity, entitiesById),
  );
}

function projectEffectiveTag(
  indexedEntity: IndexedEntity,
  entitiesById: ReadonlyMap<string, readonly IndexedEntity[]>,
): ProjectedManagedEntity {
  const { entity, path, bodyFields } = indexedEntity;
  if (entity.type === 'sprint') return { ...entity, path };
  if (entity.type === 'candidate' || entity.type === 'epic') {
    return { ...entity, path, bodyFields, effectiveTags: effectiveTags(entity.tags) };
  }
  if (entity.type === 'story') return projectStory({ entity, path, bodyFields }, entitiesById);
  return projectTask({ entity, path, bodyFields }, entitiesById);
}

function projectStory(indexedEntity: IndexedEntity & { entity: Extract<WorkEntity, { type: 'story' }> }, entitiesById: ReadonlyMap<string, readonly IndexedEntity[]>): ProjectedManagedEntity {
  const { entity, path, bodyFields } = indexedEntity;
  const epic = uniqueWorkEntity(entitiesById, entity.epicId);
  const epicTags = epic?.type === 'epic' ? epic.tags : [];
  return { ...entity, path, bodyFields, effectiveTags: effectiveTags(epicTags, entity.tags) };
}

function projectTask(indexedEntity: IndexedEntity & { entity: Extract<WorkEntity, { type: 'task' }> }, entitiesById: ReadonlyMap<string, readonly IndexedEntity[]>): ProjectedManagedEntity {
  const { entity, path, bodyFields } = indexedEntity;
  const story = uniqueWorkEntity(entitiesById, entity.storyId);
  const epic =
    story?.type === 'story' ? uniqueWorkEntity(entitiesById, story.epicId) : undefined;
  return {
    ...entity,
    path,
    bodyFields,
    effectiveTags: effectiveTags(
      epic?.type === 'epic' ? epic.tags : [],
      story?.type === 'story' ? story.tags : [],
      entity.tags,
    ),
  };
}

function uniqueWorkEntity(entitiesById: ReadonlyMap<string, readonly IndexedEntity[]>, id: string): WorkEntity | undefined {
  const matches = entitiesById.get(id);
  const entity = matches?.length === 1 ? matches[0]?.entity : undefined;
  return entity?.type !== 'sprint' ? entity : undefined;
}

function collectIndexedEntitiesById(
  notesByPath: ReadonlyMap<string, CachedNote>,
): Map<string, IndexedEntity[]> {
  const entitiesById = new Map<string, IndexedEntity[]>();
  for (const note of notesByPath.values()) {
    if (note.indexedEntity === null) continue;
    const matches = entitiesById.get(note.indexedEntity.entity.id) ?? [];
    matches.push(note.indexedEntity);
    entitiesById.set(note.indexedEntity.entity.id, matches);
  }
  return entitiesById;
}

function canRefreshTagsIncrementally(
  previous: CachedNote | undefined,
  next: CachedNote | null,
): boolean {
  const previousEntity = previous?.indexedEntity?.entity;
  const nextEntity = next?.indexedEntity?.entity;
  if (previousEntity === undefined || nextEntity === undefined) return false;
  if (previousEntity.type === 'sprint' || nextEntity.type === 'sprint') {
    return false;
  }

  const { tags: _previousTags, ...previousStructure } = previousEntity;
  const { tags: _nextTags, ...nextStructure } = nextEntity;
  return JSON.stringify(previousStructure) === JSON.stringify(nextStructure);
}

function buildIncrementalTagSnapshot(
  notesByPath: ReadonlyMap<string, CachedNote>,
  previousSnapshot: WorkIndexSnapshot,
  changedPaths: readonly string[],
): WorkIndexSnapshot {
  const changedEntities = changedPaths
    .map((path) => notesByPath.get(path)?.indexedEntity)
    .filter((indexedEntity): indexedEntity is IndexedEntity => indexedEntity !== undefined && indexedEntity !== null);
  const affectedPaths = new Set(changedPaths);
  const changedEpicIds = new Set(
    changedEntities
      .filter(({ entity }) => entity.type === 'epic')
      .map(({ entity }) => entity.id),
  );
  const changedStoryIds = new Set(
    changedEntities
      .filter(({ entity }) => entity.type === 'story')
      .map(({ entity }) => entity.id),
  );

  for (const projectedEntity of previousSnapshot.entities) {
    if (projectedEntity.type === 'story' && changedEpicIds.has(projectedEntity.epicId)) {
      affectedPaths.add(projectedEntity.path);
      changedStoryIds.add(projectedEntity.id);
    }
    if (projectedEntity.type === 'task' && changedStoryIds.has(projectedEntity.storyId)) {
      affectedPaths.add(projectedEntity.path);
    }
  }

  const entitiesById = collectIndexedEntitiesById(notesByPath);
  const projectedByPath = new Map<string, ProjectedManagedEntity>();
  for (const path of affectedPaths) {
    const indexedEntity = notesByPath.get(path)?.indexedEntity;
    if (indexedEntity !== null && indexedEntity !== undefined) {
      projectedByPath.set(path, projectEffectiveTag(indexedEntity, entitiesById));
    }
  }

  return {
    phase: 'ready',
    entities: previousSnapshot.entities.map(
      (entity) => projectedByPath.get(entity.path) ?? entity,
    ),
    diagnostics: previousSnapshot.diagnostics,
  };
}

export class WorkIndex {
  private readonly listeners = new Set<() => void>();
  private readonly notesByPath = new Map<string, CachedNote>();
  private readonly batchSize: number;
  private readonly yieldToMain: () => Promise<void>;
  private readonly getWipPolicies: () => WipPolicies | undefined;
  private mission: { path: string; body: string | null } | undefined;
  private initialized = false;
  private snapshot: WorkIndexSnapshot = {
    phase: 'loading',
    entities: [],
    diagnostics: [],
  };

  constructor(
    private readonly repository: WorkNoteSourceRepository,
    options: WorkIndexOptions = {},
  ) {
    this.batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
    this.yieldToMain = options.yieldToMain ?? yieldToMain;
    this.getWipPolicies = options.getWipPolicies ?? (() => undefined);
  }

  readonly getSnapshot = (): WorkIndexSnapshot => this.snapshot;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  async refresh(): Promise<void> {
    try {
      const [sources, mission] = await Promise.all([
        this.repository.list(),
        this.repository.readMission(),
      ]);
      const notesByPath = await this.parseInBatches(sources);
      this.notesByPath.clear();
      for (const [path, note] of notesByPath) {
        this.notesByPath.set(path, note);
      }
      this.mission = mission;
      this.initialized = true;
      this.snapshot = buildCachedSnapshot(
        this.notesByPath,
        mission,
        this.getWipPolicies(),
      );
    } catch {
      this.markReadError();
    }

    this.notify();
  }

  async refreshPaths(paths: readonly string[]): Promise<void> {
    if (!this.initialized || this.repository.read === undefined) {
      await this.refresh();
      return;
    }
    const read = this.repository.read.bind(this.repository);

    try {
      const uniquePaths = [...new Set(paths)];
      const missionChanged = uniquePaths.includes(this.mission?.path ?? '');
      const notePaths = uniquePaths.filter(
        (path) => path !== this.mission?.path,
      );
      const refreshedNotes = await readRefreshedNotes(notePaths, read);
      const canRefreshTags = canUseIncrementalTags(missionChanged, refreshedNotes, this.notesByPath);
      applyRefreshedNotes(this.notesByPath, refreshedNotes);

      if (missionChanged) {
        this.mission = await this.repository.readMission();
      }
      this.snapshot = canRefreshTags
        ? buildIncrementalTagSnapshot(
            this.notesByPath,
            this.snapshot,
            notePaths,
          )
        : buildCachedSnapshot(
            this.notesByPath,
            this.mission,
            this.getWipPolicies(),
          );
    } catch {
      this.markReadError();
    }

    this.notify();
  }

  private async parseInBatches(
    sources: readonly WorkNoteSource[],
  ): Promise<Map<string, CachedNote>> {
    const notesByPath = new Map<string, CachedNote>();
    for (let index = 0; index < sources.length; index += 1) {
      const source = sources[index];
      if (source !== undefined) {
        notesByPath.set(source.path, parseSource(source));
      }
      if ((index + 1) % this.batchSize === 0 && index + 1 < sources.length) {
        await this.yieldToMain();
      }
    }
    return notesByPath;
  }

  private markReadError(): void {
    this.snapshot = {
      ...this.snapshot,
      phase: 'error',
      errorMessage: 'Focus Flow could not read managed notes.',
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

interface RefreshedNote { path: string; source: WorkNoteSource | null | undefined; note: CachedNote | null }

async function readRefreshedNotes(notePaths: readonly string[], read: (path: string) => Promise<WorkNoteSource | null>): Promise<RefreshedNote[]> {
  const sources = await Promise.all(notePaths.map((path) => read(path)));
  return notePaths.map((path, index) => {
    const source = sources[index];
    return { path, source, note: source === undefined || source === null ? null : parseSource(source) };
  });
}

function canUseIncrementalTags(missionChanged: boolean, refreshedNotes: readonly RefreshedNote[], notesByPath: ReadonlyMap<string, CachedNote>): boolean {
  if (missionChanged || refreshedNotes.length === 0) return false;
  return refreshedNotes.every(({ path, source, note }) => source !== undefined && source !== null && source.path === path && canRefreshTagsIncrementally(notesByPath.get(path), note));
}

function applyRefreshedNotes(notesByPath: Map<string, CachedNote>, refreshedNotes: readonly RefreshedNote[]): void {
  for (const { path, source, note } of refreshedNotes) {
    if (source === undefined) continue;
    if (source === null) notesByPath.delete(path);
    else if (note !== null) notesByPath.set(path, note);
  }
}

export function buildWorkIndexSnapshot(
  sources: readonly WorkNoteSource[],
  mission?: { path: string; body: string | null },
  policies?: WipPolicies,
): WorkIndexSnapshot {
  const notesByPath = new Map(
    sources.map((source) => [source.path, parseSource(source)]),
  );
  return buildCachedSnapshot(notesByPath, mission, policies);
}

function parseSource(source: WorkNoteSource): CachedNote {
  const result = parseManagedNote(source);
  return result.ok
    ? {
        indexedEntity: { entity: result.entity, path: source.path, ...(result.entity.type === 'sprint' ? {} : { bodyFields: readBodyFields(source.body, result.entity.type === 'candidate' || result.entity.type === 'task') }) },
        diagnostics: [],
      }
    : { indexedEntity: null, diagnostics: result.diagnostics };
}

function buildCachedSnapshot(
  notesByPath: ReadonlyMap<string, CachedNote>,
  mission?: { path: string; body: string | null },
  policies?: WipPolicies,
): WorkIndexSnapshot {
  const indexedEntities: IndexedEntity[] = [];
  const diagnostics: WorkNoteDiagnostic[] = [];

  const missionIsEmpty =
    mission !== undefined &&
    (mission.body === null || mission.body.trim() === '');
  if (missionIsEmpty) {
    diagnostics.push({
      code: 'missing-mission',
      message: 'Mission is missing or empty. Capture and triage remain available.',
      path: mission.path,
    });
  }

  for (const note of notesByPath.values()) {
    if (note.indexedEntity !== null) {
      indexedEntities.push(note.indexedEntity);
    } else {
      diagnostics.push(...note.diagnostics);
    }
  }

  // The repository supplies the canonical Mission path even when its body is missing.
  const rootFolder = mission?.path.split('/').slice(0, -1).join('/');
  const analysis = analyzeIndexedEntities(indexedEntities, rootFolder);
  diagnostics.push(...analysis.diagnostics);

  const snapshot: WorkIndexSnapshot = {
    phase: 'ready',
    entities: projectEffectiveTags(indexedEntities, analysis.entitiesById),
    diagnostics,
  };
  if (policies !== undefined) {
    diagnostics.push(...wipDiagnostics(snapshot, policies));
  }
  return snapshot;
}

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}
