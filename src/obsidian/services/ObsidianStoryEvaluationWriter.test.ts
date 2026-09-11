import { TFile, type FileManager, type Vault } from 'obsidian';
import { describe, expect, it, vi } from 'vitest';
import type { StoryEvaluationPlan } from '../../application/closing/evaluate-story';
import { ObsidianStoryEvaluationWriter } from './ObsidianStoryEvaluationWriter';

const sprintId = '01994744-a401-759a-b582-4418f2f2405f';
const storyId = '019946f1-8d2a-7f05-87b1-1eebbb476300';
const path = 'Focus Flow/Sprints/SPR-014.md';

function setup() {
  const file = Object.assign(new TFile(), { path });
  const frontmatter: Record<string, unknown> = {
    focus_flow: {
      id: sprintId,
      type: 'sprint',
      lifecycle: 'active',
      pending_close: null,
      provisional_story_outcomes: [
        {
          story_id: storyId,
          evaluated_at: '2026-08-29T18:00:00Z',
          outcome: 'not_achieved',
          evidence: 'First review.',
          acceptance_exception_reason: null,
        },
        {
          story_id: '019946f1-8d2a-7f05-87b1-1eebbb476301',
          evaluated_at: '2026-08-29T18:00:00Z',
          outcome: 'closed',
          evidence: 'No longer relevant.',
          acceptance_exception_reason: null,
        },
      ],
    },
  };
  const vault = {
    getAbstractFileByPath: vi.fn(() => file),
  } as unknown as Pick<Vault, 'getAbstractFileByPath'>;
  const fileManager = {
    processFrontMatter: vi.fn(
      async (
        _file: TFile,
        mutate: (value: Record<string, unknown>) => void,
      ) => mutate(frontmatter),
    ),
  } as unknown as Pick<FileManager, 'processFrontMatter'>;
  return { writer: new ObsidianStoryEvaluationWriter(vault, fileManager), frontmatter };
}

const plan: StoryEvaluationPlan = {
  sprintId,
  sprintPath: path,
  storyId,
  evaluatedAt: '2026-08-30T18:00:00Z',
  outcome: 'achieved',
  evidence: 'Verified on mobile.',
  acceptanceExceptionReason: 'Landscape remains deferred.',
};

describe('ObsidianStoryEvaluationWriter', () => {
  it('replaces only the evaluated Story entry and is idempotent', async () => {
    const { writer, frontmatter } = setup();

    await writer.apply(plan);
    await writer.apply(plan);

    expect(frontmatter).toMatchObject({
      focus_flow: {
        provisional_story_outcomes: [
          {
            story_id: '019946f1-8d2a-7f05-87b1-1eebbb476301',
            outcome: 'closed',
          },
          {
            story_id: storyId,
            evaluated_at: '2026-08-30T18:00:00Z',
            outcome: 'achieved',
            evidence: 'Verified on mobile.',
            acceptance_exception_reason: 'Landscape remains deferred.',
          },
        ],
      },
    });
  });

  it('refuses evaluation while close recovery is pending', async () => {
    const { writer, frontmatter } = setup();
    const managed = frontmatter.focus_flow as Record<string, unknown>;
    managed.pending_close = { operation_id: 'pending' };

    await expect(writer.apply(plan)).rejects.toThrow(
      'Sprint close is already pending.',
    );
  });
});
