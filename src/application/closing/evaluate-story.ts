import type { ProjectedManagedEntity, WorkIndex } from '../indexing/work-index';

type StoryOutcome = 'achieved' | 'not_achieved' | 'closed';

export interface StoryEvaluationRequest {
  storyId: string;
  outcome: StoryOutcome;
  evidence: string;
  acceptanceExceptionReason?: string;
}

export interface StoryEvaluationPlan {
  sprintId: string;
  sprintPath: string;
  storyId: string;
  evaluatedAt: string;
  outcome: StoryOutcome;
  evidence: string;
  acceptanceExceptionReason: string | null;
}

export interface StoryEvaluationWriter {
  apply(plan: StoryEvaluationPlan): Promise<void>;
}

export class StoryEvaluationService {
  private tail: Promise<void> = Promise.resolve();

  constructor(
    private readonly writer: StoryEvaluationWriter,
    private readonly index: Pick<WorkIndex, 'refresh' | 'getSnapshot'>,
    private readonly now: () => string,
  ) {}

  evaluate(request: StoryEvaluationRequest): Promise<void> {
    const operation = this.tail.then(() => this.evaluateNow(request));
    this.tail = operation.catch(() => undefined);
    return operation;
  }

  private async evaluateNow(request: StoryEvaluationRequest): Promise<void> {
    const evidence = request.evidence.trim();

    await this.index.refresh();
    const snapshot = this.index.getSnapshot();
    if (snapshot.phase !== 'ready') {
      throw new Error('Focus Flow index must be ready before evaluation.');
    }

    const sprint = uniqueActiveSprint(snapshot.entities);
    const story = activeSprintStory(snapshot.entities, request.storyId, sprint.id);

    const exception = request.acceptanceExceptionReason?.trim() || null;
    if (needsAcceptanceException(request.outcome, story, exception)) {
      throw new Error('Acceptance Criteria exception reason is required.');
    }

    await this.writer.apply({
      sprintId: sprint.id,
      sprintPath: sprint.path,
      storyId: story.id,
      evaluatedAt: this.now(),
      outcome: request.outcome,
      evidence,
      acceptanceExceptionReason:
        request.outcome === 'achieved' ? exception : null,
    });
    await this.index.refresh();
  }
}

function uniqueActiveSprint(entities: readonly ProjectedManagedEntity[]): Extract<ProjectedManagedEntity, { type: 'sprint'; lifecycle: 'active' }> {
  const matches = entities.filter((entity) => entity.type === 'sprint' && entity.lifecycle === 'active');
  if (matches.length !== 1) throw new Error('Exactly one Active Sprint is required.');
  return matches[0] as Extract<ProjectedManagedEntity, { type: 'sprint'; lifecycle: 'active' }>;
}

function activeSprintStory(entities: readonly ProjectedManagedEntity[], storyId: string, sprintId: string): Extract<ProjectedManagedEntity, { type: 'story' }> {
  const story = entities.find((entity) => entity.type === 'story' && entity.id === storyId);
  if (story?.type !== 'story' || story.lifecycle !== 'active_sprint' || story.sprintId !== sprintId) throw new Error('Story is not in the Active Sprint.');
  return story;
}

function needsAcceptanceException(outcome: StoryOutcome, story: Extract<ProjectedManagedEntity, { type: 'story' }>, exception: string | null): boolean {
  return outcome === 'achieved' && story.acceptanceCriteria.some((criterion) => !criterion.checked) && exception === null;
}
