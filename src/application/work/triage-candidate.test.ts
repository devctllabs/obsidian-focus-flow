import { describe, expect, it, vi } from 'vitest';
import type { WorkIndexSnapshot } from '../indexing/work-index';
import { CandidateTriageService } from './triage-candidate';

const candidateId = '019946e9-0ef0-7ca3-af0c-ec423d76efed';
const candidatePath = 'Focus Flow/Inbox/FF-41 Explore weekly focus.md';
const epicId = '019946c9-5f97-7196-8483-73469275ff90';

const candidate = {
  id: candidateId,
  key: 'FF-41',
  title: 'Explore weekly focus',
  type: 'candidate' as const,
  lifecycle: 'inbox' as const,
  createdAt: '2026-08-30T08:45:00+04:00',
  tags: ['idea'],
  effectiveTags: ['idea'],
  path: candidatePath,
};
const epic = {
  id: epicId,
  key: 'FF-40',
  title: 'Build a calmer system',
  type: 'epic' as const,
  lifecycle: 'backlog' as const,
  createdAt: '2026-08-30T08:30:00+04:00',
  tags: [],
  effectiveTags: [],
  path: 'Focus Flow/Epics/FF-40 Build a calmer system.md',
  backlogRank: 'a0',
};

function indexFor(entities: WorkIndexSnapshot['entities']) {
  return {
    refresh: vi.fn().mockResolvedValue(undefined),
    getSnapshot: vi.fn(
      (): WorkIndexSnapshot => ({
        phase: 'ready',
        entities,
        diagnostics: [],
      }),
    ),
  };
}

describe('CandidateTriageService', () => {
  it.each(['epic', 'story'] as const)('accepts reviewed %s fields and rejects stale Candidate text', async (target) => {
    const note = { ...candidate, bodyFields: { Description: 'Original' } };
    const writer = { apply: vi.fn().mockResolvedValue('accepted.md') };
    const service = new CandidateTriageService(writer, indexFor([epic, note]));
    const fields = { title: 'Clear outcome', tags: ['focus'], bodyFields: { Description: 'Original', Intent: 'A direction' }, expected: { title: note.title, tags: note.tags, bodyFields: note.bodyFields } };
    if (target === 'epic') await service.acceptAsEpic(note.id, fields);
    else await service.acceptAsStory(note.id, epic.id, fields);
    expect(writer.apply).toHaveBeenCalledWith(expect.objectContaining({ title: 'Clear outcome', authoring: fields }));
    fields.expected.bodyFields = { Description: 'Stale' };
    await expect(target === 'epic' ? service.acceptAsEpic(note.id, fields) : service.acceptAsStory(note.id, epic.id, fields)).rejects.toThrow('changed');
    expect(writer.apply).toHaveBeenCalledTimes(1);
  });
  it('accepts a Candidate as the last Epic without changing its identity', async () => {
    const writer = {
      apply: vi
        .fn()
        .mockResolvedValue('Focus Flow/Epics/FF-41 Explore weekly focus.md'),
    };
    const index = indexFor([epic, candidate]);
    const service = new CandidateTriageService(writer, index);

    await expect(
      service.acceptAsEpic(candidateId),
    ).resolves.toBe('Focus Flow/Epics/FF-41 Explore weekly focus.md');

    expect(writer.apply).toHaveBeenCalledWith({
      kind: 'accept-candidate-as-epic',
      path: candidatePath,
      id: candidateId,
      key: 'FF-41',
      title: 'Explore weekly focus',
      backlogRank: 'a1',
    });
    expect(index.refresh).toHaveBeenCalledTimes(2);
  });

  it('accepts a Candidate as a Story only under one active Epic', async () => {
    const writer = {
      apply: vi
        .fn()
        .mockResolvedValue('Focus Flow/Stories/FF-41 Explore weekly focus.md'),
    };
    const index = indexFor([candidate, epic]);
    const service = new CandidateTriageService(writer, index);

    await service.acceptAsStory(candidateId, epicId);

    expect(writer.apply).toHaveBeenCalledWith({
      kind: 'accept-candidate-as-story',
      path: candidatePath,
      id: candidateId,
      key: 'FF-41',
      title: 'Explore weekly focus',
      epicId,
      epicLink: '[[Focus Flow/Epics/FF-40 Build a calmer system]]',
      backlogRank: null,
    });
  });

  it('refuses to create an orphan Story', async () => {
    const writer = { apply: vi.fn() };
    const service = new CandidateTriageService(
      writer,
      indexFor([candidate]),
    );

    await expect(
      service.acceptAsStory(candidateId, epicId),
    ).rejects.toThrow('Parent Epic was not found.');
    expect(writer.apply).not.toHaveBeenCalled();
  });

  it('refuses to add a Story to a terminal Epic', async () => {
    const writer = { apply: vi.fn() };
    const terminalEpic = {
      ...epic,
      lifecycle: 'done' as const,
      backlogRank: null,
      completedAt: '2026-09-01T12:00:00Z',
      closedAt: null,
      closeReason: null,
    };
    const service = new CandidateTriageService(
      writer,
      indexFor([candidate, terminalEpic]),
    );

    await expect(
      service.acceptAsStory(candidateId, epicId),
    ).rejects.toThrow('Parent Epic was not found.');
    expect(writer.apply).not.toHaveBeenCalled();
  });

  it('rejects a Candidate without deleting its note or context', async () => {
    const writer = {
      apply: vi
        .fn()
        .mockResolvedValue(
          'Focus Flow/Distractions/FF-41 Explore weekly focus.md',
        ),
    };
    const index = indexFor([candidate]);
    const service = new CandidateTriageService(
      writer,
      index,
      () => '2026-08-30T12:30:00.000Z',
    );

    await service.reject(candidateId, '  Not aligned right now.  ');

    expect(writer.apply).toHaveBeenCalledWith({
      kind: 'reject-candidate',
      path: candidatePath,
      id: candidateId,
      key: 'FF-41',
      title: 'Explore weekly focus',
      rejectedAt: '2026-08-30T12:30:00.000Z',
      rejectionReason: 'Not aligned right now.',
    });
  });

  it('returns a rejected Candidate to the Inbox without changing its identity', async () => {
    const rejected = {
      ...candidate,
      lifecycle: 'rejected' as const,
      path: 'Focus Flow/Distractions/FF-41 Explore weekly focus.md',
      rejectedAt: '2026-08-30T12:30:00.000Z',
      rejectionReason: 'Not aligned right now.',
    };
    const writer = {
      apply: vi.fn().mockResolvedValue(candidatePath),
    };
    const index = indexFor([rejected]);
    const service = new CandidateTriageService(writer, index);

    await service.reconsider(candidateId);

    expect(writer.apply).toHaveBeenCalledWith({
      kind: 'reconsider-candidate',
      path: rejected.path,
      id: candidateId,
      key: 'FF-41',
      title: 'Explore weekly focus',
    });
    expect(index.refresh).toHaveBeenCalledTimes(2);
  });
});
