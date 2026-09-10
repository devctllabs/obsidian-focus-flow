import {
  normalizePath,
  TFile,
  type FileManager,
  type Vault,
} from 'obsidian';
import type {
  StoryEvaluationPlan,
  StoryEvaluationWriter,
} from '../../application/closing/evaluate-story';

export class ObsidianStoryEvaluationWriter implements StoryEvaluationWriter {
  constructor(
    private readonly vault: Pick<Vault, 'getAbstractFileByPath'>,
    private readonly fileManager: Pick<FileManager, 'processFrontMatter'>,
  ) {}

  async apply(plan: StoryEvaluationPlan): Promise<void> {
    const file = this.vault.getAbstractFileByPath(
      normalizePath(plan.sprintPath),
    );
    if (!(file instanceof TFile)) throw new Error('Active Sprint was not found.');

    await this.fileManager.processFrontMatter(
      file,
      (frontmatter: Record<string, unknown>) => {
        const managed = managedRecord(frontmatter);
        if (
          managed.id !== plan.sprintId ||
          managed.type !== 'sprint' ||
          managed.lifecycle !== 'active'
        ) {
          throw new Error('Active Sprint changed before evaluation.');
        }
        if (managed.pending_close !== null && managed.pending_close !== undefined) {
          throw new Error('Sprint close is already pending.');
        }

        const outcomes: unknown[] = Array.isArray(
          managed.provisional_story_outcomes,
        )
          ? (managed.provisional_story_outcomes as unknown[])
          : [];
        managed.provisional_story_outcomes = [
          ...outcomes.filter(
            (outcome) =>
              !isRecord(outcome) || outcome.story_id !== plan.storyId,
          ),
          {
            story_id: plan.storyId,
            evaluated_at: plan.evaluatedAt,
            outcome: plan.outcome,
            evidence: plan.evidence,
            acceptance_exception_reason: plan.acceptanceExceptionReason,
          },
        ];
      },
    );
  }
}

function managedRecord(frontmatter: Record<string, unknown>) {
  const managed = frontmatter.focus_flow;
  if (!isRecord(managed)) throw new Error('Managed Focus Flow data is missing.');
  return managed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
