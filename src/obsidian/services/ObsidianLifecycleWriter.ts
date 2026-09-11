import { stringify } from 'yaml';
import { z } from 'zod';
import type { TaskMovementPlan } from '../../application/focus/focus-board';
import type { EpicFinalizationPlan } from '../../application/planning/finalize-epic';
import type { SprintClosePlan } from '../../domain/sprint-close';
import { applyReplacements, validateReplacements } from '../../application/workspace/apply-replacements';
import { planArchive } from '../../application/workspace/plan-archive';
import { sprintFolder, workFolder } from '../../domain/terminal-archive';
import type { WorkEntity } from '../../domain/work-note';
import { planCloseWork } from '../../application/workspace/plan-close-work';
import { serializePlan, serializeSnapshot } from '../../application/closing/serialize-close';
import { REPORT_START, REPORT_END, renderSprintReport, replaceManagedSprintReport, replaceRetrospectiveItems } from '../../application/closing/sprint-report';
import { managedEqual, isManagedRecord, replacementSchema, reopenRecoverySchema, type ManagedBlock, type ManagedReplacement } from '../../domain/managed-replacement';
import { ObsidianManagedStore } from './ObsidianManagedStore';

import type { ArchivePreview } from '../../application/workspace/workspace-lifecycle';
const entriesSchema = z.array(replacementSchema);
const CHANGED = 'Work changed after this Sprint closed, so it cannot be reopened safely.';

/** Durable boundary for terminal work, Close, Reopen and explicit archive organization. */
export class ObsidianLifecycleWriter {
  constructor(private readonly store: ObsidianManagedStore, private readonly nextId: () => string, private readonly retrospectiveTemplate: () => Promise<string>, private readonly resumeLegacyClose?: (plan: SprintClosePlan) => Promise<void>) {}
  private journalPath() { return `${this.store.root()}/WORKSPACE-OPERATIONS.md`; }

  async renameWork(path: string, destination: string) {
    const managed = await this.store.read(path);
    if (!managed || typeof managed.id !== 'string') throw new Error('The note changed before renaming. Refresh and retry.');
    const before = { path, managed };
    const changes = [{ id: managed.id, before, after: { path: destination, managed } }];
    await this.commitArchive(planArchive(this.store.root(), await this.store.list(), changes));
  }

  async assertNoPending(resumingSprintPath?: string) {
    const journal = await this.store.read(this.journalPath());
    if (journal?.pending) throw new Error('A workspace operation is pending. Open Settings → Terminal notes → Review… to resume it first.');
    for (const file of this.store.vault.getMarkdownFiles().filter((file) => file.path.startsWith(`${this.store.root()}/Sprints/`))) {
      if (file.path === resumingSprintPath) continue;
      const note = { managed: await this.store.read(file.path) };
      if (!note.managed) continue;
      if (note.managed.pending_close || note.managed.pending_reopen) throw new Error('A Sprint operation is pending. Resume it from Review or History first.');
    }
  }

  async moveTask(plan: TaskMovementPlan) {
    const before = await this.required(plan.path, plan.id);
    const managed = { ...before.managed };
    const fields = [
      ['lifecycle', plan.expectedLifecycle, plan.replacementLifecycle], ['status', plan.expectedStatus, plan.replacementStatus],
      ['task_rank', plan.expectedTaskRank, plan.replacementTaskRank], ['started_at', plan.expectedStartedAt, plan.replacementStartedAt],
      ['completed_at', plan.expectedCompletedAt, plan.replacementCompletedAt],
    ] as const;
    for (const [field, expected, replacement] of fields) {
      if (managed[field] !== expected) throw new Error('Task changed before the move.');
      managed[field] = replacement;
    }
    const entries = planArchive(this.store.root(), await this.store.list(), [{ id: plan.id, before, after: { path: before.path, managed } }]);
    await this.commitArchive(entries);
  }

