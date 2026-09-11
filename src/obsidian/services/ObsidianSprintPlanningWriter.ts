import {
  normalizePath,
  TFile,
  type FileManager,
  type Vault,
} from 'obsidian';
import type {
  DraftReference,
  DraftStoryMutation,
  SprintPlanningPlan,
  SprintPlanningWriter,
  StartSnapshot,
} from '../../application/planning/plan-sprint';

type PlanningVault = Pick<
  Vault,
  'getAbstractFileByPath' | 'getMarkdownFiles' | 'createFolder' | 'create'
>;
type PlanningFileManager = Pick<
  FileManager,
  'processFrontMatter' | 'renameFile' | 'trashFile'
>;
type StartPlan = Extract<SprintPlanningPlan, { kind: 'start-sprint' }>;

export class ObsidianSprintPlanningWriter implements SprintPlanningWriter {
  constructor(
    private readonly vault: PlanningVault,
    private readonly fileManager: PlanningFileManager,
    private readonly getRootFolder: () => string,
  ) {}

  async apply(plan: SprintPlanningPlan): Promise<void> {
    switch (plan.kind) {
      case 'create-draft':
        await this.createDraft(plan.id);
        return;
      case 'select-draft-story':
        await this.assertDraft(plan.draft);
        await this.updateStory(plan.story.path, (managed) =>
          selectStory(managed, plan.draft.id, plan.story),
        );
        return;
      case 'remove-draft-story':
        await this.assertDraft(plan.draft);
        await this.updateStory(plan.story.path, (managed) =>
          removeStory(managed, plan.draft.id, plan.story),
        );
        return;
      case 'cancel-draft':
        await this.cancelDraft(plan);
        return;
      case 'start-sprint':
        await this.startSprint(plan);
    }
  }

  private async createDraft(id: string): Promise<void> {
    const folder = this.sprintFolder();
    await this.ensureFolder(folder);
    const path = normalizePath(`${folder}/DRAFT.md`);
    if (this.vault.getAbstractFileByPath(path) !== null) {
      throw new Error('A Focus Flow Draft Sprint already exists.');
    }
    await this.vault.create(path, serializeDraft(id));
  }

  private async cancelDraft(
    plan: Extract<SprintPlanningPlan, { kind: 'cancel-draft' }>,
  ): Promise<void> {
    const draft = await this.assertDraft(plan.draft);
    for (const story of plan.stories) {
      await this.updateStory(story.path, (managed) =>
        removeStory(managed, plan.draft.id, story),
      );
    }
    await this.fileManager.trashFile(draft);
  }

  private async startSprint(plan: StartPlan): Promise<void> {
    const source = this.vault.getAbstractFileByPath(
      normalizePath(plan.draft.path),
    );
    const destinationPath = normalizePath(
      `${this.sprintFolder()}/${plan.code}.md`,
    );
    const destination = this.vault.getAbstractFileByPath(destinationPath);
    if (source instanceof TFile && destination !== null) {
      throw new Error('Focus Flow Sprint destination already exists.');
    }

    const sprint = source instanceof TFile ? source : destination;
    if (!(sprint instanceof TFile)) {
      throw new Error('Focus Flow Draft Sprint was not found.');
    }

    await this.assertWindowUnused(plan, destinationPath);

    await this.fileManager.processFrontMatter(
      sprint,
      (frontmatter: Record<string, unknown>) => {
        const managed = managedRecord(frontmatter);
        if (source instanceof TFile) {
          assertDraftManaged(managed, plan.draft.id);
        } else if (!matchesStartedSprint(managed, plan)) {
          throw new Error('Focus Flow Sprint changed before start completed.');
        }
      },
    );

    for (const story of plan.stories) {
      await this.updateStory(story.path, (managed) =>
        activateStory(managed, plan.draft.id, story),
      );
    }

    if (source instanceof TFile) {
      await this.fileManager.processFrontMatter(
        source,
        (frontmatter: Record<string, unknown>) => {
          const managed = managedRecord(frontmatter);
          assertDraftManaged(managed, plan.draft.id);
          applyStartedSprint(managed, plan);
        },
      );
      await this.fileManager.renameFile(source, destinationPath);
    }
  }

