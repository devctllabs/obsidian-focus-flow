import {
  normalizePath,
  TFile,
  type FileManager,
  type Vault,
} from 'obsidian';
import type { SprintCloseWriter } from '../../application/closing/close-sprint';
import { serializePlan, serializeSnapshot } from '../../application/closing/serialize-close';
import {
  renderSprintReport,
  replaceManagedSprintReport,
  replaceRetrospectiveItems,
} from '../../application/closing/sprint-report';
import type {
  SprintClosePlan,
  StoryCloseMutation,
  TaskCloseMutation,
} from '../../domain/sprint-close';
import { compareOrdinal } from '../../domain/ordering';

type CloseVault = Pick<Vault, 'getAbstractFileByPath' | 'process'>;
type CloseFileManager = Pick<FileManager, 'processFrontMatter' | 'renameFile'>;

export class ObsidianSprintCloseWriter implements SprintCloseWriter {
  constructor(
    private readonly vault: CloseVault,
    private readonly fileManager: CloseFileManager,
    private readonly getRootFolder: () => string,
    private readonly getRetrospectiveTemplate: () => Promise<string>,
  ) {}

  async apply(plan: SprintClosePlan): Promise<void> {
    const sprint = this.file(plan.sprintPath, 'Sprint');
    this.preflight(plan);
    if (await this.writePending(sprint, plan)) return;

    const mutations = [
      ...plan.stories.map((mutation) => ({ kind: 'story' as const, mutation })),
      ...plan.tasks.map((mutation) => ({ kind: 'task' as const, mutation })),
    ].sort((left, right) => compareOrdinal(left.mutation.id, right.mutation.id));
    for (const item of mutations) {
      if (item.kind === 'story') await this.applyStory(item.mutation, plan);
      else await this.applyTask(item.mutation, plan);
    }

    const retrospective = await this.getRetrospectiveTemplate();
    const code = plan.sprintPath.split('/').at(-1)?.replace(/\.md$/, '') ?? 'Sprint';
    await this.vault.process(sprint, (body) =>
      replaceRetrospectiveItems(replaceManagedSprintReport(
        body,
        renderSprintReport(code, plan.closeSnapshot, plan.delta),
        retrospective,
      ), plan.retrospective),
    );
    await this.finalize(sprint, plan);
  }

  private preflight(plan: SprintClosePlan): void {
    for (const mutation of plan.stories) this.file(mutation.path, 'Story');
    for (const mutation of plan.tasks) {
      const source = this.vault.getAbstractFileByPath(normalizePath(mutation.path));
      if (mutation.resolution !== 'reclassify') {
        if (!(source instanceof TFile)) throw new Error('Task was not found.');
        continue;
      }
      const destination = this.promotedPath(mutation.path);
      const promoted = this.vault.getAbstractFileByPath(destination);
      if (!(source instanceof TFile) && !(promoted instanceof TFile)) {
        throw new Error('Task was not found.');
      }
      if (source instanceof TFile && promoted !== null) {
        throw new Error('Reclassified Story destination already exists.');
      }
    }
  }

  private async writePending(file: TFile, plan: SprintClosePlan) {
    let alreadyClosed = false;
    await this.fileManager.processFrontMatter(
      file,
      (frontmatter: Record<string, unknown>) => {
        const managed = managedRecord(frontmatter);
        if (managed.lifecycle === 'closed') {
          if (snapshotOperation(managed.close_snapshot) !== plan.operationId) {
            throw new Error('Sprint was closed by another operation.');
          }
          alreadyClosed = true;
          return;
        }
        assertSprint(managed, plan);
        const pending = managed.pending_close;
        if (pending !== null && pending !== undefined) {
          if (pendingOperation(pending) !== plan.operationId) {
            throw new Error('Another Sprint close is already pending.');
          }
          return;
        }
        managed.pending_close = serializePlan(plan);
      },
    );
    return alreadyClosed;
  }

