import { describe, expect, it, vi } from 'vitest';
import type {
  ProjectedManagedEntity,
  WorkIndexSnapshot,
} from '../indexing/work-index';
import {
  StoryEvaluationService,
  type StoryEvaluationPlan,
} from './evaluate-story';

const sprintId = '01994744-a401-759a-b582-4418f2f2405f';
const storyId = '019946f1-8d2a-7f05-87b1-1eebbb476300';

function entities(
  criteriaChecked: boolean,
): readonly ProjectedManagedEntity[] {
  return [
    {
      id: sprintId,
      type: 'sprint',
      lifecycle: 'active',
      code: 'SPR-014',
      sequence: 14,
      startsOn: '2026-08-24',
      dueOn: '2026-08-30',
      startedAt: '2026-08-24T08:30:00Z',
      closedAt: null,
      provisionalStoryOutcomes: [],
      startSnapshot: { capturedAt: '2026-08-24T08:30:00Z', stories: [] },
      closeSnapshot: null,
      path: 'Focus Flow/Sprints/SPR-014.md',
    },
    {
      id: storyId,
      key: 'FF-42',
      title: 'Use Focus on mobile',
      type: 'story',
      lifecycle: 'active_sprint',
      epicId: '019946c9-5f97-7196-8483-73469275ff90',
      epicLink: '[[Focus Flow/Epics/FF-40 Product]]',
      backlogRank: 'a0',
      sprintId,
      sprintRank: 'a0',
      acceptanceCriteria: [
        { text: 'The board opens on mobile', checked: criteriaChecked },
      ],
      createdAt: '2026-08-20T09:00:00Z',
      tags: [],
      effectiveTags: ['product/focus-flow'],
      path: 'Focus Flow/Stories/FF-42 Use Focus on mobile.md',
    },
    {
      id: '01994706-857c-76f1-8006-85cd9bd80890',
      key: 'FF-43',
      title: 'Verify mobile',
      type: 'task',
      lifecycle: 'done',
      storyId,
      storyLink: '[[Focus Flow/Stories/FF-42 Use Focus on mobile]]',
      taskRank: 'a0',
      status: 'done',
      startedAt: '2026-08-25T09:00:00Z',
      completedAt: '2026-08-29T17:00:00Z',
      createdAt: '2026-08-20T09:00:00Z',
      tags: [],
      effectiveTags: ['product/focus-flow'],
      path: 'Focus Flow/Tasks/FF-43 Verify mobile.md',
    },
  ];
}

function setup(criteriaChecked: boolean) {
  const snapshot: WorkIndexSnapshot = {
    phase: 'ready',
    diagnostics: [],
    entities: entities(criteriaChecked),
  };
  const writer = {
    apply: vi.fn<(plan: StoryEvaluationPlan) => Promise<void>>(),
  };
  const index = {
    refresh: vi.fn().mockResolvedValue(undefined),
    getSnapshot: vi.fn(() => snapshot),
  };
  return {
    service: new StoryEvaluationService(writer, index, () =>
      '2026-08-30T18:00:00Z',
    ),
    writer,
    index,
  };
}

describe('StoryEvaluationService', () => {
  it('records Achieved separately without completing a ready Story', async () => {
    const { service, writer, index } = setup(true);

    await service.evaluate({
      storyId,
      outcome: 'achieved',
      evidence: 'Verified in the mobile app.',
    });

    expect(writer.apply).toHaveBeenCalledWith({
      sprintId,
      sprintPath: 'Focus Flow/Sprints/SPR-014.md',
      evaluatedAt: '2026-08-30T18:00:00Z',
      storyId,
      outcome: 'achieved',
      evidence: 'Verified in the mobile app.',
      acceptanceExceptionReason: null,
    });
    expect(index.refresh).toHaveBeenCalledTimes(2);
    expect(index.getSnapshot().entities[1]).toMatchObject({
      lifecycle: 'active_sprint',
    });
  });

  it('requires an explicit exception for unchecked Acceptance Criteria', async () => {
    const { service, writer } = setup(false);

    await expect(
      service.evaluate({
        storyId,
        outcome: 'achieved',
        evidence: 'The main path works.',
      }),
    ).rejects.toThrow('Acceptance Criteria exception reason is required.');
    expect(writer.apply).not.toHaveBeenCalled();

    await service.evaluate({
      storyId,
      outcome: 'achieved',
      evidence: 'The main path works.',
      acceptanceExceptionReason: 'Landscape mode is deferred.',
    });
    expect(writer.apply).toHaveBeenCalledWith(
      expect.objectContaining({
        acceptanceExceptionReason: 'Landscape mode is deferred.',
      }),
    );
  });

  it('records an outcome without an optional reflection', async () => {
    const { service, writer } = setup(true);
    await service.evaluate({ storyId, outcome: 'closed', evidence: '  ' });
    expect(writer.apply).toHaveBeenCalledWith(expect.objectContaining({ evidence: '', outcome: 'closed' }));
  });

  it('refuses a Story outside the Active Sprint', async () => {
    const { service, writer } = setup(true);

    await expect(
      service.evaluate({
        storyId: '019946f1-8d2a-7f05-87b1-1eebbb476301',
        outcome: 'not_achieved',
        evidence: 'Not verified.',
      }),
    ).rejects.toThrow('Story is not in the Active Sprint.');
    expect(writer.apply).not.toHaveBeenCalled();
  });
});
