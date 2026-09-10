import { PluginSettingTab } from 'obsidian';
import { createRoot, type Root } from 'react-dom/client';
import type FocusFlowPlugin from '../../main';
import { SettingsSurface } from '../../features/settings/SettingsSurface';
import { TagCatalogProvider } from '../../features/ui/TagCatalog';
import { AppearanceRoot } from '../../features/appearance/AppearanceRoot';

export class FocusFlowSettingTab extends PluginSettingTab {
  private root: Root | null = null;

  constructor(private readonly focusFlowPlugin: FocusFlowPlugin) {
    super(focusFlowPlugin.app, focusFlowPlugin);
  }

  display(): void {
    this.root?.unmount();
    this.containerEl.empty();
    const host = this.containerEl.createDiv();
    this.root = createRoot(host);
    void this.focusFlowPlugin.tagCatalog.refresh();
    this.root.render(<AppearanceRoot appearance={this.focusFlowPlugin.appearance} className="focus-flow focus-flow--settings-tab"><TagCatalogProvider service={this.focusFlowPlugin.tagCatalog}><SettingsSurface controller={{
      appearance: this.focusFlowPlugin.appearance,
      tagCatalog: this.focusFlowPlugin.tagCatalog,
      lifecycle: this.focusFlowPlugin.workspaceLifecycle,
      listTags: this.focusFlowPlugin.listTags,
      listCurrentTagUsage: this.focusFlowPlugin.listCurrentTagUsage,
      getSettings: () => this.focusFlowPlugin.settings,
      updateSettings: (update) => this.focusFlowPlugin.updateSettings(update),
      requestRootSetup: (root) => this.focusFlowPlugin.requestRootSetup(root),
      selectExistingRoot: (root) => this.focusFlowPlugin.selectExistingRoot(root),
      requestRootMove: (root, confirmed) => this.focusFlowPlugin.requestRootMove(root, confirmed),
      requestResumeRootMove: () => this.focusFlowPlugin.requestResumeRootMove(),
      hasPendingRootMove: () => this.focusFlowPlugin.hasPendingRootMove(),
      listFolders: () => this.focusFlowPlugin.app.vault.getAllFolders().map((folder) => folder.path),
          listTemplateFiles: () => this.app.vault.getMarkdownFiles().map((file) => file.path),
    }} /></TagCatalogProvider></AppearanceRoot>);
  }

  hide(): void {
    this.root?.unmount();
    this.root = null;
  }
}