  async finalizeEpic(plan: EpicFinalizationPlan) {
    const before = await this.required(plan.epic.path, plan.epic.id);
    const managed = { ...before.managed };
    if (managed.type !== 'epic' || managed.lifecycle !== 'backlog' || managed.backlog_rank !== plan.epic.expectedBacklogRank) throw new Error('Epic changed before finalization.');
    const notes = await this.store.list();
    const children = notes.filter((note) => note.managed.type === 'story' && note.managed.epic_id === plan.epic.id);
    if (children.length !== plan.children.length || children.some((child) => !plan.children.some((expected) => child.managed.id === expected.id && child.managed.lifecycle === expected.lifecycle))) throw new Error('Child Stories changed before Epic finalization.');
    delete managed.backlog_rank; delete managed.completed_at; delete managed.closed_at; delete managed.close_reason;
    if (plan.kind === 'complete-epic') { managed.lifecycle = 'done'; managed.completed_at = plan.finalizedAt; }
    else { managed.lifecycle = 'closed'; managed.closed_at = plan.finalizedAt; if (plan.closeReason) managed.close_reason = plan.closeReason; }
    await this.commitArchive(planArchive(this.store.root(), notes, [{ id: plan.epic.id, before, after: { path: before.path, managed } }]));
  }

  async previewArchive(): Promise<ArchivePreview> {
    const journal = await this.store.read(this.journalPath());
    if (journal?.pending) return { entries: entriesSchema.parse(journal.entries), diagnostics: [], resuming: true };
    try {
      return await this.buildArchivePreview();
    } catch (error) { return { entries: [], diagnostics: [error instanceof Error ? error.message : 'Could not inspect terminal notes.'], resuming: false }; }
  }

  private async buildArchivePreview(): Promise<ArchivePreview> {
    const { notes, diagnostics } = await this.store.scan();
    const changes: ManagedReplacement[] = [];
    for (const note of notes) {
      const result = terminalArchiveCandidate(note, this.store.root());
      if (result.change) changes.push(result.change);
      if (result.diagnostic) diagnostics.push(result.diagnostic);
    }
    const entries = planArchive(this.store.root(), notes, changes);
    diagnostics.push(...await this.archiveDestinationDiagnostics(entries));
    return { entries, diagnostics, resuming: false };
  }

  private async archiveDestinationDiagnostics(entries: readonly ManagedReplacement[]) {
    const diagnostics: string[] = [];
    for (const entry of entries) {
      try { await validateReplacements(this.store, [entry]); }
      catch (error) { diagnostics.push(error instanceof Error ? error.message : 'A destination is unavailable.'); }
    }
    return diagnostics;
  }
  async organize(preview: ArchivePreview) {
    if (preview.diagnostics.length) throw new Error('Resolve the archive preview diagnostics first.');
    if (preview.resuming) {
      const journal = await this.store.read(this.journalPath());
      if (!journal?.pending || !managedEqual(journal.entries, preview.entries)) throw new Error('The workspace operation changed. Open its preview again.');
      await this.finishArchive(journal);
    } else await this.commitArchive(preview.entries);
  }
  private async commitArchive(entries: readonly ManagedReplacement[]) {
    if (!entries.length) return;
    entriesSchema.parse(entries);
    await this.assertNoPending();
    await validateReplacements(this.store, entries);
    const journal = { schema_version: 1, type: 'workspace_operation', operation_id: this.nextId(), pending: true, entries };
    const existing = await this.store.read(this.journalPath());
    if (existing) await this.store.replace(this.journalPath(), existing, journal);
    else await this.store.vault.create(this.journalPath(), `---\n${stringify({ focus_flow: journal }, { aliasDuplicateObjects: false })}---\n`);
    await this.finishArchive(journal);
  }
  private async finishArchive(journal: ManagedBlock) {
    await applyReplacements(this.store, entriesSchema.parse(journal.entries));
    await this.store.replace(this.journalPath(), journal, { schema_version: 1, type: 'workspace_operation', pending: false });
  }

  async close(plan: SprintClosePlan) {
    const location = await this.resolveCloseLocation(plan);
    if (location.completed) return;
    const pending = await this.ensurePendingClose(plan, location);
    if (pending === null) return;
    await this.finalizeClose(plan, location, pending);
  }

