import { TFile } from 'obsidian';
import { parse } from 'yaml';
import { describe, expect, it, vi } from 'vitest';
import { activeStory, epic, task, doneTask } from '../../test/storybook/fixtures';
import { editObsidianOutcome } from './ObsidianOutcomeEditor';

describe('Obsidian outcome editor', () => {
  it.each([task, doneTask])('edits a $lifecycle Task without changing parent, status, rank or timestamps', async (base) => {
    const note = { ...base, bodyFields: { Description: 'Original', 'Acceptance Criteria': 'Guidance stays.\n\n- [ ] Existing' } };
    const managed = { schema_version: 1, id: note.id, key: note.key, type: 'task', lifecycle: note.lifecycle, story_id: note.storyId, story_link: note.storyLink, task_rank: note.taskRank, status: note.status, started_at: note.startedAt, completed_at: note.completedAt, created_at: note.createdAt };
    let content = `---\naliases: [Keep me]\ntags: ${JSON.stringify(note.tags)}\nfocus_flow: ${JSON.stringify(managed)}\n---\n\n## Description\n\nOriginal\n\n## Acceptance Criteria\n\nGuidance stays.\n\n- [ ] Existing\n\n## Notes\n\nKeep [[My reference]].\n`;
    const file = Object.assign(new TFile(), { path: note.path });
    const vault = { getAbstractFileByPath: vi.fn((path: string) => path === note.path ? file : null), process: vi.fn(async (_file: TFile, update: (body: string) => string) => { content = update(content); return content; }) };
    const fileManager = { renameFile: vi.fn().mockResolvedValue(undefined) };
    const plan = { note, title: 'A clearer task', tags: ['ux'], bodyFields: { Description: '**Updated**' }, acceptanceCriteria: [{ text: 'Verified\n- On mobile', checked: true }] };
    await editObsidianOutcome(vault, fileManager, 'Focus Flow', plan);
    const saved = parse(content.split('---')[1]!) as { focus_flow: typeof managed; tags: string[] };
    expect(saved.focus_flow).toEqual(managed);
    expect(content).toContain('**Updated**');
    expect(content).toContain('Guidance stays.');
    expect(content).toContain('- [x] Verified\n  - On mobile');
    expect(content).toContain('Keep [[My reference]].');
    expect(saved.tags).toEqual(['ux']);
    expect(fileManager.renameFile).toHaveBeenCalledWith(file, `Focus Flow/Tasks/${note.lifecycle === 'done' ? 'Archive/2026/08/' : ''}${note.key} A clearer task.md`);
    const before = content;
    await expect(editObsidianOutcome(vault, fileManager, 'Focus Flow', plan)).rejects.toThrow('changed');
    expect(content).toBe(before);
  });
  const makeHost = (note: typeof activeStory | typeof epic) => {
    const criteria = note.acceptanceCriteria ?? [];
    let content = `---\n# Keep this comment\naliases: [Keep me]\ntags: ${JSON.stringify(note.tags)}\nfocus_flow:\n  schema_version: 1\n  id: ${note.id}\n  key: ${note.key}\n  type: ${note.type}\n  lifecycle: ${note.lifecycle}\n  created_at: ${note.createdAt}\n${note.type === 'story' ? `  epic_id: ${note.epicId}\n  epic_link: ${JSON.stringify(note.epicLink)}\n  sprint_id: ${note.sprintId}\n  sprint_rank: ${note.sprintRank}\n` : `  backlog_rank: ${note.backlogRank}\n`}---\n\n# Context\n\nKeep my **Markdown**.\n\n## Acceptance Criteria\n\nA user-authored explanation.\n${criteria.map((criterion) => `- [${criterion.checked ? 'x' : ' '}] ${criterion.text}`).join('\n')}\n\n## Notes\n\nKeep [[My reference]].\n`;
    const file = Object.assign(new TFile(), { path: note.path });
    const vault = { getAbstractFileByPath: vi.fn((path: string) => path === note.path ? file : null), process: vi.fn(async (_file: TFile, update: (body: string) => string) => { content = update(content); return content; }) };
    const fileManager = { renameFile: vi.fn().mockResolvedValue(undefined) };
    return { vault, fileManager, file, read: () => content, change: (value: string) => { content = value; } };
  };
  it.each([activeStory, epic])('edits $type criteria and own tags, preserving prose, metadata, identity and links', async (note) => {
    const host = makeHost(note);
    await editObsidianOutcome(host.vault, host.fileManager, 'Focus Flow', { note, title: 'A clearer result', tags: ['focus'], acceptanceCriteria: [{ text: 'An observable result\n- On narrow screens', checked: true }, { text: 'Another result', checked: false }] });
    expect(host.read()).toContain('# Keep this comment');
    expect(host.read()).toContain('Keep my **Markdown**.');
    expect(host.read()).toContain('A user-authored explanation.');
    expect(host.read()).toContain('- [x] An observable result\n  - On narrow screens\n- [ ] Another result');
    expect(host.read()).toContain('## Notes\n\nKeep [[My reference]].');
    const frontmatter = parse(host.read().split('---')[1]!) as { tags: string[]; focus_flow: { id: string; lifecycle: string } };
    expect(frontmatter.tags).toEqual(['focus']);
    expect(frontmatter.focus_flow.id).toBe(note.id);
    expect(frontmatter.focus_flow.lifecycle).toBe(note.lifecycle);
    expect(host.fileManager.renameFile).toHaveBeenCalledWith(host.file, `Focus Flow/${note.type === 'story' ? 'Stories' : 'Epics'}/${note.key} A clearer result.md`);
  });
  it('does not overwrite concurrently changed criteria or a colliding title', async () => {
    const host = makeHost(activeStory);
    host.change(host.read().replace(activeStory.acceptanceCriteria[0]!.text, 'External criterion'));
    const before = host.read();
    const plan = { note: activeStory, title: 'A clearer result', tags: [], acceptanceCriteria: [] };
    await expect(editObsidianOutcome(host.vault, host.fileManager, 'Focus Flow', plan)).rejects.toThrow();
    expect(host.read()).toBe(before);
    expect(host.fileManager.renameFile).not.toHaveBeenCalled();
    host.vault.process.mockClear();
    host.vault.getAbstractFileByPath.mockReturnValue(host.file);
    await expect(editObsidianOutcome(host.vault, host.fileManager, 'Focus Flow', plan)).rejects.toThrow();
    expect(host.vault.process).not.toHaveBeenCalled();
  });
  it.each([activeStory, epic])('updates the $type narrative without losing unrelated Markdown', async (note) => {
    const host = makeHost(note);
    const heading = note.type === 'epic' ? 'Intent' : 'Description';
    host.change(`${host.read()}\n## ${heading}\n\nOriginal narrative\n`);
    const plan = { note: { ...note, bodyFields: { [heading]: 'Original narrative' } }, title: note.title, tags: note.tags, acceptanceCriteria: note.acceptanceCriteria ?? [], bodyFields: { [heading]: '**Edited** narrative\n\n- Next step' } };
    await editObsidianOutcome(host.vault, host.fileManager, 'Focus Flow', plan);
    expect(host.read()).toContain(`## ${heading}\n\n**Edited** narrative\n\n- Next step`);
    expect(host.read()).toContain('## Notes\n\nKeep [[My reference]].');
    const before = host.read();
    await expect(editObsidianOutcome(host.vault, host.fileManager, 'Focus Flow', plan)).rejects.toThrow('changed');
    expect(host.read()).toBe(before);
  });
});
