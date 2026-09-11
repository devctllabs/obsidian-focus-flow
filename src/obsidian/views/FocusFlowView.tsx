import {
  ItemView,
  Platform,
  type ViewStateResult,
  type WorkspaceLeaf,
} from 'obsidian';
import { createRoot, type Root } from 'react-dom/client';
import type { WorkIndex } from '../../application/indexing/work-index';
import type { DiagnosticRepairService } from '../../application/repairs/repair-diagnostic';
import {
  type FocusFlowMode,
} from '../../features/shell/FocusFlowShell';
import { FocusFlowRoot } from './FocusFlowRoot';
import type { FocusFlowWorkflow } from './FocusFlowRoot';
import type { ObsidianNoteOpener } from '../services/ObsidianNoteOpener';
import { normalizeViewState, type FocusFlowViewState } from './view-state';
import type { WipPolicy } from '../../domain/wip-policy';
import type { SettingsController } from '../../features/settings/SettingsSurface';

export const FOCUS_FLOW_VIEW_TYPE = 'focus-flow';

export interface FocusFlowViewDependencies {
  index: WorkIndex;
  repairService: Pick<DiagnosticRepairService, 'execute'>;
  workflow: FocusFlowWorkflow;
  noteOpener: ObsidianNoteOpener;
  getPlanningConfiguration: () => { sprintScopePolicy: WipPolicy; today: string };
  ensureWorkspaceReady: () => Promise<boolean>;
  settingsController: SettingsController;
  openCapture: () => void;
}

export class FocusFlowView extends ItemView {
  private viewState: FocusFlowViewState = {
    mode: 'focus',
    inboxSection: 'candidates',
  };
  private root: Root | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly dependencies: FocusFlowViewDependencies,
  ) {
    super(leaf);
  }

  getViewType(): string {
    return FOCUS_FLOW_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'Focus Flow';
  }

  getIcon(): 'layout-dashboard' {
    return 'layout-dashboard';
  }

  getState(): Record<string, unknown> {
    return {
      mode: this.viewState.mode,
      inboxSection: this.viewState.inboxSection,
    };
  }

  async setState(state: unknown, result: ViewStateResult): Promise<void> {
    await super.setState(state, result);
    this.viewState = normalizeViewState(state);
    this.render();
  }

  protected async onOpen(): Promise<void> {
    if (!(await this.dependencies.ensureWorkspaceReady())) {
      this.contentEl.setText('Complete Focus Flow setup to open this view.');
      return;
    }
    this.root?.unmount();
    this.root = createRoot(this.contentEl);
    this.render();
  }

  protected async onClose(): Promise<void> {
    this.root?.unmount();
    this.root = null;
  }

  private readonly changeMode = (mode: FocusFlowMode): void => {
    void this.leaf.setViewState({
      type: FOCUS_FLOW_VIEW_TYPE,
      active: true,
      state: { ...this.viewState, mode },
    });
  };

  private readonly changeInboxSection = (inboxSection: FocusFlowViewState['inboxSection']): void => {
    void this.leaf.setViewState({
      type: FOCUS_FLOW_VIEW_TYPE,
      active: true,
      state: { mode: 'inbox', inboxSection },
    });
  };

  private render(): void {
    const planning = this.dependencies.getPlanningConfiguration();
    this.root?.render(
      <FocusFlowRoot
        index={this.dependencies.index}
        repairService={this.dependencies.repairService}
        mode={this.viewState.mode}
        inboxSection={this.viewState.inboxSection}
        onInboxSectionChange={this.changeInboxSection}
        onModeChange={this.changeMode}
        workflow={this.dependencies.workflow}
        noteOpener={this.dependencies.noteOpener}
        dragEnabled={Platform.isDesktop}
        sprintScopePolicy={planning.sprintScopePolicy}
        settingsController={this.dependencies.settingsController}
        onOpenCapture={this.dependencies.openCapture}
      />,
    );
  }
}
