import {
  Keymap,
  TFile,
  type Vault,
  type Workspace,
  type WorkspaceLeaf,
} from 'obsidian';

export class ObsidianNoteOpener {
  private previewLeaf: WorkspaceLeaf | null = null;

  constructor(
    private readonly workspace: Pick<
      Workspace,
      'getLeaf' | 'getLeavesOfType' | 'setActiveLeaf'
    >,
    private readonly vault: Pick<Vault, 'getAbstractFileByPath'>,
  ) {}

  async open(path: string, event?: MouseEvent): Promise<void> {
    const file = this.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) {
      throw new Error('Focus Flow note was not found.');
    }
    const existing = this.workspace
      .getLeavesOfType('markdown')
      .find((leaf) => notePath(leaf) === file.path);
    if (existing !== undefined) {
      this.workspace.setActiveLeaf(existing, { focus: true });
      return;
    }

    const explicitNewLeaf =
      event !== undefined &&
      (event.button === 1 || Keymap.isModEvent(event));
    const leaf = explicitNewLeaf
      ? this.workspace.getLeaf('tab')
      : this.reusablePreviewLeaf();
    await leaf.openFile(file, { active: true });
    if (!explicitNewLeaf) this.previewLeaf = leaf;
  }

  private reusablePreviewLeaf(): WorkspaceLeaf {
    if (
      this.previewLeaf !== null &&
      this.workspace.getLeavesOfType('markdown').includes(this.previewLeaf) &&
      this.previewLeaf.getViewState().pinned !== true
    ) {
      return this.previewLeaf;
    }
    return this.workspace.getLeaf('tab');
  }
}

function notePath(leaf: WorkspaceLeaf): string | null {
  const view = leaf.view as { file?: { path?: unknown } };
  return typeof view.file?.path === 'string' ? view.file.path : null;
}
