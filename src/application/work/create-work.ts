import type {
  ProjectedManagedEntity,
  WorkIndex,
} from '../indexing/work-index';
import { generateKeyBetween } from 'fractional-indexing';
import { compareRank } from '../../domain/ordering';
import { evaluateWip, type WipPolicy } from '../../domain/wip-policy';
import { activeSprintScope } from '../planning/sprint-scope';
import { writeBodyFields, type WorkBodyFields } from './work-body-fields';

export interface TemplateVariables {
  title: string;
  key: string;
  date: string;
  parentLink: string;
}

export interface WorkTemplateRenderer {
  render(
    kind: 'candidate' | 'task',
    variables: TemplateVariables,
  ): Promise<string>;
}

export interface CandidateCreationPlan {
  kind: 'candidate';
  id: string;
  key: string;
  title: string;
  createdAt: string;
  body: string;
  tags?: readonly string[];
}

export interface TaskCreationPlan {
  kind: 'task';
  id: string;
  key: string;
  title: string;
  createdAt: string;
  body: string;
  storyId: string;
  storyLink: string;
  taskRank: string;
  tags?: readonly string[];
}

export interface TaskCreationDetails { tags: readonly string[]; bodyFields: WorkBodyFields }

export interface WorkCreator {
  create(plan: CandidateCreationPlan | TaskCreationPlan): Promise<string>;
}

export type CreateTaskResult =
  | { kind: 'created'; path: string }
  | { kind: 'confirmation-required'; excess: number; message: string }
  | { kind: 'rejected'; message: string };

export interface WorkCreationDependencies {
  writer: WorkCreator;
  index: Pick<WorkIndex, 'refresh' | 'getSnapshot'>;
  templates: WorkTemplateRenderer;
  nextId: () => string;
  now: () => string;
  getScopePolicy?: () => WipPolicy;
  getLocalDate?: () => string;
}

export class WorkCreationService {
  private tail: Promise<void> = Promise.resolve();

  private readonly writer: WorkCreator;
  private readonly index: Pick<WorkIndex, 'refresh' | 'getSnapshot'>;
  private readonly templates: WorkTemplateRenderer;
  private readonly nextId: () => string;
  private readonly now: () => string;
  private readonly getScopePolicy: () => WipPolicy;
  private readonly getLocalDate?: () => string;

  constructor(dependencies: WorkCreationDependencies) {
    this.writer = dependencies.writer;
    this.index = dependencies.index;
    this.templates = dependencies.templates;
    this.nextId = dependencies.nextId;
    this.now = dependencies.now;
    this.getScopePolicy = dependencies.getScopePolicy ?? (() => ({ mode: 'off', limit: 1 }));
    this.getLocalDate = dependencies.getLocalDate;
  }

  captureCandidate(title: string, tags: readonly string[] = [], bodyFields: WorkBodyFields = {}): Promise<string> {
    return this.enqueue(() => this.captureCandidateNow(title, undefined, tags, bodyFields));
  }

  promoteImprovement(title: string, sprintCode: string): Promise<string> {
    return this.enqueue(() =>
      this.captureCandidateNow(title, sprintCode),
    );
  }

  createTask(
    storyId: string,
    title: string,
    confirmWipExcess = false,
    details?: TaskCreationDetails,
  ): Promise<CreateTaskResult> {
    return this.enqueue(() =>
      this.createTaskNow(storyId, title, confirmWipExcess, details),
    );
  }

