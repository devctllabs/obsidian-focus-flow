import { parseSprintNote, type SprintEntity } from './sprint-note';
import {
  parseWorkNote,
  type WorkEntity,
  type WorkNoteDiagnostic,
  type WorkNoteSource,
} from './work-note';

export type ManagedEntity = WorkEntity | SprintEntity;

export type ParseManagedNoteResult =
  | { ok: true; entity: ManagedEntity }
  | { ok: false; diagnostics: WorkNoteDiagnostic[] };

export function parseManagedNote(
  source: WorkNoteSource,
): ParseManagedNoteResult {
  return managedType(source.frontmatter) === 'sprint'
    ? parseSprintNote(source)
    : parseWorkNote(source);
}

function managedType(frontmatter: unknown): unknown {
  if (!isRecord(frontmatter)) return undefined;
  const managed = frontmatter.focus_flow;
  return isRecord(managed) ? managed.type : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