  private async resolveCloseLocation(plan: SprintClosePlan): Promise<CloseLocation> {
    const sourcePath = plan.sprintPath;
    const destinationPath = `${this.store.root()}/${sprintFolder({ lifecycle: 'closed', closedAt: plan.capturedAt })}/${sourcePath.split('/').at(-1)!}`;
    const source = await this.store.read(sourcePath);
    const destination = await this.store.read(destinationPath);
    if (source && destination) throw new Error(`Destination already exists: ${destinationPath}. No file was overwritten.`);
    const completed = closeAlreadyCompleted(destination, plan);
    const sprintPath = source ? sourcePath : destination ? destinationPath : sourcePath;
    const current = source ?? destination;
    if (!current || current.id !== plan.sprintId) throw new Error(`Work changed at ${sprintPath}. Refresh and review it again.`);
    return { sourcePath, destinationPath, sprintPath, current, completed };
  }

  private async ensurePendingClose(plan: SprintClosePlan, location: CloseLocation): Promise<ManagedBlock | null> {
    const { current, sprintPath, sourcePath, destinationPath } = location;
    if (isManagedRecord(current.pending_close)) {
      await this.assertNoPending(sprintPath);
      const pending = current.pending_close;
      if (pending.operation_id !== plan.operationId) throw new Error('Another Sprint close is pending.');
      if (!pending.workspace_entries) {
        if (this.resumeLegacyClose) { await this.resumeLegacyClose(plan); return null; }
        throw new Error('This older pending Close has no workspace recovery plan. Resume it with the previous plugin version or restore a vault backup.');
      }
      return pending;
    }
    if (current.lifecycle !== 'active' || current.pending_reopen || sprintPath !== sourcePath) throw new Error('Active Sprint changed after close review.');
    await this.assertNoPending();
    const entries = planCloseWork(this.store.root(), await this.store.list(), plan);
    await validateReplacements(this.store, entries);
    const recovery = closeRecovery(plan, current, entries);
    const pending = { ...serializePlan(plan), workspace_entries: entries, reopen_recovery: recovery, expected_sprint: current, sprint_move: { source_path: sourcePath, destination_path: destinationPath } };
    await this.store.replace(sourcePath, current, { ...current, pending_close: pending });
    return pending;
  }

  private async finalizeClose(plan: SprintClosePlan, location: CloseLocation, pending: ManagedBlock) {
    const state = validatedCloseState(plan, location, pending);
    await this.assertCloseFinalizationState(location, state);
    await applyReplacements(this.store, state.entries);
    await this.finalizeCloseSource(plan, location, state);
    if (managedEqual(await this.store.read(location.sourcePath), state.expectedClosed)) await this.store.move(location.sourcePath, location.destinationPath, state.expectedClosed);
    await this.store.transform(location.destinationPath, (managed) => closeCompleted(managed, state.expectedClosed));
  }

  private async assertCloseFinalizationState(location: CloseLocation, state: CloseState) {
    const source = await this.store.read(location.sourcePath);
    const destination = await this.store.read(location.destinationPath);
    if (!managedEqual(source, state.expectedActive) && !managedEqual(source, state.expectedClosed) && !managedEqual(destination, state.expectedClosed)) throw new Error('Sprint changed before Close finalization. Review the pending Close before resuming.');
  }

  private async finalizeCloseSource(plan: SprintClosePlan, location: CloseLocation, state: CloseState) {
    const { expectedActive, expectedClosed, expectedSprint } = state;
    const beforeFinalize = await this.store.read(location.sourcePath);
    if (managedEqual(beforeFinalize, expectedActive)) {
      const template = await this.retrospectiveTemplate();
      await this.store.transform(location.sourcePath, (managed) => closeSprintTransition(managed, expectedActive, expectedClosed), (body) => replaceRetrospectiveItems(replaceManagedSprintReport(body, renderSprintReport(String(expectedSprint.code), plan.closeSnapshot, plan.delta), template), plan.retrospective));
      return;
    }
    const destination = await this.store.read(location.destinationPath);
    if (!managedEqual(beforeFinalize, expectedClosed) && !managedEqual(destination, expectedClosed)) throw new Error('Sprint changed before Close finalization. Review the pending Close before resuming.');
  }