  private async assertWindowUnused(
    plan: StartPlan,
    destinationPath: string,
  ): Promise<void> {
    const folderPrefix = `${this.sprintFolder()}/`;
    const otherSprints = this.vault
      .getMarkdownFiles()
      .filter(
        (file) =>
          file.path.startsWith(folderPrefix) && file.path !== destinationPath,
      );
    for (const file of otherSprints) {
      await this.fileManager.processFrontMatter(
        file,
        (frontmatter: Record<string, unknown>) => {
          const managed = frontmatter.focus_flow;
          if (
            isRecord(managed) &&
            managed.type === 'sprint' &&
            (managed.lifecycle === 'active' || managed.lifecycle === 'closed') &&
            managed.starts_on === plan.startsOn
          ) {
            throw new Error(`A Sprint already started for ${plan.startsOn}.`);
          }
        },
      );
    }
  }

  private async assertDraft(draft: DraftReference): Promise<TFile> {
    const file = this.vault.getAbstractFileByPath(normalizePath(draft.path));
    if (!(file instanceof TFile)) {
      throw new Error('Focus Flow Draft Sprint was not found.');
    }
    await this.fileManager.processFrontMatter(
      file,
      (frontmatter: Record<string, unknown>) => {
        assertDraftManaged(managedRecord(frontmatter), draft.id);
      },
    );
    return file;
  }

  private async updateStory(
    path: string,
    update: (managed: Record<string, unknown>) => void,
  ): Promise<void> {
    const file = this.vault.getAbstractFileByPath(normalizePath(path));
    if (!(file instanceof TFile)) {
      throw new Error('Focus Flow Story was not found.');
    }
    await this.fileManager.processFrontMatter(
      file,
      (frontmatter: Record<string, unknown>) => {
        update(managedRecord(frontmatter));
      },
    );
  }

  private sprintFolder(): string {
    return normalizePath(`${this.getRootFolder()}/Sprints`);
  }

  private async ensureFolder(path: string): Promise<void> {
    const segments = path.split('/');
    for (let length = 1; length <= segments.length; length += 1) {
      const current = segments.slice(0, length).join('/');
      if (this.vault.getAbstractFileByPath(current) === null) {
        await this.vault.createFolder(current);
      }
    }
  }
}

function selectStory(
  managed: Record<string, unknown>,
  draftId: string,
  story: Extract<
    SprintPlanningPlan,
    { kind: 'select-draft-story' }
  >['story'],
): void {
  assertStoryIdentity(managed, story.id);
  if (
    managed.lifecycle === 'draft_sprint' &&
    managed.backlog_rank === story.expectedBacklogRank &&
    managed.sprint_id === draftId &&
    managed.sprint_rank === story.sprintRank
  ) {
    return;
  }
  if (
    managed.lifecycle !== 'backlog' ||
    managed.backlog_rank !== story.expectedBacklogRank
  ) {
    throw new Error('Focus Flow Story changed before Sprint selection.');
  }
  managed.lifecycle = 'draft_sprint';
  managed.sprint_id = draftId;
  managed.sprint_rank = story.sprintRank;
}

function removeStory(
  managed: Record<string, unknown>,
  draftId: string,
  story: DraftStoryMutation,
): void {
  assertStoryIdentity(managed, story.id);
  if (storyAlreadyRemoved(managed, story)) return;
  if (!storyMatchesDraft(managed, draftId, story)) throw new Error('Focus Flow Story changed before Draft removal.');
  managed.lifecycle = 'backlog';
  managed.backlog_rank = story.targetBacklogRank ?? story.expectedBacklogRank;
  delete managed.sprint_id;
  delete managed.sprint_rank;
}

function storyAlreadyRemoved(managed: Record<string, unknown>, story: DraftStoryMutation): boolean {
  return managed.lifecycle === 'backlog' && managed.backlog_rank === (story.targetBacklogRank ?? story.expectedBacklogRank) && managed.sprint_id === undefined && managed.sprint_rank === undefined;
}

