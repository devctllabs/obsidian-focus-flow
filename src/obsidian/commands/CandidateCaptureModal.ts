import { App, Modal } from 'obsidian';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { CandidateForm } from '../../features/inbox/CandidateForm';
import { TagCatalogProvider } from '../../features/ui/TagCatalog';
import type { TagCatalogService } from '../../application/tags/tag-catalog';

export class CandidateCaptureModal extends Modal {
  private root: Root | null = null;
  constructor(
    app: App,
    private readonly capture: import('../../features/inbox/CandidateForm').CandidateFormProps['onSave'],
    private readonly suggestions: readonly string[] = [],
    private readonly tagCatalog?: Pick<TagCatalogService, 'subscribe' | 'getSnapshot'>,
  ) {
    super(app);
  }

  onOpen(): void {
    this.setTitle('New candidate');
    this.contentEl.addClass('focus-flow');
    this.root = createRoot(this.contentEl);
    flushSync(() => this.root?.render(createElement(TagCatalogProvider, { service: this.tagCatalog, children: createElement(CandidateForm, { suggestions: this.suggestions, onSave: this.capture, onSaved: () => this.close() }) })));
    this.contentEl.querySelector<HTMLInputElement>('input')?.focus();
  }

  onClose(): void {
    this.root?.unmount();
    this.root = null;
    this.contentEl.empty();
  }
}