  async previewReopen(sprintId: string): Promise<{ path: string; code: string; resuming: boolean }> {
    const notes = await this.store.list();
    const target = reopenTarget(notes, sprintId);
    assertReopenWorkspaceAvailable(notes, target);
    const resuming = Boolean(target.managed.pending_reopen);
    await this.assertNoPending(resuming ? target.path : undefined);
    const recovery = reopenRecoverySchema.safeParse(target.managed.reopen_recovery);
    if (!recovery.success) throw new Error('This Sprint was closed before reopen recovery was recorded.');
    if (!resuming) await this.assertReopenDestination(target);
    const entries = recovery.data.notes.map(reopenEntry);
    await this.validateReopenEntries(entries, resuming);
    return { path: target.path, code: String(target.managed.code), resuming };
  }

  private async assertReopenDestination(target: ManagedReplacement['before']) {
    const code = String(target.managed.code);
    const rootPath = `${this.store.root()}/Sprints/${code}.md`;
    const archivePath = `${this.store.root()}/${sprintFolder({ lifecycle: 'closed', closedAt: String(target.managed.closed_at) })}/${code}.md`;
    if (target.path !== archivePath) throw new Error('The Closed Sprint is not in its canonical archive folder. Review terminal notes before reopening it.');
    if (await this.store.read(rootPath)) throw new Error(`Destination already exists: ${rootPath}. No file was overwritten.`);
  }

  private async validateReopenEntries(entries: readonly ManagedReplacement[], resuming: boolean) {
    try { await validateReplacements(this.store, entries, resuming); }
    catch { throw new Error(CHANGED); }
  }
  async reopen(sprintId: string) {
    const preview = await this.previewReopen(sprintId);
    const target = await this.required(preview.path, sprintId);
    const recovery = reopenRecoverySchema.parse(target.managed.reopen_recovery);
    const entries = recovery.notes.map(reopenEntry);
    const pending = await this.ensurePendingReopen(target, entries);
    const { move, expectedSprint } = validatedPendingReopen(pending, entries);
    const pendingSprint = { ...expectedSprint, pending_reopen: pending };
    const source = await this.store.read(move.source_path);
    const destination = await this.store.read(move.destination_path);
    if (!managedEqual(source, pendingSprint) && !managedEqual(destination, pendingSprint)) throw new Error('Sprint changed during Reopen. Review its pending recovery plan.');
    await applyReplacements(this.store, entries);
    await this.restoreReopenedSprint(move, pendingSprint, recovery.provisional_story_outcomes);
  }

  private async ensurePendingReopen(target: ManagedReplacement['before'], entries: readonly ManagedReplacement[]): Promise<ManagedBlock> {
    if (isManagedRecord(target.managed.pending_reopen)) return target.managed.pending_reopen;
    const pending = { operation_id: this.nextId(), entries, expected_sprint: target.managed, sprint_move: { source_path: target.path, destination_path: `${this.store.root()}/Sprints/${String(target.managed.code)}.md` } };
    await this.store.replace(target.path, target.managed, { ...target.managed, pending_reopen: pending });
    return pending;
  }

  private async restoreReopenedSprint(move: { source_path: string; destination_path: string }, pendingSprint: ManagedBlock, provisionalOutcomes: unknown) {
    if (managedEqual(await this.store.read(move.source_path), pendingSprint)) {
      await this.store.transform(move.source_path, (managed) => assertPendingSprint(managed, pendingSprint), removeReport);
      await this.store.move(move.source_path, move.destination_path, pendingSprint);
    }
    await this.store.transform(move.destination_path, (managed) => activeSprintAfterReopen(managed, pendingSprint, provisionalOutcomes), removeReport);
  }
  private async required(path: string, id: string) {
    const managed = await this.store.read(path);
    if (!managed || managed.id !== id) throw new Error(`Work changed at ${path}. Refresh and review it again.`);
    return { path, managed };
  }
}

