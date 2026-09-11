import { TFile, type FileManager, type Vault } from 'obsidian';
import { describe, expect, it, vi } from 'vitest';
import type { SprintPlanningPlan } from '../../application/planning/plan-sprint';
import { ObsidianSprintPlanningWriter } from './ObsidianSprintPlanningWriter';

const draftId = '01994744-a401-759a-b582-4418f2f2405f';
const storyId = '019946f1-8d2a-7f05-87b1-1eebbb476300';
const storyPath = 'Focus Flow/Stories/FF-42 Improve weekly focus.md';
const draftPath = 'Focus Flow/Sprints/DRAFT.md';

function fixture(
  entries: ReadonlyArray<[string, Record<string, unknown>]> = [],
) {
  const files = new Map<string, TFile>();
  const frontmatters = new Map<string, Record<string, unknown>>();
  const folders = new Set<string>();
  for (const [path, frontmatter] of entries) {
    files.set(path, Object.assign(new TFile(), { path }));
    frontmatters.set(path, frontmatter);
    const segments = path.split('/').slice(0, -1);
    for (let length = 1; length <= segments.length; length += 1) {
      folders.add(segments.slice(0, length).join('/'));
    }
  }
  const vault = {
    getAbstractFileByPath: vi.fn(
      (path: string) => files.get(path) ?? (folders.has(path) ? { path } : null),
    ),
    createFolder: vi.fn(async (path: string) => {
      folders.add(path);
      return { path };
    }),
    create: vi.fn(async (path: string) => {
      const file = Object.assign(new TFile(), { path });
      files.set(path, file);
      return file;
    }),
    getMarkdownFiles: vi.fn(() => [...files.values()]),
  } as unknown as Pick<
    Vault,
    'getAbstractFileByPath' | 'createFolder' | 'create' | 'getMarkdownFiles'
  >;
  const fileManager = {
    processFrontMatter: vi.fn(
      async (
        file: TFile,
        update: (value: Record<string, unknown>) => void,
      ) => update(frontmatters.get(file.path)!),
    ),
    renameFile: vi.fn(async (file: TFile, destination: string) => {
      const source = file.path;
      files.delete(source);
      files.set(destination, file);
      frontmatters.set(destination, frontmatters.get(source)!);
      frontmatters.delete(source);
      Object.assign(file, { path: destination });
    }),
    trashFile: vi.fn(async (file: TFile) => {
      files.delete(file.path);
      frontmatters.delete(file.path);
    }),
  } as unknown as Pick<
    FileManager,
    'processFrontMatter' | 'renameFile' | 'trashFile'
  >;
  return { vault, fileManager, files, frontmatters };
}

function draftFrontmatter(): Record<string, unknown> {
  return {
    focus_flow: {
      schema_version: 1,
      id: draftId,
      type: 'sprint',
      lifecycle: 'draft',
    },
  };
}

function storyFrontmatter(
  lifecycle: 'backlog' | 'draft_sprint' | 'active_sprint' = 'backlog',
): Record<string, unknown> {
  return {
    tags: ['project/focus-flow'],
    focus_flow: {
      schema_version: 1,
      id: storyId,
      key: 'FF-42',
      type: 'story',
      lifecycle,
      epic_id: '019946c9-5f97-7196-8483-73469275ff90',
      backlog_rank: 'a0',
      ...(lifecycle === 'backlog'
        ? {}
        : { sprint_id: draftId, sprint_rank: 'a1' }),
    },
  };
}

function writer(context: ReturnType<typeof fixture>) {
  return new ObsidianSprintPlanningWriter(
    context.vault,
    context.fileManager,
    () => 'Focus Flow',
  );
}

