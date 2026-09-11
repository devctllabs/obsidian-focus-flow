import { TFile, type FileManager, type Vault } from 'obsidian';
import { describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';
import type {
  AcceptCandidateAsEpicPlan,
  AcceptCandidateAsStoryPlan,
  RejectCandidatePlan,
} from '../../application/work/triage-candidate';
import { ObsidianCandidateTriageWriter } from './ObsidianCandidateTriageWriter';

const sourcePath = 'Focus Flow/Inbox/FF-41 Explore weekly focus.md';
const candidateId = '019946e9-0ef0-7ca3-af0c-ec423d76efed';
const epicPlan: AcceptCandidateAsEpicPlan = {
  kind: 'accept-candidate-as-epic',
  path: sourcePath,
  id: candidateId,
  key: 'FF-41',
  title: 'Explore weekly focus',
  backlogRank: 'a1',
};

function fixture(frontmatter: Record<string, unknown>) {
  const source = Object.assign(new TFile(), { path: sourcePath });
  const files = new Map<string, TFile>([[sourcePath, source]]);
  const folders = new Set(['Focus Flow', 'Focus Flow/Inbox', 'Focus Flow/Epics']);
  const frontmatters = new Map([[sourcePath, frontmatter]]);
  const vault = {
    getAbstractFileByPath: vi.fn(
      (path: string) => files.get(path) ?? (folders.has(path) ? { path } : null),
    ),
    createFolder: vi.fn(async (path: string) => {
      folders.add(path);
      return { path };
    }),
  } as unknown as Pick<Vault, 'getAbstractFileByPath' | 'createFolder' | 'process'>;
  const fileManager = {
    processFrontMatter: vi.fn(
      async (
        file: TFile,
        update: (value: Record<string, unknown>) => void,
      ) => update(frontmatters.get(file.path)!),
    ),
    renameFile: vi.fn().mockResolvedValue(undefined),
  } as unknown as Pick<FileManager, 'processFrontMatter' | 'renameFile'>;
  return { source, vault, fileManager, frontmatters, files };
}

describe('ObsidianCandidateTriageWriter', () => {
  it('converts reviewed Epic fields atomically and keeps the Candidate’s original context', async () => {
    const source = Object.assign(new TFile(), { path: sourcePath });
    let content = `---\n# Keep comment\ntags: [idea]\nfocus_flow:\n  id: ${candidateId}\n  key: FF-41\n  type: candidate\n  lifecycle: inbox\n---\n\n## Description\n\nOriginal\n\n## Entry Review\n\nWANT\n\n## Notes\n\nKeep [[reference]]\n`;
    const vault = { getAbstractFileByPath: vi.fn((path: string) => path === sourcePath ? source : null), createFolder: vi.fn(), process: vi.fn(async (_file: TFile, update: (value: string) => string) => { content = update(content); return content; }) };
    const fileManager = { processFrontMatter: vi.fn(), renameFile: vi.fn() };
    const writer = new ObsidianCandidateTriageWriter(vault, fileManager, () => 'Focus Flow');
    const authoring = { title: epicPlan.title, tags: ['focus'], bodyFields: { Description: 'Original', Intent: '**Direction**', 'Entry Review': 'WANT' }, expected: { title: epicPlan.title, tags: ['idea'], bodyFields: { Description: 'Original', 'Entry Review': 'WANT' } } };
    await writer.apply({ ...epicPlan, authoring });
    const properties = parse(content.split('---')[1]!) as { tags: string[]; focus_flow: { type: string } };
    expect(properties.focus_flow.type).toBe('epic');
    expect(properties.tags).toEqual(['focus']);
    expect(content).toContain('## Intent\n\n**Direction**');
    expect(content).toContain('## Entry Review\n\nWANT');
    expect(content).toContain('Keep [[reference]]');
    expect(content).toContain('# Keep comment');
    expect(fileManager.processFrontMatter).not.toHaveBeenCalled();
  });
  it('reclassifies the same Candidate note as an Epic', async () => {
    const context = fixture({
      aliases: ['Weekly idea'],
      tags: ['idea'],
      focus_flow: {
        schema_version: 1,
        id: candidateId,
        key: 'FF-41',
        type: 'candidate',
        lifecycle: 'inbox',
        created_at: '2026-08-30T08:45:00+04:00',
        custom_managed_extension: 'preserve-me',
      },
    });
    const writer = new ObsidianCandidateTriageWriter(
      context.vault,
      context.fileManager,
      () => 'Focus Flow',
    );

    await expect(writer.apply(epicPlan)).resolves.toBe(
      'Focus Flow/Epics/FF-41 Explore weekly focus.md',
    );

    expect(context.frontmatters.get(sourcePath)).toEqual({
      aliases: ['Weekly idea'],
      tags: ['idea'],
      focus_flow: {
        schema_version: 1,
        id: candidateId,
        key: 'FF-41',
        type: 'epic',
        lifecycle: 'backlog',
        backlog_rank: 'a1',
        created_at: '2026-08-30T08:45:00+04:00',
        custom_managed_extension: 'preserve-me',
      },
    });
    expect(context.fileManager.renameFile).toHaveBeenCalledWith(
      context.source,
      'Focus Flow/Epics/FF-41 Explore weekly focus.md',
    );
  });

  it('reclassifies a Candidate as a Story with its canonical parent', async () => {
    const context = fixture({
      focus_flow: {
        id: candidateId,
        key: 'FF-41',
        type: 'candidate',
        lifecycle: 'inbox',
      },
    });
    const plan: AcceptCandidateAsStoryPlan = {
      kind: 'accept-candidate-as-story',
      path: sourcePath,
      id: candidateId,
      key: 'FF-41',
      title: 'Explore weekly focus',
      epicId: '019946c9-5f97-7196-8483-73469275ff90',
      epicLink: '[[Focus Flow/Epics/FF-40 Build a calmer system]]',
      backlogRank: 'a0',
    };
    const writer = new ObsidianCandidateTriageWriter(
      context.vault,
      context.fileManager,
      () => 'Focus Flow',
    );

    await writer.apply(plan);

    expect(context.frontmatters.get(sourcePath)).toMatchObject({
      focus_flow: {
        id: candidateId,
        key: 'FF-41',
        type: 'story',
        lifecycle: 'backlog',
        epic_id: plan.epicId,
        epic_link: plan.epicLink,
        backlog_rank: 'a0',
      },
    });
    expect(context.fileManager.renameFile).toHaveBeenCalledWith(
      context.source,
      'Focus Flow/Stories/FF-41 Explore weekly focus.md',
    );
  });

  it('rejects a Candidate while retaining user-owned fields', async () => {
    const context = fixture({
      tags: ['idea'],
      focus_flow: {
        id: candidateId,
        key: 'FF-41',
        type: 'candidate',
        lifecycle: 'inbox',
        custom_managed_extension: 'preserve-me',
      },
    });
    const plan: RejectCandidatePlan = {
      kind: 'reject-candidate',
      path: sourcePath,
      id: candidateId,
      key: 'FF-41',
      title: 'Explore weekly focus',
      rejectedAt: '2026-08-30T12:30:00.000Z',
      rejectionReason: 'Not aligned right now.',
    };
    const writer = new ObsidianCandidateTriageWriter(
      context.vault,
      context.fileManager,
      () => 'Focus Flow',
    );

    await writer.apply(plan);

    expect(context.frontmatters.get(sourcePath)).toEqual({
      tags: ['idea'],
      focus_flow: {
        id: candidateId,
        key: 'FF-41',
        type: 'candidate',
        lifecycle: 'rejected',
        rejected_at: plan.rejectedAt,
        rejection_reason: plan.rejectionReason,
        custom_managed_extension: 'preserve-me',
      },
    });
    expect(context.fileManager.renameFile).toHaveBeenCalledWith(
      context.source,
      'Focus Flow/Distractions/FF-41 Explore weekly focus.md',
    );
  });

  it('rejects stale Candidate data before moving the note', async () => {
    const context = fixture({
      focus_flow: {
        id: candidateId,
        key: 'FF-41',
        type: 'epic',
        lifecycle: 'backlog',
        backlog_rank: 'different',
      },
    });
    const writer = new ObsidianCandidateTriageWriter(
      context.vault,
      context.fileManager,
      () => 'Focus Flow',
    );

    await expect(writer.apply(epicPlan)).rejects.toThrow(
      'Focus Flow Candidate changed before triage.',
    );
    expect(context.fileManager.renameFile).not.toHaveBeenCalled();
  });

  it('rejects a destination collision before changing frontmatter', async () => {
    const context = fixture({
      focus_flow: {
        id: candidateId,
        key: 'FF-41',
        type: 'candidate',
        lifecycle: 'inbox',
      },
    });
    const destination = Object.assign(new TFile(), {
      path: 'Focus Flow/Epics/FF-41 Explore weekly focus.md',
    });
    context.files.set(destination.path, destination);
    const writer = new ObsidianCandidateTriageWriter(
      context.vault,
      context.fileManager,
      () => 'Focus Flow',
    );

    await expect(writer.apply(epicPlan)).rejects.toThrow(
      'Focus Flow triage destination already exists.',
    );
    expect(context.fileManager.processFrontMatter).not.toHaveBeenCalled();
  });

  it('resumes successfully when the same triage already reached its destination', async () => {
    const context = fixture({});
    const destinationPath =
      'Focus Flow/Epics/FF-41 Explore weekly focus.md';
    const destination = Object.assign(new TFile(), { path: destinationPath });
    context.files.delete(sourcePath);
    context.files.set(destinationPath, destination);
    context.frontmatters.set(destinationPath, {
      tags: ['preserved'],
      focus_flow: {
        id: candidateId,
        key: 'FF-41',
        type: 'epic',
        lifecycle: 'backlog',
        backlog_rank: 'a1',
      },
    });
    const writer = new ObsidianCandidateTriageWriter(
      context.vault,
      context.fileManager,
      () => 'Focus Flow',
    );

    await expect(writer.apply(epicPlan)).resolves.toBe(destinationPath);

    expect(context.fileManager.processFrontMatter).toHaveBeenCalledWith(
      destination,
      expect.any(Function),
    );
    expect(context.fileManager.renameFile).not.toHaveBeenCalled();
    expect(context.frontmatters.get(destinationPath)).toMatchObject({
      tags: ['preserved'],
      focus_flow: { id: candidateId, type: 'epic' },
    });
  });
});