function removeReport(body: string): string {
  const start = body.indexOf(REPORT_START);
  const end = body.indexOf(REPORT_END);
  if (start < 0 && end < 0) return body;
  if (start < 0 || end < start) throw new Error('Sprint report markers are incomplete. Fix them before resuming Reopen.');
  return body.slice(0, start) + body.slice(end + REPORT_END.length);
}

function reopenEntry(entry: z.infer<typeof reopenRecoverySchema>['notes'][number]): ManagedReplacement {
  return { id: entry.id, before: { path: entry.expected_after_close.path, managed: entry.expected_after_close.focus_flow }, after: { path: entry.before_close.path, managed: entry.before_close.focus_flow } };
}

function terminalArchiveCandidate(note: ManagedReplacement['before'], root: string): { change?: ManagedReplacement; diagnostic?: string } {
  if (note.managed.type === 'sprint') return sprintArchiveCandidate(note, root);
  const workType = String(note.managed.type);
  const lifecycle = String(note.managed.lifecycle);
  if (!['epic', 'story', 'task'].includes(workType) || !['done', 'closed'].includes(lifecycle)) return {};
  try {
    workFolder({ type: workType as WorkEntity['type'], lifecycle: lifecycle as WorkEntity['lifecycle'], completedAt: note.managed.completed_at as string, closedAt: note.managed.closed_at as string });
    return { change: unchangedReplacement(note) };
  } catch (error) { return { diagnostic: archiveDiagnostic(note.path, error) }; }
}

function sprintArchiveCandidate(note: ManagedReplacement['before'], root: string): { change?: ManagedReplacement; diagnostic?: string } {
  const lifecycle = String(note.managed.lifecycle);
  if (lifecycle === 'closed') {
    try {
      sprintFolder({ lifecycle: 'closed', closedAt: note.managed.closed_at as string | null });
      return { change: unchangedReplacement(note) };
    } catch (error) { return { diagnostic: archiveDiagnostic(note.path, error) }; }
  }
  if (lifecycle !== 'draft' && lifecycle !== 'active') return {};
  const canonical = `${root}/Sprints/${note.path.split('/').at(-1)!}`;
  if (note.path === canonical) return {};
  return { diagnostic: `${note.path}: ${lifecycle === 'draft' ? 'Draft' : 'Active'} Sprint notes belong in Sprints. Move it to ${canonical}.` };
}

function unchangedReplacement(note: ManagedReplacement['before']): ManagedReplacement {
  return { id: String(note.managed.id), before: note, after: note };
}

function archiveDiagnostic(path: string, error: unknown) {
  return `${path}: ${error instanceof Error ? error.message : 'Invalid terminal timestamp.'}`;
}

function reopenTarget(notes: readonly ManagedReplacement['before'][], sprintId: string): ManagedReplacement['before'] {
  const sprints = notes.filter((note) => note.managed.type === 'sprint');
  const target = sprints.find((note) => note.managed.id === sprintId && note.managed.lifecycle === 'closed');
  const laterExists = target && sprints.some((note) => Number(note.managed.sequence) > Number(target.managed.sequence));
  if (!target || laterExists) throw new Error('Only the latest Closed Sprint can be reopened.');
  return target;
}

function assertReopenWorkspaceAvailable(notes: readonly ManagedReplacement['before'][], target: ManagedReplacement['before']) {
  const sprints = notes.filter((note) => note.managed.type === 'sprint');
  if (sprints.some((note) => note.managed.lifecycle === 'draft')) throw new Error(`Cancel the Draft before reopening ${String(target.managed.code)}.`);
  if (sprints.some((note) => note.managed.lifecycle === 'active')) throw new Error('Close the Active Sprint before reopening another Sprint.');
}

