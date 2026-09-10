import { normalizePath, Notice, TFile, type Vault } from 'obsidian';
import { findMarkdownHeadings } from '../../domain/markdown-sections';

export class ObsidianTextTemplateReader {
  constructor(
    private readonly vault: Pick<Vault, 'getAbstractFileByPath' | 'cachedRead'>,
    private readonly getPath: () => string,
    private readonly fallback: string,
    private readonly warn: (message: string) => void = (message) => {
      new Notice(message);
    },
  ) {}

  async read(): Promise<string> {
    const file = this.vault.getAbstractFileByPath(normalizePath(this.getPath()));
    if (file === null) return this.fallback;
    if (!(file instanceof TFile)) {
      return this.useFallback('must be a Markdown file');
    }
    const body = await this.vault.cachedRead(file);
    return hasOneOfEachRetrospectiveHeading(body)
      ? body
      : this.useFallback('must contain each category heading exactly once');
  }

  private useFallback(reason: string): string {
    this.warn(`Retrospective template ${reason}; using the built-in template.`);
    return this.fallback;
  }
}

const RETROSPECTIVE_HEADINGS = [
  'Wins',
  'Friction',
  'Improvements',
] as const;

function hasOneOfEachRetrospectiveHeading(body: string): boolean {
  const lines = body.split(/\r?\n/);
  return RETROSPECTIVE_HEADINGS.every(
    (title) => findMarkdownHeadings(lines, title).length === 1,
  );
}
