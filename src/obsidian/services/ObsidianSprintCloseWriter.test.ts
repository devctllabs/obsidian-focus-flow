import { TFile, type FileManager, type Vault } from 'obsidian';
import { describe, expect, it, vi } from 'vitest';
import type { SprintClosePlan } from '../../domain/sprint-close';
import { ObsidianSprintCloseWriter } from './ObsidianSprintCloseWriter';

const sprintId = '01994744-a401-759a-b582-4418f2f2405f';
const sprintPath = 'Focus Flow/Sprints/SPR-014.md';
const storyPath = 'Focus Flow/Stories/FF-42 Continue.md';
const taskPath = 'Focus Flow/Tasks/FF-43 Promote me.md';
const promotedPath = 'Focus Flow/Stories/FF-43 Promote me.md';

function plan(): SprintClosePlan {
  return {
    operationId: '01994a8a-0371-7a2d-a3e9-247990391600',
    decisionsHash: 'sha256:reviewed',
    capturedAt: '2026-08-30T18:00:00Z',
    sprintId,
    sprintPath,
    stories: [
      {
        id: '019946f1-8d2a-7f05-87b1-1eebbb476300',
        path: storyPath,
        expectedSprintRank: 'a0',
        outcome: 'not_achieved',
        evidence: 'Needs another Sprint.',
        acceptanceExceptionReason: null,
        backlogRank: 'a1',
      },
    ],
    tasks: [
      {
        id: '01994706-857c-76f1-8006-85cd9bd80890',
        path: taskPath,
        expectedStoryId: '019946f1-8d2a-7f05-87b1-1eebbb476300',
        expectedStatus: 'in_progress',
        resolution: 'reclassify',
        targetStoryId: null,
        targetStoryLink: null,
        targetEpicId: '019946c9-5f97-7196-8483-73469275ff90',
        targetEpicLink: '[[Focus Flow/Epics/FF-40 Product]]',
        targetRank: 'a2',
        continuationContext: null,
      },
    ],
    delta: {
      addedStories: [],
      removedStories: [],
      addedTasks: [],
      removedTasks: [],
      changedAcceptanceCriteriaStories: [],
    },
    closeSnapshot: {
      operationId: '01994a8a-0371-7a2d-a3e9-247990391600',
      capturedAt: '2026-08-30T18:00:00Z',
      stories: [
        {
          id: '019946f1-8d2a-7f05-87b1-1eebbb476300',
          key: 'FF-42',
          title: 'Continue',
          epicId: '019946c9-5f97-7196-8483-73469275ff90',
          outcome: 'not_achieved',
          evidence: 'Needs another Sprint.',
          acceptanceExceptionReason: null,
          acceptanceCriteria: [{ text: 'Done', checked: false }],
          effectiveTags: ['product/focus-flow'],
        },
      ],
      tasks: [
        {
          id: '01994706-857c-76f1-8006-85cd9bd80890',
          key: 'FF-43',
          title: 'Promote me',
          storyId: '019946f1-8d2a-7f05-87b1-1eebbb476300',
          status: 'in_progress',
          startedAt: '2026-08-28T09:00:00Z',
          completedAt: null,
          effectiveTags: ['product/focus-flow'],
          resolution: 'reclassify',
          targetStoryId: null,
          targetEpicId: '019946c9-5f97-7196-8483-73469275ff90',
          continuationContext: null,
        },
      ],
      summary: {
        attemptedStories: 1,
        storiesAtStart: 1,
        storiesAtClose: 1,
        storiesAdded: 0,
        storiesRemoved: 0,
        achievedStories: 0,
        notAchievedStories: 1,
        closedStories: 0,
        committedOpenTasks: 1,
        tasksAtStart: 1,
        tasksAtClose: 1,
        tasksAdded: 0,
        tasksRemoved: 0,
        completedDuringSprint: 0,
        openAtClose: 1,
        exceptionCount: 0,
      },
      effectiveTagSummary: [],
    },
    retrospective: { wins: [], friction: [], improvements: [] },
  };
}

