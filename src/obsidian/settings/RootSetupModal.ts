import { App, Modal, Setting } from 'obsidian';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { RootSetupSurface, type RootSetupController } from '../../features/settings/RootSetupSurface';

export function confirmRootSetup(
  app: App,
  controller: RootSetupController,
): Promise<boolean> {
  return new Promise((resolve) => {
    new RootSetupModal(app, controller, resolve).open();
  });
}

export function confirmRootMove(
  app: App,
  sourceRoot: string,
  targetRoot: string,
): Promise<boolean> {
  return new Promise((resolve) => {
    new ConfirmationModal(
      app,
      {
        title: 'Move Focus Flow root',
        message: `Move the complete root from ${sourceRoot} to ${targetRoot}. The target must not exist.`,
        action: 'Move root',
        resolve,
      },
    ).open();
  });
}

export function confirmResumeRootMove(
  app: App,
  sourceRoot: string,
  targetRoot: string,
): Promise<boolean> {
  return new Promise((resolve) => {
    new ConfirmationModal(
      app,
      {
        title: 'Resume Focus Flow root move',
        message: `Inspect and resume the pending move from ${sourceRoot} to ${targetRoot}.`,
        action: 'Resume move',
        resolve,
      },
    ).open();
  });
}

class RootSetupModal extends Modal {
  private settled = false;
  private root: Root | null = null;

  constructor(
    app: App,
    private readonly controller: RootSetupController,
    private readonly resolve: (accepted: boolean) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    this.setTitle('Set up Focus Flow');
    this.root = createRoot(this.contentEl);
    this.root.render(createElement(RootSetupSurface, { controller: this.controller, onDone: () => this.finish(true), onCancel: () => this.finish(false) }));
  }

  onClose(): void {
    this.root?.unmount();
    this.root = null;
    this.contentEl.empty();
    if (!this.settled) this.resolve(false);
  }

  private finish(accepted: boolean): void {
    this.settled = true;
    this.resolve(accepted);
    this.close();
  }
}

class ConfirmationModal extends Modal {
  private settled = false;

  constructor(
    app: App,
    private readonly confirmation: {
      title: string;
      message: string;
      action: string;
      resolve: (accepted: boolean) => void;
    },
  ) {
    super(app);
  }

  onOpen(): void {
    this.setTitle(this.confirmation.title);
    this.contentEl.createEl('p', { text: this.confirmation.message });
    new Setting(this.contentEl)
      .addButton((button) =>
        button.setButtonText('Cancel').onClick(() => this.finish(false)),
      )
      .addButton((button) => {
        button
          .setButtonText(this.confirmation.action)
          .setCta()
          .onClick(() => this.finish(true));
        button.buttonEl.addClass('mod-warning');
      });
  }

  onClose(): void {
    this.contentEl.empty();
    if (!this.settled) this.confirmation.resolve(false);
  }

  private finish(accepted: boolean): void {
    this.settled = true;
    this.confirmation.resolve(accepted);
    this.close();
  }
}
