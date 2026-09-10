import type { ManagedReplacement } from '../../domain/managed-replacement';

export interface ArchivePreview { entries: readonly ManagedReplacement[]; diagnostics: readonly string[]; resuming: boolean }
export interface ReopenPreview { path: string; code: string; resuming: boolean }
export interface WorkspaceLifecycle {
  previewArchive(): Promise<ArchivePreview>;
  organize(preview: ArchivePreview): Promise<void>;
  previewReopen(sprintId: string): Promise<ReopenPreview>;
  reopen(sprintId: string): Promise<void>;
}