function validatedPendingReopen(pending: ManagedBlock, entries: readonly ManagedReplacement[]): { move: { source_path: string; destination_path: string }; expectedSprint: ManagedBlock } {
  const move = pending.sprint_move;
  const expectedSprint = pending.expected_sprint;
  const validMove = isManagedRecord(move) && typeof move.source_path === 'string' && typeof move.destination_path === 'string';
  if (!managedEqual(pending.entries, entries) || !validMove || !isManagedRecord(expectedSprint)) throw new Error('Pending Reopen data changed. Restore the recovery plan before resuming.');
  return { move: { source_path: move.source_path as string, destination_path: move.destination_path as string }, expectedSprint };
}

function assertPendingSprint(managed: ManagedBlock, expected: ManagedBlock) {
  if (!managedEqual(managed, expected)) throw new Error('Sprint changed during Reopen. Review its pending recovery plan.');
  return managed;
}

function activeSprintAfterReopen(managed: ManagedBlock, expected: ManagedBlock, provisionalOutcomes: unknown): ManagedBlock {
  assertPendingSprint(managed, expected);
  const next: ManagedBlock = { ...managed, lifecycle: 'active', provisional_story_outcomes: provisionalOutcomes };
  delete next.reopen_recovery;
  delete next.pending_reopen;
  delete next.closed_at;
  delete next.close_snapshot;
  return next;
}

interface CloseLocation {
  sourcePath: string;
  destinationPath: string;
  sprintPath: string;
  current: ManagedBlock;
  completed: boolean;
}

interface CloseState {
  entries: ManagedReplacement[];
  expectedSprint: ManagedBlock;
  expectedActive: ManagedBlock;
  expectedClosed: ManagedBlock;
}

function closeAlreadyCompleted(destination: ManagedBlock | null, plan: SprintClosePlan) {
  if (!destination || destination.id !== plan.sprintId || destination.lifecycle !== 'closed' || destination.pending_close) return false;
  return isManagedRecord(destination.close_snapshot) && destination.close_snapshot.operation_id === plan.operationId;
}

function closeRecovery(plan: SprintClosePlan, current: ManagedBlock, entries: readonly ManagedReplacement[]) {
  return {
    close_operation_id: plan.operationId,
    provisional_story_outcomes: current.provisional_story_outcomes,
    notes: entries.map((entry) => ({ id: entry.id, before_close: { path: entry.before.path, focus_flow: entry.before.managed }, expected_after_close: { path: entry.after.path, focus_flow: entry.after.managed } })),
  };
}

function validatedCloseState(plan: SprintClosePlan, location: CloseLocation, pending: ManagedBlock): CloseState {
  const move = pending.sprint_move;
  const expectedSprint = pending.expected_sprint;
  const validMove = isManagedRecord(move) && move.source_path === location.sourcePath && move.destination_path === location.destinationPath;
  if (!validMove || !isManagedRecord(expectedSprint)) throw new Error('Pending Close data changed. Restore the recovery plan before resuming.');
  const expectedActive = { ...expectedSprint, pending_close: pending };
  const expectedClosed: ManagedBlock = { ...expectedSprint, lifecycle: 'closed', closed_at: plan.capturedAt, close_snapshot: serializeSnapshot(plan.closeSnapshot), reopen_recovery: pending.reopen_recovery, pending_close: pending };
  return { entries: entriesSchema.parse(pending.workspace_entries), expectedSprint, expectedActive, expectedClosed };
}

function closeSprintTransition(managed: ManagedBlock, expectedActive: ManagedBlock, expectedClosed: ManagedBlock) {
  if (!managedEqual(managed, expectedActive)) throw new Error('Sprint changed before Close finalization. Review the pending Close before resuming.');
  return expectedClosed;
}

function closeCompleted(managed: ManagedBlock, expectedClosed: ManagedBlock) {
  if (!managedEqual(managed, expectedClosed)) throw new Error('Sprint changed before Close completion. Review the pending Close before resuming.');
  const next = { ...managed };
  delete next.pending_close;
  return next;
}
