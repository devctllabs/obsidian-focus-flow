import { normalizePath, TFile, type FileManager, type Vault } from 'obsidian';
import type {
  ActiveStoryMembershipPlan,
  ActiveStoryMembershipWriter,
} from '../../application/planning/active-story-membership';

type MembershipVault = Pick<Vault, 'getAbstractFileByPath'>;
type MembershipFileManager = Pick<FileManager, 'processFrontMatter'>;

export class ObsidianActiveStoryMembershipWriter
  implements ActiveStoryMembershipWriter
{
  constructor(
    private readonly vault: MembershipVault,
    private readonly fileManager: MembershipFileManager,
  ) {}

  async apply(plan: ActiveStoryMembershipPlan): Promise<void> {
    if (plan.kind === 'remove-active-story') {
      await this.clearProvisionalOutcome(plan.sprint, plan.story.id);
    }
    await this.updateManaged(plan.story.path, (managed) => {
      assertStoryIdentity(managed, plan.story.id);
      if (matchesEndState(managed, plan)) return;
      assertStoryExpectation(managed, plan.story);
      switch (plan.kind) {
        case 'add-active-story':
          managed.lifecycle = 'active_sprint';
          delete managed.backlog_rank;
          managed.sprint_id = plan.sprintId;
          managed.sprint_rank = plan.sprintRank;
          return;
        case 'remove-active-story':
          if (managed.sprint_rank !== plan.story.expectedSprintRank) {
            throw new Error('Focus Flow Story changed before removal.');
          }
          managed.lifecycle = 'backlog';
          managed.backlog_rank = plan.backlogRank;
          delete managed.sprint_id;
          delete managed.sprint_rank;
          return;
        case 'reparent-active-story':
          managed.epic_id = plan.epicId;
          managed.epic_link = plan.epicLink;
      }
    });
  }

  private async clearProvisionalOutcome(
    sprint: { id: string; path: string },
    storyId: string,
  ): Promise<void> {
    await this.updateManaged(sprint.path, (managed) => {
      if (
        managed.id !== sprint.id ||
        managed.type !== 'sprint' ||
        managed.lifecycle !== 'active' ||
        managed.pending_close != null
      ) {
        throw new Error('Focus Flow Sprint changed before Story removal.');
      }
      const outcomes = Array.isArray(managed.provisional_story_outcomes)
        ? managed.provisional_story_outcomes
        : [];
      managed.provisional_story_outcomes = outcomes.filter(
        (outcome) => !isOutcomeFor(outcome, storyId),
      );
    });
  }

  private async updateManaged(
    path: string,
    update: (managed: Record<string, unknown>) => void,
  ): Promise<void> {
    const file = this.vault.getAbstractFileByPath(normalizePath(path));
    if (!(file instanceof TFile)) throw new Error('Focus Flow note was not found.');
    await this.fileManager.processFrontMatter(
      file,
      (frontmatter: Record<string, unknown>) => update(managedRecord(frontmatter)),
    );
  }
}

function assertStoryIdentity(
  managed: Record<string, unknown>,
  id: string,
): void {
  if (managed.id !== id || managed.type !== 'story') {
    throw new Error('Focus Flow Story identity changed.');
  }
}

function assertStoryExpectation(
  managed: Record<string, unknown>,
  expected: ActiveStoryMembershipPlan['story'],
): void {
  if (
    managed.lifecycle !== expected.expectedLifecycle ||
    managed.epic_id !== expected.expectedEpicId ||
    (managed.backlog_rank ?? null) !== expected.expectedBacklogRank
  ) {
    throw new Error('Focus Flow Story changed before membership update.');
  }
}

function matchesEndState(
  managed: Record<string, unknown>,
  plan: ActiveStoryMembershipPlan,
): boolean {
  if (plan.kind === 'add-active-story') {
    return matchesAddedStory(managed, plan);
  }
  if (plan.kind === 'remove-active-story') {
    return matchesRemovedStory(managed, plan);
  }
  return managed.lifecycle === 'active_sprint' &&
    managed.epic_id === plan.epicId &&
    managed.epic_link === plan.epicLink;
}

function matchesAddedStory(managed: Record<string, unknown>, plan: Extract<ActiveStoryMembershipPlan, { kind: 'add-active-story' }>): boolean {
  return managed.lifecycle === 'active_sprint' && managed.sprint_id === plan.sprintId && managed.sprint_rank === plan.sprintRank && managed.backlog_rank === undefined;
}

function matchesRemovedStory(managed: Record<string, unknown>, plan: Extract<ActiveStoryMembershipPlan, { kind: 'remove-active-story' }>): boolean {
  return managed.lifecycle === 'backlog' && managed.backlog_rank === plan.backlogRank && managed.sprint_id === undefined && managed.sprint_rank === undefined;
}

function isOutcomeFor(value: unknown, storyId: string): boolean {
  return isRecord(value) && value.story_id === storyId;
}

function managedRecord(frontmatter: Record<string, unknown>) {
  const managed = frontmatter.focus_flow;
  if (!isRecord(managed)) throw new Error('Focus Flow managed frontmatter is missing.');
  return managed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
