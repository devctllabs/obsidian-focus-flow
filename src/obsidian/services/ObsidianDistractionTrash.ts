import { TFile, normalizePath, type FileManager, type Vault } from 'obsidian';
import type { DistractionToTrash } from '../../application/work/delete-distraction';

export async function trashObsidianDistraction(vault: Pick<Vault, 'getAbstractFileByPath'>, fileManager: Pick<FileManager, 'processFrontMatter' | 'trashFile'>, root: string, note: DistractionToTrash): Promise<void> {
  const path = normalizePath(note.path);
  if (!path.startsWith(`${normalizePath(root)}/Distractions/`)) throw new Error('Distraction is outside the current workspace.');
  const file = vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) throw new Error('Distraction note no longer exists.');
  await fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => assertDistraction(frontmatter, note));
  await fileManager.trashFile(file);
}

function assertDistraction(frontmatter: Record<string, unknown>, note: DistractionToTrash): void {
  const managed = frontmatter.focus_flow;
  if (typeof managed !== 'object' || managed === null) throw new Error('Distraction changed before it could be moved to trash.');
  const record = managed as Record<string, unknown>;
  if (record.id !== note.id || record.key !== note.key || record.type !== 'candidate' || record.lifecycle !== 'rejected') throw new Error('Distraction changed before it could be moved to trash.');
}
