import { TFile, type Vault } from 'obsidian';
import { describe, expect, it, vi } from 'vitest';
import { ObsidianTemplateRenderer } from './ObsidianTemplateRenderer';

const variables = {
  title: 'Explore calm planning',
  key: 'FF-42',
  date: '2026-08-30',
  parentLink: '[[Focus Flow/Stories/FF-40 Parent]]',
};

describe('ObsidianTemplateRenderer', () => {
  it('renders the configured body template with deterministic substitutions', async () => {
    const template = Object.assign(new TFile(), {
      path: 'Templates/Candidate.md',
    });
    const vault = {
      getAbstractFileByPath: vi.fn().mockReturnValue(template),
      cachedRead: vi
        .fn()
        .mockResolvedValue(
          '## Description\n\n{{key}} · {{date}} · {{parent_link}} · {{sprint_code}} · {{ title }}',
        ),
    } as unknown as Pick<Vault, 'getAbstractFileByPath' | 'cachedRead'>;
    const renderer = new ObsidianTemplateRenderer(vault, (kind) =>
      kind === 'candidate' ? template.path : 'Templates/Task.md',
    );

    await expect(renderer.render('candidate', variables)).resolves.toBe(
      '## Description\n\nFF-42 · 2026-08-30 · [[Focus Flow/Stories/FF-40 Parent]] · {{sprint_code}} · {{ title }}',
    );
  });

  it('uses the built-in body when the configured template is absent', async () => {
    const vault = {
      getAbstractFileByPath: vi.fn().mockReturnValue(null),
      cachedRead: vi.fn(),
    } as unknown as Pick<Vault, 'getAbstractFileByPath' | 'cachedRead'>;
    const renderer = new ObsidianTemplateRenderer(vault, () => 'Missing.md');

    await expect(renderer.render('task', variables)).resolves.toBe(
      '## Description\n\n## Acceptance Criteria\n',
    );
    expect(vault.cachedRead).not.toHaveBeenCalled();
  });
});
