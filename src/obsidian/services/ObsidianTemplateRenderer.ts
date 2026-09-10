import { normalizePath, TFile, type Vault } from 'obsidian';
import type {
  TemplateVariables,
  WorkTemplateRenderer,
} from '../../application/work/create-work';
import { renderWorkTemplate } from '../../application/work/render-template';
import { STANDARD_BODY_TEMPLATES } from '../../application/work/standard-templates';

export class ObsidianTemplateRenderer implements WorkTemplateRenderer {
  constructor(
    private readonly vault: Pick<
      Vault,
      'getAbstractFileByPath' | 'cachedRead'
    >,
    private readonly getTemplatePath: (kind: 'candidate' | 'task') => string,
  ) {}

  async render(
    kind: 'candidate' | 'task',
    variables: TemplateVariables,
  ): Promise<string> {
    const file = this.vault.getAbstractFileByPath(
      normalizePath(this.getTemplatePath(kind)),
    );
    const template =
      file instanceof TFile
        ? await this.vault.cachedRead(file)
        : STANDARD_BODY_TEMPLATES[kind];
    return renderWorkTemplate(template, variables);
  }
}
