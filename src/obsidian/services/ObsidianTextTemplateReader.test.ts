import { TFile, TFolder, type Vault } from 'obsidian';
import { describe, expect, it, vi } from 'vitest';
import { STANDARD_BODY_TEMPLATES } from '../../application/work/standard-templates';
import { ObsidianTextTemplateReader } from './ObsidianTextTemplateReader';

const path = 'Focus Flow/Templates/Retrospective.md';

describe('ObsidianTextTemplateReader', () => {
  it('returns a valid custom Retrospective fragment byte-for-byte', async () => {
    const body = `### Wins

Keep this prose.

### Friction

### Improvements
`;
    const warning = vi.fn();
    const reader = setup(body, warning);

    await expect(reader.read()).resolves.toBe(body);
    expect(warning).not.toHaveBeenCalled();
  });

  it('uses the built-in silently when the optional template file is missing', async () => {
    const warning = vi.fn();
    const reader = setup(null, warning);

    await expect(reader.read()).resolves.toBe(
      STANDARD_BODY_TEMPLATES.retrospective,
    );
    expect(warning).not.toHaveBeenCalled();
  });

  it.each([
    {
      label: 'folder at the configured path',
      body: '',
      folder: true,
    },
    {
      label: 'missing heading',
      body: '## Wins\n',
    },
    {
      label: 'legacy markers',
      body: `## Wins <!-- focus-flow:retro:wins -->

## Friction <!-- focus-flow:retro:friction -->

## Improvements <!-- focus-flow:retro:improvements -->
`,
    },
    {
      label: 'duplicate heading',
      body: `${STANDARD_BODY_TEMPLATES.retrospective}\n## Wins\n`,
    },
  ])('warns and uses the built-in for a $label', async ({ body, folder = false }) => {
    const warning = vi.fn();
    const reader = setup(body, warning, folder);

    await expect(reader.read()).resolves.toBe(
      STANDARD_BODY_TEMPLATES.retrospective,
    );
    expect(warning).toHaveBeenCalledOnce();
    expect(warning).toHaveBeenCalledWith(
      expect.stringContaining('Retrospective template'),
    );
  });
});

function setup(
  body: string | null,
  warning: (message: string) => void,
  folder = false,
) {
  const file = body === null
    ? null
    : folder
      ? Object.assign(new TFolder(), { path })
      : Object.assign(new TFile(), { path });
  const vault = {
    getAbstractFileByPath: vi.fn().mockReturnValue(file),
    cachedRead: vi.fn().mockResolvedValue(body),
  } as unknown as Pick<Vault, 'getAbstractFileByPath' | 'cachedRead'>;
  return new ObsidianTextTemplateReader(
    vault,
    () => path,
    STANDARD_BODY_TEMPLATES.retrospective,
    warning,
  );
}
