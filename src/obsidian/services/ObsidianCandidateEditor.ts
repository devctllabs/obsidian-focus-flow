import { TFile, normalizePath, type FileManager, type Vault } from 'obsidian';
import type { CandidateEditPlan } from '../../application/work/edit-candidate';
import { noteFilename } from '../../domain/note-filename';
import { parseDocument } from 'yaml';
import { readBodyFields, sameBodyFields, writeBodyFields } from '../../application/work/work-body-fields';

export async function editObsidianCandidate(vault: Pick<Vault, 'getAbstractFileByPath' | 'process'>, fileManager: Pick<FileManager, 'processFrontMatter' | 'renameFile'>, root: string, plan: CandidateEditPlan): Promise<void> {
  const path = normalizePath(plan.note.path);
  const folder = normalizePath(`${root}/${plan.note.lifecycle === 'inbox' ? 'Inbox' : 'Distractions'}`);
  if (!path.startsWith(`${folder}/`)) throw new Error('Candidate is outside the current workspace.');
  const destination = `${folder}/${noteFilename(plan.note.key, plan.title)}`;
  const file = vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) throw new Error('Candidate note no longer exists.');
  if (destination !== path && vault.getAbstractFileByPath(destination) !== null) throw new Error('A note already uses this title. Choose another title.');
  const updateProperties = (frontmatter: Record<string, unknown>) => updateCandidateProperties(frontmatter, plan);
  if (plan.bodyFields === undefined) await fileManager.processFrontMatter(file, updateProperties);
  else await vault.process(file, (content) => updateCandidateContent(content, { filePath: file.path, expectedPath: path, plan, updateProperties }));
  if (destination !== path) await fileManager.renameFile(file, destination);
}

function updateCandidateProperties(frontmatter: Record<string, unknown>, plan: CandidateEditPlan): void {
  const managed = frontmatter.focus_flow;
  if (!candidateIdentityMatches(managed, plan)) throw new Error('Candidate changed before editing. Reopen the editor.');
  const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [];
  if (!sameTags(tags, plan.note.tags)) throw new Error('Tags changed before editing. Reopen the editor.');
  frontmatter.tags = [...plan.tags];
}

function candidateIdentityMatches(managed: unknown, plan: CandidateEditPlan): boolean {
  if (typeof managed !== 'object' || managed === null) return false;
  const record = managed as Record<string, unknown>;
  return record.id === plan.note.id && record.key === plan.note.key && record.type === 'candidate' && record.lifecycle === plan.note.lifecycle;
}

function sameTags(tags: unknown[], expected: readonly string[]): boolean {
  return tags.length === expected.length && tags.every((tag) => expected.includes(String(tag).replace(/^#/, '')));
}

function updateCandidateContent(content: string, context: { filePath: string; expectedPath: string; plan: CandidateEditPlan; updateProperties: (frontmatter: Record<string, unknown>) => void }): string {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content);
  if (!match || context.filePath !== context.expectedPath) throw new Error('Candidate changed before editing. Reopen the editor.');
  const document = parseDocument(match[1]!);
  if (document.errors.length) throw new Error('Resolve the note’s properties before editing.');
  const body = content.slice(match[0].length);
  if (!sameBodyFields(readBodyFields(body), context.plan.note.bodyFields)) throw new Error('Candidate changed before editing. Reopen the editor.');
  context.updateProperties(document.toJS() as Record<string, unknown>);
  document.set('tags', [...context.plan.tags]);
  const eol = content.includes('\r\n') ? '\r\n' : '\n';
  return `---${eol}${document.toString().replace(/\r?\n/g, eol)}---${eol}${writeBodyFields(body, context.plan.bodyFields!)}`;
}