  private async applyStory(
    mutation: StoryCloseMutation,
    plan: SprintClosePlan,
  ): Promise<void> {
    const file = this.file(mutation.path, 'Story');
    await this.fileManager.processFrontMatter(
      file,
      (frontmatter: Record<string, unknown>) => {
        const managed = managedRecord(frontmatter);
        if (storyAtDestination(managed, mutation)) return;
        if (
          managed.id !== mutation.id ||
          managed.type !== 'story' ||
          managed.lifecycle !== 'active_sprint' ||
          managed.sprint_id !== plan.sprintId ||
          managed.sprint_rank !== mutation.expectedSprintRank
        ) {
          throw new Error('Story changed after close review.');
        }
        delete managed.sprint_id;
        delete managed.sprint_rank;
        if (mutation.outcome === 'not_achieved') {
          managed.lifecycle = 'backlog';
          managed.backlog_rank = mutation.backlogRank;
          clearStoryTerminalFields(managed);
        } else if (mutation.outcome === 'achieved') {
          managed.lifecycle = 'done';
          managed.completed_at = plan.capturedAt;
          managed.outcome = 'achieved';
          managed.acceptance_exception_reason =
            mutation.acceptanceExceptionReason;
          delete managed.backlog_rank;
        } else {
          managed.lifecycle = 'closed';
          managed.closed_at = plan.capturedAt;
          managed.outcome = 'closed';
          managed.close_reason = mutation.evidence;
          delete managed.backlog_rank;
        }
      },
    );
  }

  private async applyTask(
    mutation: TaskCloseMutation,
    plan: SprintClosePlan,
  ): Promise<void> {
    if (mutation.resolution === 'reclassify') {
      await this.reclassifyTask(mutation);
      return;
    }
    const file = this.file(mutation.path, 'Task');
    await this.fileManager.processFrontMatter(
      file,
      (frontmatter: Record<string, unknown>) => {
        const managed = managedRecord(frontmatter);
        if (taskAtDestination(managed, mutation)) return;
        assertTask(managed, mutation);
        if (mutation.resolution === 'irrelevant') {
          managed.lifecycle = 'closed';
          managed.closed_at = plan.capturedAt;
          managed.resolution = 'irrelevant';
          return;
        }
        managed.lifecycle = 'active';
        managed.status = replacementTaskStatus(mutation.expectedStatus);
        managed.completed_at = null;
        managed.story_id = mutation.targetStoryId;
        managed.story_link = mutation.targetStoryLink;
        managed.task_rank = mutation.targetRank;
        managed.continuation_context = mutation.continuationContext;
        delete managed.closed_at;
        delete managed.resolution;
      },
    );
  }

  private async reclassifyTask(mutation: TaskCloseMutation): Promise<void> {
    const destination = this.promotedPath(mutation.path);
    const source = this.vault.getAbstractFileByPath(normalizePath(mutation.path));
    const promoted = this.vault.getAbstractFileByPath(destination);
    const file = source instanceof TFile ? source : promoted;
    if (!(file instanceof TFile)) throw new Error('Task was not found.');

    await this.fileManager.processFrontMatter(
      file,
      (frontmatter: Record<string, unknown>) => {
        const managed = managedRecord(frontmatter);
        if (reclassifiedAtDestination(managed, mutation)) return;
        assertTask(managed, mutation);
        managed.type = 'story';
        managed.lifecycle = 'backlog';
        managed.epic_id = mutation.targetEpicId;
        managed.epic_link = mutation.targetEpicLink;
        managed.backlog_rank = mutation.targetRank;
        for (const field of [
          'story_id',
          'story_link',
          'task_rank',
          'status',
          'started_at',
          'completed_at',
          'closed_at',
          'resolution',
          'continuation_context',
        ]) {
          delete managed[field];
        }
      },
    );
    if (source instanceof TFile) {
      await this.fileManager.renameFile(source, destination);
    }
  }

