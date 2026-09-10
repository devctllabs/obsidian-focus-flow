import { describe, expect, it, vi } from 'vitest';
import type { WorkIndexSnapshot } from '../indexing/work-index';
import {
  EpicFinalizationService,
  type EpicFinalizationWriter,
} from './finalize-epic';

const epicId = '019946c9-5f97-7196-8483-73469275ff90';
const finalizedAt = '2026-09-01T12:00:00Z';

describe('EpicFinalizationService', () => {
  it('completes a ready Epic with terminal children and checked criteria', async () => {
    const { writer, apply } = writerDouble();
    const service = setup(snapshot(['done', 'closed'], true), writer);

    await service.complete(epicId);

    expect(apply).toHaveBeenCalledWith({
      kind: 'complete-epic',
      epic: {
        id: epicId,
        path: 'Focus Flow/Epics/FF-1 Epic.md',
        expectedBacklogRank: 'a0',
      },
      children: [
        expect.objectContaining({ lifecycle: 'done' }),
        expect.objectContaining({ lifecycle: 'closed' }),
      ],
      finalizedAt,
      closeReason: null,
    });
  });

  it.each([
    { label: 'no children', children: [] as const, checked: true },
    { label: 'unchecked criteria', children: ['done'] as const, checked: false },
    { label: 'an active child', children: ['backlog'] as const, checked: true },
  ])('rejects completion with $label', async ({ children, checked }) => {
    const { writer, apply } = writerDouble();
    const service = setup(snapshot([...children], checked), writer);

    await expect(service.complete(epicId)).rejects.toThrow();
    expect(apply).not.toHaveBeenCalled();
  });

  it.each([
    { supplied: '  Direction changed.  ', expected: 'Direction changed.' },
    { supplied: '   ', expected: null },
    { supplied: null, expected: null },
  ])('closes an empty Epic and preserves optional reason $expected', async ({
    supplied,
    expected,
  }) => {
    const { writer, apply } = writerDouble();
    const service = setup(snapshot([], false), writer);

    await service.close(epicId, supplied);

    expect(apply).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'close-epic',
      closeReason: expected,
    }));
  });
});

function writerDouble() {
  const apply = vi.fn().mockResolvedValue(undefined);
  return { writer: { apply } satisfies EpicFinalizationWriter, apply };
}

function setup(snapshot: WorkIndexSnapshot, writer: EpicFinalizationWriter) {
  return new EpicFinalizationService(
    writer,
    {
      refresh: vi.fn().mockResolvedValue(undefined),
      getSnapshot: vi.fn(() => snapshot),
    },
    () => finalizedAt,
  );
}

function snapshot(
  childStates: readonly ('backlog' | 'done' | 'closed')[],
  checked: boolean,
): WorkIndexSnapshot {
  return {
    phase: 'ready',
    diagnostics: [],
    entities: [
      {
        id: epicId,
        key: 'FF-1',
        title: 'Epic',
        type: 'epic',
        lifecycle: 'backlog',
        backlogRank: 'a0',
        acceptanceCriteria: [{ text: 'Direction achieved', checked }],
        createdAt: '2026-08-01T00:00:00Z',
        tags: [],
        effectiveTags: [],
        path: 'Focus Flow/Epics/FF-1 Epic.md',
      },
      ...childStates.map((lifecycle, index) => ({
        id: `story-${index}`,
        key: `FF-${index + 2}`,
        title: 'Story',
        type: 'story' as const,
        lifecycle,
        epicId,
        epicLink: '[[Epic]]',
        backlogRank: lifecycle === 'backlog' ? `a${index}` : null,
        sprintId: null,
        sprintRank: null,
        acceptanceCriteria: [],
        createdAt: '2026-08-01T00:00:00Z',
        tags: [],
        effectiveTags: [],
        path: `Focus Flow/Stories/FF-${index + 2} Story.md`,
      })),
    ],
  };
}