  private async captureCandidateNow(
    input: string,
    sourceSprint?: string,
    tags: readonly string[] = [],
    bodyFields: WorkBodyFields = {},
  ): Promise<string> {
    const title = input.trim();
    if (title === '') throw new Error('Candidate title is required.');

    const snapshot = await this.refreshReadySnapshot();

    const key = nextKey(snapshot.entities);
    const createdAt = this.now();
    const template = await this.templates.render('candidate', {
      title,
      key,
      date: this.getLocalDate?.() ?? createdAt.slice(0, 10),
      parentLink: '',
    });
    const rendered = writeBodyFields(template, bodyFields);
    const body =
      sourceSprint === undefined
        ? rendered
        : `${rendered.trimEnd()}\n\nSource Sprint: [[${sourceSprint}]]\n`;
    const path = await this.writer.create({
      kind: 'candidate',
      id: this.nextId(),
      key,
      title,
      createdAt,
      body,
      ...(tags.length > 0 ? { tags: [...new Set(tags.map((tag) => tag.trim().replace(/^#+/, '')).filter(Boolean))] } : {}),
    });
    await this.index.refresh();
    return path;
  }

  private async createTaskNow(
    storyId: string,
    input: string,
    confirmWipExcess: boolean,
    details?: TaskCreationDetails,
  ): Promise<CreateTaskResult> {
    const title = input.trim();
    if (title === '') throw new Error('Task title is required.');

    const snapshot = await this.refreshReadySnapshot();
    const story = taskParentStory(snapshot.entities, storyId);
    const blocked = this.taskCreationBlock(snapshot, story, confirmWipExcess);
    if (blocked !== null) return blocked;
    const plan = await this.buildTaskPlan(snapshot.entities, story, title, details);
    const path = await this.writer.create(plan);
    await this.index.refresh();
    return { kind: 'created', path };
  }

  private taskCreationBlock(
    snapshot: Awaited<ReturnType<WorkCreationService['refreshReadySnapshot']>>,
    story: Extract<ProjectedManagedEntity, { type: 'story' }>,
    confirmWipExcess: boolean,
  ): Exclude<CreateTaskResult, { kind: 'created' }> | null {
    assertTaskableStory(story);
    if (story.lifecycle !== 'active_sprint') return null;
    const policy = this.getScopePolicy();
    const scope = activeSprintScope(snapshot, story.sprintId ?? undefined);
    if (scope === null) throw new Error('Active Sprint was not found.');
    const decision = evaluateWip(policy, scope.count + 1);
    if (decision.kind === 'reject') return { kind: 'rejected', message: `Sprint scope has a hard WIP limit of ${policy.limit}.` };
    if (decision.kind === 'confirm' && !confirmWipExcess) return { kind: 'confirmation-required', excess: decision.excess, message: `Sprint scope exceeds its WIP limit by ${decision.excess}.` };
    return null;
  }

  private async buildTaskPlan(
    entities: readonly ProjectedManagedEntity[],
    story: Extract<ProjectedManagedEntity, { type: 'story' }>,
    title: string,
    details?: TaskCreationDetails,
  ): Promise<TaskCreationPlan> {
    const tasks = entities
      .filter(
        (
          entity,
        ): entity is Extract<ProjectedManagedEntity, { type: 'task' }> =>
          entity.type === 'task' && entity.storyId === story.id,
      )
      .sort((left, right) =>
        compareRank(left.taskRank, right.taskRank, left.id, right.id),
      );
    const storyLink = `[[${story.path.replace(/\.md$/, '')}]]`;
    const key = nextKey(entities);
    const createdAt = this.now();
    const template = await this.templates.render('task', {
      title,
      key,
      date: this.getLocalDate?.() ?? createdAt.slice(0, 10),
      parentLink: storyLink,
    });
    const body = writeBodyFields(template, details?.bodyFields ?? {});
    return {
      kind: 'task',
      id: this.nextId(),
      key,
      title,
      createdAt,
      body,
      storyId: story.id,
      storyLink,
      taskRank: generateKeyBetween(tasks.at(-1)?.taskRank ?? null, null),
      ...(details?.tags.length ? { tags: [...new Set(details.tags.map((tag) => tag.trim().replace(/^#+/, '')).filter(Boolean))] } : {}),
    };
  }

  private async refreshReadySnapshot() {
    await this.index.refresh();
    const snapshot = this.index.getSnapshot();
    if (snapshot.phase !== 'ready') {
      throw new Error('Focus Flow index must be ready before creating work.');
    }
    return snapshot;
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.tail.then(operation);
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

function taskParentStory(
  entities: readonly ProjectedManagedEntity[],
  storyId: string,
): Extract<ProjectedManagedEntity, { type: 'story' }> {
  const matches = entities.filter((entity): entity is Extract<ProjectedManagedEntity, { type: 'story' }> => entity.type === 'story' && entity.id === storyId);
  if (matches.length !== 1) throw new Error('Parent Story was not found.');
  return matches[0]!;
}

function assertTaskableStory(story: Extract<ProjectedManagedEntity, { type: 'story' }>) {
  const taskable = story.lifecycle === 'backlog' || story.lifecycle === 'epic_backlog' || story.lifecycle === 'draft_sprint' || story.lifecycle === 'active_sprint';
  if (!taskable) throw new Error('Tasks can be created only for active Stories.');
}

function nextKey(entities: ReturnType<WorkIndex['getSnapshot']>['entities']) {
  const maximum = entities.reduce((current, entity) => {
    if (!('key' in entity)) return current;
    const sequence = BigInt(entity.key.slice(3));
    return sequence > current ? sequence : current;
  }, 0n);
  return `FF-${maximum + 1n}`;
}
