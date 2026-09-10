import { TFile, type FileManager, type Vault } from 'obsidian';
import { describe, expect, it, vi } from 'vitest';
import type { ActiveStoryMembershipPlan } from '../../application/planning/active-story-membership';
import { ObsidianActiveStoryMembershipWriter } from './ObsidianActiveStoryMembershipWriter';

const sprintPath = 'Focus Flow/Sprints/SPR-1.md';
const storyPath = 'Focus Flow/Stories/FF-3 Story.md';
const storyId = '019946f1-8d2a-7f05-87b1-1eebbb476300';
const sprintId = '01994770-0000-7000-8000-000000000099';

describe('ObsidianActiveStoryMembershipWriter', () => {
  it('adds and reparents with optimistic one-note writes while preserving extensions', async () => {
    const frontmatter: Record<string, unknown> = {
      tags: ['keep'],
      focus_flow: {
        id: storyId,
        type: 'story',
        lifecycle: 'backlog',
        epic_id: 'epic-old',
        epic_link: '[[Old]]',
        backlog_rank: 'a0',
        custom_extension: 'keep',
      },
    };
    const file = Object.assign(new TFile(), { path: storyPath });
    const fileManager = {
      processFrontMatter: vi.fn(async (
        _file: TFile,
        mutate: (value: Record<string, unknown>) => void,
      ) => mutate(frontmatter)),
    } as unknown as Pick<FileManager, 'processFrontMatter'>;
    const writer = new ObsidianActiveStoryMembershipWriter(
      {
        getAbstractFileByPath: vi.fn().mockReturnValue(file),
      },
      fileManager,
    );

    await writer.apply({
      kind: 'add-active-story',
      story: {
        id: storyId,
        path: storyPath,
        expectedLifecycle: 'backlog',
        expectedEpicId: 'epic-old',
        expectedBacklogRank: 'a0',
      },
      sprintId,
      sprintRank: 'a1',
    });
    await writer.apply({
      kind: 'reparent-active-story',
      story: {
        id: storyId,
        path: storyPath,
        expectedLifecycle: 'active_sprint',
        expectedEpicId: 'epic-old',
        expectedBacklogRank: null,
      },
      epicId: 'epic-new',
      epicLink: '[[Focus Flow/Epics/FF-9 New]]',
    });

    expect(frontmatter).toEqual({
      tags: ['keep'],
      focus_flow: {
        id: storyId,
        type: 'story',
        lifecycle: 'active_sprint',
        epic_id: 'epic-new',
        epic_link: '[[Focus Flow/Epics/FF-9 New]]',
        sprint_id: sprintId,
        sprint_rank: 'a1',
        custom_extension: 'keep',
      },
    });
    expect(fileManager.processFrontMatter).toHaveBeenCalledTimes(2);
  });

  it('clears the outcome first and resumes a partially applied removal', async () => {
    const sprint = {
      focus_flow: {
        id: sprintId,
        type: 'sprint',
        lifecycle: 'active',
        pending_close: null,
        provisional_story_outcomes: [{ story_id: storyId, outcome: 'achieved' }],
      },
    };
    const story = {
      focus_flow: {
        id: storyId,
        type: 'story',
        lifecycle: 'active_sprint',
        epic_id: 'epic',
        sprint_id: sprintId,
        sprint_rank: 'a0',
      },
    };
    const files = new Map([
      [sprintPath, Object.assign(new TFile(), { path: sprintPath })],
      [storyPath, Object.assign(new TFile(), { path: storyPath })],
    ]);
    let failStory = true;
    const fileManager = {
      processFrontMatter: vi.fn(async (
        file: TFile,
        mutate: (value: Record<string, unknown>) => void,
      ) => {
        if (file.path === storyPath && failStory) {
          failStory = false;
          throw new Error('interrupted');
        }
        mutate(file.path === sprintPath ? sprint : story);
      }),
    } as unknown as Pick<FileManager, 'processFrontMatter'>;
    const vault = {
      getAbstractFileByPath: vi.fn((path: string) => files.get(path) ?? null),
    } as unknown as Pick<Vault, 'getAbstractFileByPath'>;
    const writer = new ObsidianActiveStoryMembershipWriter(vault, fileManager);
    const plan: ActiveStoryMembershipPlan = {
      kind: 'remove-active-story',
      sprint: { id: sprintId, path: sprintPath },
      backlogRank: 'a1',
      story: {
        id: storyId,
        path: storyPath,
        expectedLifecycle: 'active_sprint',
        expectedEpicId: 'epic',
        expectedBacklogRank: null,
        expectedSprintRank: 'a0',
      },
    };

    await expect(writer.apply(plan)).rejects.toThrow('interrupted');
    expect(sprint.focus_flow.provisional_story_outcomes).toEqual([]);

    await writer.apply(plan);
    await writer.apply(plan);
    expect(story.focus_flow).toMatchObject({
      lifecycle: 'backlog',
      backlog_rank: 'a1',
    });
    expect(story.focus_flow).not.toHaveProperty('sprint_id');
  });
});
