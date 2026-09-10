import { TFile, normalizePath, type FileManager, type Vault } from 'obsidian';
import { parseDocument } from 'yaml';
import { editableCriteria, editableNarrative, sameCriteria, type OutcomeEditPlan } from '../../application/work/edit-outcome';
import { noteFilename } from '../../domain/note-filename';
import { workFolder } from '../../domain/terminal-archive';
import { parseWorkNote, type AcceptanceCriterion } from '../../domain/work-note';
import { readAcceptanceCriteria, replaceAcceptanceCriteria as replaceCriteria } from '../../domain/acceptance-criteria';
import { readBodyFields, sameBodyFields, writeBodyFields } from '../../application/work/work-body-fields';

export async function editObsidianOutcome(vault: Pick<Vault, 'getAbstractFileByPath' | 'process'>, fileManager: Pick<FileManager, 'renameFile'>, root: string, plan: OutcomeEditPlan): Promise<void> {
  const path = normalizePath(plan.note.path);
  const folder = normalizePath(`${root}/${{ story: 'Stories', epic: 'Epics', task: 'Tasks' }[plan.note.type]}`);
  if (!path.startsWith(`${folder}/`)) throw new Error('This note is outside the current workspace.');
  const destination = `${normalizePath(root)}/${workFolder(plan.note)}/${noteFilename(plan.note.key, plan.title)}`;
  const file = vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) throw new Error('This note no longer exists.');
  if (destination !== path && vault.getAbstractFileByPath(destination) !== null) throw new Error('A note already uses this title. Choose another title.');
  await vault.process(file, (content) => updateOutcomeContent(content, { filePath: file.path, expectedPath: path, plan }));
  if (destination !== path) await fileManager.renameFile(file, destination);
}

function updateOutcomeContent(content: string, context: { filePath: string; expectedPath: string; plan: OutcomeEditPlan }): string {
  const { document, body, eol } = parseEditableDocument(content, context.filePath, context.expectedPath);
  assertNarrativeUnchanged(body, context.plan);
  const current = parseEditableOutcome(context.expectedPath, body, document.toJS());
  const currentCriteria = readAcceptanceCriteria(body);
  assertOutcomeUnchanged(current, currentCriteria, context.plan);
  document.set('tags', [...context.plan.tags]);
  const narrative = writeBodyFields(body, context.plan.bodyFields ?? {});
  const updatedBody = sameCriteria(currentCriteria, context.plan.acceptanceCriteria) ? narrative : replaceCriteria(narrative, context.plan.acceptanceCriteria);
  return `---${eol}${document.toString().replace(/\r?\n/g, eol)}---${eol}${updatedBody}`;
}

function parseEditableDocument(content: string, filePath: string, expectedPath: string) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content);
  if (!match || filePath !== expectedPath) throw new Error('This note changed before editing. Reopen the editor.');
  const document = parseDocument(match[1]!);
  if (document.errors.length > 0) throw new Error('The note’s properties need attention before editing.');
  return { document, body: content.slice(match[0].length), eol: content.includes('\r\n') ? '\r\n' : '\n' };
}

function assertNarrativeUnchanged(body: string, plan: OutcomeEditPlan): void {
  if (plan.bodyFields !== undefined && !sameBodyFields(readBodyFields(body, false), editableNarrative(plan.note))) throw new Error('This note changed before editing. Reopen the editor.');
}

function parseEditableOutcome(path: string, body: string, frontmatter: unknown) {
  const parsed = parseWorkNote({ path, body, frontmatter });
  if (!parsed.ok || !['story', 'epic', 'task'].includes(parsed.entity.type)) throw new Error('This note is no longer editable.');
  return parsed.entity as Extract<typeof parsed.entity, { type: 'story' | 'epic' | 'task' }>;
}

function assertOutcomeUnchanged(current: ReturnType<typeof parseEditableOutcome>, currentCriteria: readonly AcceptanceCriterion[], plan: OutcomeEditPlan): void {
  const sameIdentity = current.id === plan.note.id && current.type === plan.note.type && current.lifecycle === plan.note.lifecycle;
  const sameTagSet = current.tags.length === plan.note.tags.length && current.tags.every((tag) => plan.note.tags.includes(tag));
  if (!sameIdentity || !sameTagSet || !sameCriteria(currentCriteria, editableCriteria(plan.note))) throw new Error('This note changed before editing. Reopen the editor.');
}