function storyMatchesDraft(managed: Record<string, unknown>, draftId: string, story: DraftStoryMutation): boolean {
  return managed.lifecycle === 'draft_sprint' && managed.backlog_rank === story.expectedBacklogRank && managed.sprint_id === draftId && managed.sprint_rank === story.expectedSprintRank;
}

function activateStory(
  managed: Record<string, unknown>,
  sprintId: string,
  story: StartPlan['stories'][number],
): void {
  assertStoryIdentity(managed, story.id);
  if (
    managed.lifecycle === 'active_sprint' &&
    managed.sprint_id === sprintId &&
    managed.sprint_rank === story.expectedSprintRank
  ) {
    return;
  }
  if (
    managed.lifecycle !== 'draft_sprint' ||
    managed.sprint_id !== sprintId ||
    managed.sprint_rank !== story.expectedSprintRank
  ) {
    throw new Error('Focus Flow Story changed before Sprint start.');
  }
  managed.lifecycle = 'active_sprint';
}

function assertStoryIdentity(
  managed: Record<string, unknown>,
  id: string,
): void {
  if (managed.id !== id || managed.type !== 'story') {
    throw new Error('Focus Flow Story changed before Sprint planning.');
  }
}

function assertDraftManaged(
  managed: Record<string, unknown>,
  id: string,
): void {
  if (
    managed.id !== id ||
    managed.type !== 'sprint' ||
    managed.lifecycle !== 'draft'
  ) {
    throw new Error('Focus Flow Draft Sprint changed before planning.');
  }
}

function applyStartedSprint(
  managed: Record<string, unknown>,
  plan: StartPlan,
): void {
  Object.assign(managed, {
    lifecycle: 'active',
    code: plan.code,
    sequence: plan.sequence,
    starts_on: plan.startsOn,
    due_on: plan.dueOn,
    started_at: plan.startedAt,
    closed_at: null,
    provisional_story_outcomes: [],
    start_snapshot: serializeStartSnapshot(plan.startSnapshot),
    close_snapshot: null,
    pending_close: null,
  });
}

function matchesStartedSprint(
  managed: Record<string, unknown>,
  plan: StartPlan,
): boolean {
  return (
    managed.id === plan.draft.id &&
    managed.type === 'sprint' &&
    managed.lifecycle === 'active' &&
    managed.code === plan.code &&
    managed.sequence === plan.sequence &&
    managed.starts_on === plan.startsOn &&
    managed.due_on === plan.dueOn &&
    managed.started_at === plan.startedAt &&
    JSON.stringify(managed.start_snapshot) ===
      JSON.stringify(serializeStartSnapshot(plan.startSnapshot))
  );
}

function serializeStartSnapshot(snapshot: StartSnapshot) {
  return {
    captured_at: snapshot.capturedAt,
    stories: snapshot.stories.map((story) => ({
      id: story.id,
      key: story.key,
      title: story.title,
      epic_id: story.epicId,
      sprint_rank: story.sprintRank,
      acceptance_criteria_hash: story.acceptanceCriteriaHash,
      acceptance_criteria: story.acceptanceCriteria,
      effective_tags: story.effectiveTags,
      tasks: story.tasks.map((task) => ({
        id: task.id,
        key: task.key,
        title: task.title,
        task_rank: task.taskRank,
        status: task.status,
        completed_before_sprint: task.completedBeforeSprint,
        effective_tags: task.effectiveTags,
      })),
    })),
  };
}

function managedRecord(
  frontmatter: Record<string, unknown>,
): Record<string, unknown> {
  const managed = frontmatter.focus_flow;
  if (!isRecord(managed)) {
    throw new Error('Focus Flow managed frontmatter is missing.');
  }
  return managed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function serializeDraft(id: string): string {
  return `---
focus_flow:
  schema_version: 1
  id: ${id}
  type: sprint
  lifecycle: draft
---

# Draft Sprint
`;
}