describe('ObsidianSprintPlanningWriter', () => {
  it('creates the single Draft Sprint note in its canonical folder', async () => {
    const context = fixture();

    await writer(context).apply({ kind: 'create-draft', id: draftId });

    expect(context.vault.create).toHaveBeenCalledWith(
      draftPath,
      `---
focus_flow:
  schema_version: 1
  id: ${draftId}
  type: sprint
  lifecycle: draft
---

# Draft Sprint
`,
    );
  });

  it('selects and removes a Story while retaining its Month rank', async () => {
    const context = fixture([
      [draftPath, draftFrontmatter()],
      [storyPath, storyFrontmatter()],
    ]);
    const service = writer(context);

    await service.apply({
      kind: 'select-draft-story',
      draft: { id: draftId, path: draftPath },
      story: {
        id: storyId,
        path: storyPath,
        expectedBacklogRank: 'a0',
        sprintRank: 'a1',
      },
    });
    expect(context.frontmatters.get(storyPath)).toMatchObject({
      tags: ['project/focus-flow'],
      focus_flow: {
        lifecycle: 'draft_sprint',
        backlog_rank: 'a0',
        sprint_id: draftId,
        sprint_rank: 'a1',
      },
    });

    await service.apply({
      kind: 'remove-draft-story',
      draft: { id: draftId, path: draftPath },
      story: {
        id: storyId,
        path: storyPath,
        expectedBacklogRank: 'a0',
        expectedSprintRank: 'a1',
      },
    });
    expect(context.frontmatters.get(storyPath)).toMatchObject({
      focus_flow: { lifecycle: 'backlog', backlog_rank: 'a0' },
    });
    expect(
      (context.frontmatters.get(storyPath)!.focus_flow as Record<string, unknown>)
        .sprint_id,
    ).toBeUndefined();
  });

  it('cancels a Draft only after restoring all selected Stories', async () => {
    const context = fixture([
      [draftPath, draftFrontmatter()],
      [storyPath, storyFrontmatter('draft_sprint')],
    ]);

    await writer(context).apply({
      kind: 'cancel-draft',
      draft: { id: draftId, path: draftPath },
      stories: [
        {
          id: storyId,
          path: storyPath,
          expectedBacklogRank: 'a0',
          expectedSprintRank: 'a1',
        },
      ],
    });

    expect(context.frontmatters.get(storyPath)).toMatchObject({
      focus_flow: { lifecycle: 'backlog', backlog_rank: 'a0' },
    });
    expect(context.fileManager.trashFile).toHaveBeenCalledWith(
      expect.objectContaining({ path: draftPath }),
    );
  });

  it('starts a Sprint with exact dates, code, and durable snake-case snapshot', async () => {
    const context = fixture([
      [draftPath, draftFrontmatter()],
      [storyPath, storyFrontmatter('draft_sprint')],
    ]);
    const plan: SprintPlanningPlan = {
      kind: 'start-sprint',
      draft: { id: draftId, path: draftPath },
      code: 'SPR-005',
      sequence: 5,
      startsOn: '2026-08-24',
      dueOn: '2026-08-30',
      startedAt: '2026-08-30T12:00:00.000Z',
      stories: [
        { id: storyId, path: storyPath, expectedSprintRank: 'a1' },
      ],
      startSnapshot: {
        capturedAt: '2026-08-30T12:00:00.000Z',
        stories: [
          {
            id: storyId,
            key: 'FF-42',
            title: 'Improve weekly focus',
            epicId: '019946c9-5f97-7196-8483-73469275ff90',
            sprintRank: 'a1',
            acceptanceCriteriaHash: `sha256:${'a'.repeat(64)}`,
            acceptanceCriteria: [{ text: 'The week is visible', checked: false }],
            effectiveTags: ['project/focus-flow'],
            tasks: [
              {
                id: '01994706-857c-76f1-8006-85cd9bd80890',
                key: 'FF-43',
                title: 'Review old plan',
                taskRank: 'a0',
                status: 'done',
                completedBeforeSprint: true,
                effectiveTags: [],
              },
            ],
          },
        ],
      },
    };

    await writer(context).apply(plan);

    expect(context.frontmatters.get('Focus Flow/Sprints/SPR-005.md'))
      .toMatchObject({
        focus_flow: {
          id: draftId,
          type: 'sprint',
          lifecycle: 'active',
          code: 'SPR-005',
          sequence: 5,
          starts_on: '2026-08-24',
          due_on: '2026-08-30',
          started_at: '2026-08-30T12:00:00.000Z',
          closed_at: null,
          provisional_story_outcomes: [],
          start_snapshot: {
            captured_at: '2026-08-30T12:00:00.000Z',
            stories: [
              expect.objectContaining({
                acceptance_criteria_hash: `sha256:${'a'.repeat(64)}`,
                acceptance_criteria: [
                  { text: 'The week is visible', checked: false },
                ],
                tasks: [
                  expect.objectContaining({
                    task_rank: 'a0',
                    completed_before_sprint: true,
                  }),
                ],
              }),
            ],
          },
          close_snapshot: null,
        },
      });
    expect(context.frontmatters.get(storyPath)).toMatchObject({
      focus_flow: {
        lifecycle: 'active_sprint',
        sprint_id: draftId,
        sprint_rank: 'a1',
      },
    });
    expect(context.fileManager.renameFile).toHaveBeenCalledWith(
      expect.any(TFile),
      'Focus Flow/Sprints/SPR-005.md',
    );
  });

  it('rejects a destination collision before changing any frontmatter', async () => {
    const context = fixture([
      [draftPath, draftFrontmatter()],
      [storyPath, storyFrontmatter('draft_sprint')],
      ['Focus Flow/Sprints/SPR-005.md', draftFrontmatter()],
    ]);
    const start = startPlan();

    await expect(writer(context).apply(start)).rejects.toThrow(
      'Focus Flow Sprint destination already exists.',
    );
    expect(context.fileManager.processFrontMatter).not.toHaveBeenCalled();
  });

  it('revalidates the calendar window before mutating the Draft', async () => {
    const priorPath = 'Focus Flow/Sprints/SPR-004.md';
    const context = fixture([
      [draftPath, draftFrontmatter()],
      [storyPath, storyFrontmatter('draft_sprint')],
      [
        priorPath,
        {
          focus_flow: {
            id: '01994744-a401-759a-b582-4418f2f24050',
            type: 'sprint',
            lifecycle: 'closed',
            starts_on: '2026-08-24',
          },
        },
      ],
    ]);

    await expect(writer(context).apply(startPlan())).rejects.toThrow(
      'A Sprint already started for 2026-08-24.',
    );
    expect(context.frontmatters.get(storyPath)).toMatchObject({
      focus_flow: { lifecycle: 'draft_sprint' },
    });
  });

  it('resumes a completed start without renaming the Sprint again', async () => {
    const destination = 'Focus Flow/Sprints/SPR-005.md';
    const plan = startPlan();
    const started = draftFrontmatter();
    const managed = started.focus_flow as Record<string, unknown>;
    Object.assign(managed, {
      lifecycle: 'active',
      code: plan.code,
      sequence: plan.sequence,
      starts_on: plan.startsOn,
      due_on: plan.dueOn,
      started_at: plan.startedAt,
      closed_at: null,
      provisional_story_outcomes: [],
      start_snapshot: {
        captured_at: plan.startSnapshot.capturedAt,
        stories: [],
      },
      close_snapshot: null,
    });
    const context = fixture([
      [destination, started],
      [storyPath, storyFrontmatter('active_sprint')],
    ]);

    await expect(writer(context).apply(plan)).resolves.toBeUndefined();

    expect(context.fileManager.renameFile).not.toHaveBeenCalled();
  });
});

function startPlan(): Extract<SprintPlanningPlan, { kind: 'start-sprint' }> {
  return {
    kind: 'start-sprint',
    draft: { id: draftId, path: draftPath },
    code: 'SPR-005',
    sequence: 5,
    startsOn: '2026-08-24',
    dueOn: '2026-08-30',
    startedAt: '2026-08-30T12:00:00.000Z',
    stories: [{ id: storyId, path: storyPath, expectedSprintRank: 'a1' }],
    startSnapshot: {
      capturedAt: '2026-08-30T12:00:00.000Z',
      stories: [],
    },
  };
}