  private async finalize(file: TFile, plan: SprintClosePlan): Promise<void> {
    await this.fileManager.processFrontMatter(
      file,
      (frontmatter: Record<string, unknown>) => {
        const managed = managedRecord(frontmatter);
        if (
          managed.lifecycle === 'closed' &&
          snapshotOperation(managed.close_snapshot) === plan.operationId
        ) {
          return;
        }
        assertSprint(managed, plan);
        if (pendingOperation(managed.pending_close) !== plan.operationId) {
          throw new Error('Pending Sprint close changed before finalization.');
        }
        managed.lifecycle = 'closed';
        managed.closed_at = plan.capturedAt;
        managed.close_snapshot = serializeSnapshot(plan.closeSnapshot);
        delete managed.pending_close;
      },
    );
  }

  private promotedPath(path: string): string {
    const filename = path.split('/').at(-1);
    if (!filename) throw new Error('Task path is invalid.');
    return normalizePath(`${this.getRootFolder()}/Stories/${filename}`);
  }

  private file(path: string, label: string): TFile {
    const file = this.vault.getAbstractFileByPath(normalizePath(path));
    if (!(file instanceof TFile)) throw new Error(`${label} was not found.`);
    return file;
  }
}

function assertSprint(managed: Record<string, unknown>, plan: SprintClosePlan) {
  if (
    managed.id !== plan.sprintId ||
    managed.type !== 'sprint' ||
    managed.lifecycle !== 'active'
  ) {
    throw new Error('Active Sprint changed after close review.');
  }
}

function assertTask(managed: Record<string, unknown>, mutation: TaskCloseMutation) {
  if (
    managed.id !== mutation.id ||
    managed.type !== 'task' ||
    managed.lifecycle !== 'active' ||
    managed.story_id !== mutation.expectedStoryId ||
    managed.status !== mutation.expectedStatus
  ) {
    throw new Error('Task changed after close review.');
  }
}

function storyAtDestination(
  managed: Record<string, unknown>,
  mutation: StoryCloseMutation,
) {
  if (managed.id !== mutation.id || managed.type !== 'story') return false;
  if (mutation.outcome === 'not_achieved') {
    return managed.lifecycle === 'backlog' && managed.backlog_rank === mutation.backlogRank;
  }
  return managed.lifecycle === (mutation.outcome === 'achieved' ? 'done' : 'closed');
}

function taskAtDestination(
  managed: Record<string, unknown>,
  mutation: TaskCloseMutation,
) {
  if (managed.id !== mutation.id || managed.type !== 'task') return false;
  if (mutation.resolution === 'irrelevant') {
    return managed.lifecycle === 'closed' && managed.resolution === 'irrelevant';
  }
  return (
    managed.lifecycle === 'active' &&
    managed.status === replacementTaskStatus(mutation.expectedStatus) &&
    managed.story_id === mutation.targetStoryId &&
    managed.task_rank === mutation.targetRank
  );
}

function replacementTaskStatus(status: TaskCloseMutation['expectedStatus']) {
  return status === 'external_in_progress' || status === 'on_hold'
    ? status
    : 'todo';
}

function reclassifiedAtDestination(
  managed: Record<string, unknown>,
  mutation: TaskCloseMutation,
) {
  return (
    managed.id === mutation.id &&
    managed.type === 'story' &&
    managed.lifecycle === 'backlog' &&
    managed.epic_id === mutation.targetEpicId &&
    managed.backlog_rank === mutation.targetRank
  );
}

function clearStoryTerminalFields(managed: Record<string, unknown>) {
  for (const field of [
    'completed_at',
    'closed_at',
    'outcome',
    'acceptance_exception_reason',
    'close_reason',
  ]) {
    delete managed[field];
  }
}


function pendingOperation(value: unknown) {
  return isRecord(value) ? value.operation_id : undefined;
}

function snapshotOperation(value: unknown) {
  return isRecord(value) ? value.operation_id : undefined;
}

function managedRecord(frontmatter: Record<string, unknown>) {
  const managed = frontmatter.focus_flow;
  if (!isRecord(managed)) throw new Error('Managed Focus Flow data is missing.');
  return managed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