function setup() {
  const files = new Map<string, TFile>();
  const frontmatters = new Map<string, Record<string, unknown>>();
  const bodies = new Map<string, string>();
  const add = (path: string, managed: Record<string, unknown>, body: string) => {
    const file = Object.assign(new TFile(), { path });
    files.set(path, file);
    frontmatters.set(path, { tags: ['keep/me'], focus_flow: managed });
    bodies.set(path, body);
  };
  add(
    sprintPath,
    { id: sprintId, type: 'sprint', lifecycle: 'active', pending_close: null },
    '# SPR-014\n\n<!-- focus-flow:report:start -->\nold\n<!-- focus-flow:report:end -->\n\n## Wins\n- User win.\n',
  );
  add(storyPath, {
    id: plan().stories[0]!.id,
    type: 'story',
    lifecycle: 'active_sprint',
    sprint_id: sprintId,
    sprint_rank: 'a0',
  }, '# Continue');
  add(taskPath, {
    id: plan().tasks[0]!.id,
    key: 'FF-43',
    type: 'task',
    lifecycle: 'active',
    story_id: plan().tasks[0]!.expectedStoryId,
    story_link: '[[Focus Flow/Stories/FF-42 Continue]]',
    task_rank: 'a0',
    status: 'in_progress',
    started_at: '2026-08-28T09:00:00Z',
    completed_at: null,
  }, '# Promote me\n\nKeep this body.');

  const vault = {
    getAbstractFileByPath: vi.fn((path: string) => files.get(path) ?? null),
    process: vi.fn(async (file: TFile, mutate: (body: string) => string) => {
      bodies.set(file.path, mutate(bodies.get(file.path) ?? ''));
    }),
  } as unknown as Pick<Vault, 'getAbstractFileByPath' | 'process'>;
  let failTaskOnce = false;
  const fileManager = {
    processFrontMatter: vi.fn(
      async (file: TFile, mutate: (value: Record<string, unknown>) => void) => {
        if (failTaskOnce && file.path === taskPath) {
          failTaskOnce = false;
          throw new Error('simulated interruption');
        }
        mutate(frontmatters.get(file.path)!);
      },
    ),
    renameFile: vi.fn(async (file: TFile, destination: string) => {
      const source = file.path;
      files.delete(source);
      files.set(destination, file);
      frontmatters.set(destination, frontmatters.get(source)!);
      bodies.set(destination, bodies.get(source)!);
      frontmatters.delete(source);
      bodies.delete(source);
      Object.assign(file, { path: destination });
    }),
  } as unknown as Pick<FileManager, 'processFrontMatter' | 'renameFile'>;
  const writer = new ObsidianSprintCloseWriter(
    vault,
    fileManager,
    () => 'Focus Flow',
    async () => '## Improvements',
  );
  return {
    writer,
    frontmatters,
    bodies,
    files,
    interruptNextTask: () => {
      failTaskOnce = true;
    },
  };
}

describe('ObsidianSprintCloseWriter', () => {
  it('persists pending_close before mutations, reclassifies in place, reports, and finalizes', async () => {
    const context = setup();

    await context.writer.apply(plan());

    expect(context.frontmatters.get(storyPath)).toMatchObject({
      focus_flow: {
        lifecycle: 'backlog',
        backlog_rank: 'a1',
      },
    });
    expect(context.frontmatters.get(promotedPath)).toMatchObject({
      tags: ['keep/me'],
      focus_flow: {
        id: plan().tasks[0]!.id,
        key: 'FF-43',
        type: 'story',
        lifecycle: 'backlog',
        epic_id: plan().tasks[0]!.targetEpicId,
        backlog_rank: 'a2',
      },
    });
    expect(context.bodies.get(promotedPath)).toContain('Keep this body.');
    expect(context.frontmatters.get(sprintPath)).toMatchObject({
      focus_flow: {
        lifecycle: 'closed',
        closed_at: '2026-08-30T18:00:00Z',
        close_snapshot: {
          tasks: [{ resolution: 'reclassify' }],
        },
      },
    });
    expect(
      (context.frontmatters.get(sprintPath)!.focus_flow as Record<string, unknown>)
        .pending_close,
    ).toBeUndefined();
    expect(context.bodies.get(sprintPath)).toContain('- User win.');
    expect(context.bodies.get(sprintPath)).not.toContain('\nold\n');
  });

  it('resumes an interrupted close idempotently from the same plan', async () => {
    const context = setup();
    context.interruptNextTask();

    await expect(context.writer.apply(plan())).rejects.toThrow(
      'simulated interruption',
    );
    expect(context.frontmatters.get(storyPath)).toMatchObject({
      focus_flow: { lifecycle: 'backlog' },
    });
    expect(context.frontmatters.get(sprintPath)).toMatchObject({
      focus_flow: {
        lifecycle: 'active',
        pending_close: { operation_id: plan().operationId },
      },
    });

    await expect(context.writer.apply(plan())).resolves.toBeUndefined();
    await expect(context.writer.apply(plan())).resolves.toBeUndefined();
    expect(context.files.has(promotedPath)).toBe(true);
    expect(context.frontmatters.get(sprintPath)).toMatchObject({
      focus_flow: { lifecycle: 'closed' },
    });
  });

  it.each([
    ['continue', 'external_in_progress', 'external_in_progress'],
    ['move', 'external_in_progress', 'external_in_progress'],
    ['continue', 'on_hold', 'on_hold'],
    ['move', 'on_hold', 'on_hold'],
    ['continue', 'today', 'todo'],
    ['continue', 'in_progress', 'todo'],
  ] as const)(
    'maps %s %s Tasks to %s and resumes idempotently',
    async (resolution, status, expectedStatus) => {
      const context = setup();
      const original = plan();
      const closePlan: SprintClosePlan = {
        ...original,
        tasks: [
          {
            ...original.tasks[0]!,
            expectedStatus: status,
            resolution,
            targetStoryId: original.stories[0]!.id,
            targetStoryLink: '[[Focus Flow/Stories/FF-42 Continue]]',
            targetEpicId: null,
            targetEpicLink: null,
            targetRank: 'a0',
          },
        ],
      };
      const managed = context.frontmatters.get(taskPath)!
        .focus_flow as Record<string, unknown>;
      managed.status = status;

      await context.writer.apply(closePlan);
      await expect(context.writer.apply(closePlan)).resolves.toBeUndefined();

      expect(context.frontmatters.get(taskPath)).toMatchObject({
        focus_flow: {
          lifecycle: 'active',
          status: expectedStatus,
          started_at: '2026-08-28T09:00:00Z',
        },
      });
    },
  );
});
