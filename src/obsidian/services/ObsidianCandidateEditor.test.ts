import { TFile } from 'obsidian';
import { describe, expect, it, vi } from 'vitest';
import { candidate } from '../../test/storybook/fixtures';
import { editObsidianCandidate } from './ObsidianCandidateEditor';

describe('Obsidian Candidate editor', () => {
  it('edits narrative fields atomically, preserving Entry Review and unrelated prose', async () => {
    const file = Object.assign(new TFile(), { path: candidate.path });
    let content = `---\n# Keep comment\ntags: ${JSON.stringify(candidate.tags)}\nfocus_flow:\n  id: ${candidate.id}\n  key: ${candidate.key}\n  type: candidate\n  lifecycle: inbox\n---\n\n## Description\n\nOriginal\n\n## Entry Review\n\nWANT\n\n## Notes\n\nKeep [[reference]]\n`;
    const vault = { getAbstractFileByPath: vi.fn(() => file), process: vi.fn(async (_file: TFile, update: (content: string) => string) => { content = update(content); return content; }) };
    const fileManager = { processFrontMatter: vi.fn(), renameFile: vi.fn() };
    const plan = { note: { ...candidate, bodyFields: { Description: 'Original', 'Entry Review': 'WANT' } }, title: candidate.title, tags: ['focus'], bodyFields: { Description: '**Updated**', 'Entry Review': 'WANT' } };
    await editObsidianCandidate(vault, fileManager, 'Focus Flow', plan);
    expect(content).toContain('## Description\n\n**Updated**');
    expect(content).toContain('## Entry Review\n\nWANT');
    expect(content).toContain('Keep [[reference]]');
    expect(content).toContain('# Keep comment');
    expect(fileManager.processFrontMatter).not.toHaveBeenCalled();
    await expect(editObsidianCandidate(vault, fileManager, 'Focus Flow', plan)).rejects.toThrow('changed');
  });
  it('changes only tags and uses host rename to preserve note identity and links', async () => {
    const file = Object.assign(new TFile(), { path: candidate.path });
    const vault = { getAbstractFileByPath: vi.fn((path: string) => path === candidate.path ? file : null), process: vi.fn() };
    const frontmatter = { aliases: ['Keep me'], tags: candidate.tags, focus_flow: { id: candidate.id, key: candidate.key, type: 'candidate', lifecycle: 'inbox', extension: 'keep' } };
    const fileManager = { processFrontMatter: vi.fn(async (_file: TFile, update: (value: Record<string, unknown>) => void) => update(frontmatter)), renameFile: vi.fn().mockResolvedValue(undefined) };
    await editObsidianCandidate(vault, fileManager, 'Focus Flow', { note: candidate, title: 'A clearer intention', tags: ['focus'] });
    expect(frontmatter).toEqual({ aliases: ['Keep me'], tags: ['focus'], focus_flow: { id: candidate.id, key: candidate.key, type: 'candidate', lifecycle: 'inbox', extension: 'keep' } });
    expect(fileManager.renameFile).toHaveBeenCalledWith(file, `Focus Flow/Inbox/${candidate.key} A clearer intention.md`);
  });
  it('does not overwrite an existing note at the new name', async () => {
    const file = Object.assign(new TFile(), { path: candidate.path });
    const vault = { getAbstractFileByPath: vi.fn(() => file), process: vi.fn() };
    const fileManager = { processFrontMatter: vi.fn(), renameFile: vi.fn() };
    await expect(editObsidianCandidate(vault, fileManager, 'Focus Flow', { note: candidate, title: 'Taken', tags: [] })).rejects.toThrow();
    expect(fileManager.processFrontMatter).not.toHaveBeenCalled();
    expect(fileManager.renameFile).not.toHaveBeenCalled();
  });
});
