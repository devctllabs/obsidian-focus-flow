import { TFile, normalizePath, type Vault, type FileManager } from 'obsidian';
import type { MonthMembershipPlan } from '../../application/planning/month-backlog';
export async function setObsidianMonthMembership(vault: Pick<Vault, 'getAbstractFileByPath'>, fileManager: Pick<FileManager, 'processFrontMatter'>, root: string, plan: MonthMembershipPlan): Promise<void> {
  const path = normalizePath(plan.note.path);
  if (!path.startsWith(`${normalizePath(root)}/Stories/`)) throw new Error('Story is outside the current workspace.');
  const file = vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) throw new Error('Story no longer exists.');
  await fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => applyMonthMembership(frontmatter, file.path, path, plan));
}

function applyMonthMembership(frontmatter: Record<string, unknown>, filePath: string, expectedPath: string, plan: MonthMembershipPlan): void {
  const managed = frontmatter.focus_flow as Record<string, unknown> | undefined;
  assertMonthIdentity(managed, filePath, expectedPath, plan);
  const target = plan.selected ? 'backlog' : 'epic_backlog';
  if (managed.lifecycle === target && (managed.backlog_rank ?? null) === plan.backlogRank) return;
  assertPreviousMonthMembership(managed, plan);
  managed.lifecycle = target;
  if (plan.backlogRank === null) delete managed.backlog_rank;
  else managed.backlog_rank = plan.backlogRank;
}

function assertMonthIdentity(managed: Record<string, unknown> | undefined, filePath: string, expectedPath: string, plan: MonthMembershipPlan): asserts managed is Record<string, unknown> {
  if (!managed || filePath !== expectedPath) throw new Error('Story changed. Refresh before planning.');
  if (managed.id !== plan.note.id || managed.type !== 'story' || managed.epic_id !== plan.note.epicId) throw new Error('Story changed. Refresh before planning.');
}

function assertPreviousMonthMembership(managed: Record<string, unknown>, plan: MonthMembershipPlan): void {
  if (managed.lifecycle !== plan.note.lifecycle || (managed.backlog_rank ?? null) !== plan.note.backlogRank || managed.sprint_id != null || managed.sprint_rank != null) throw new Error('Story changed. Refresh before planning.');
}
