import { browser, expect } from '@wdio/globals';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, it } from 'mocha';

async function readVaultFile(path: string): Promise<string> {
  return browser.executeObsidian(
    async ({ app, obsidian }, filePath) => {
      const file = app.vault.getAbstractFileByPath(filePath);
      if (!(file instanceof obsidian.TFile)) return '';
      return app.vault.cachedRead(file);
    },
    path,
  );
}

async function activeVaultFile(): Promise<string> {
  return browser.executeObsidian(
    ({ app }) => app.workspace.getActiveFile()?.path ?? '',
  );
}

async function clickButton(selector: string): Promise<void> {
  await browser.$(selector).waitForExist();
  await browser.execute((buttonSelector) => {
    const button = document.querySelector<HTMLButtonElement>(buttonSelector);
    if (button === null) throw new Error('Expected button was not found.');
    button.click();
  }, selector);
}

async function expandStory(key: string): Promise<void> {
  const toggles = await browser.$$(`[aria-label="Expand ${key}"]`);
  for (const toggle of toggles) {
    if (await toggle.isDisplayed()) {
      await toggle.scrollIntoView({ block: 'center' });
      await toggle.click();
      return;
    }
  }
}

async function openAttention(): Promise<void> {
  const trigger = browser.$('.focus-flow__attention-trigger');
  await trigger.waitForExist();
  await trigger.click();
  await browser.$('[role="dialog"]').waitForExist();
}

async function clickMenuAction(label: string): Promise<void> {
  await browser.$('.focus-flow__popover-menu').waitForExist();
  await browser.execute((actionLabel) => {
    const button = Array.from(
      document.querySelectorAll<HTMLButtonElement>('.focus-flow__popover-menu button'),
    ).find((candidate) => candidate.textContent?.trim() === actionLabel);
    if (button === undefined) throw new Error(`Menu action not found: ${actionLabel}`);
    button.click();
  }, label);
}

async function moveTask(key: string, destination: string, source: string): Promise<void> {
  const picker = browser.$('[aria-label="Task column"]');
  if (await picker.isExisting()) await picker.selectByAttribute('value', source);
  await clickButton(`[aria-label="More actions for ${key}"]`);
  await clickMenuAction(`Move to ${destination}`);
}

async function computedControlStyles(selector: string) {
  return browser.execute((targetSelector) => {
    const element = document.querySelector<HTMLElement>(targetSelector);
    if (element === null) throw new Error(`Control was not found: ${targetSelector}`);
    const style = window.getComputedStyle(element);
    const root = element.closest<HTMLElement>('.focus-flow');
    if (root === null) throw new Error('Focus Flow root was not found.');
    const tokenProbe = document.createElement('span');
    tokenProbe.style.color = 'var(--ff-muted)';
    root.append(tokenProbe);
    const mutedColor = window.getComputedStyle(tokenProbe).color;
    tokenProbe.remove();
    return {
      alignItems: style.alignItems,
      backgroundColor: style.backgroundColor,
      borderColor: style.borderColor,
      boxShadow: style.boxShadow,
      color: style.color,
      display: style.display,
      justifyContent: style.justifyContent,
      mutedColor,
      whiteSpace: style.whiteSpace,
    };
  }, selector);
}

describe('Focus Flow lifecycle', () => {
  const assertChildrenFit = async (selector: string) => {
    const failures = await browser.execute((target) => Array.from(document.querySelectorAll<HTMLElement>(target)).flatMap((parent) => {
      const box = parent.getBoundingClientRect();
      return Array.from(parent.children).flatMap((child) => {
        const rect = child.getBoundingClientRect();
        return rect.height > 0 && (rect.top < box.top - 1 || rect.bottom > box.bottom + 1)
          ? [`${parent.className}: ${child.textContent?.trim()} exceeds ${Math.round(box.height)}px parent (child ${Math.round(rect.top - box.top)}..${Math.round(rect.bottom - box.top)})`]
          : [];
      });
    }), selector);
    expect(failures).toEqual([]);
  };
  it('sets up existing templates and safely deletes accidental Epic and Candidate notes', async () => {
    const customTemplate = '## Description\n\nMy custom capture template.\n';
    await browser.executeObsidian(async ({ app }, template) => {
      await app.vault.createFolder('Setup sandbox');
      await app.vault.createFolder('Setup sandbox/Templates');
      await app.vault.create('Setup sandbox/Templates/Candidate.md', template);
    }, customTemplate);
    await browser.executeObsidianCommand('focus-flow:open-plan');
    await browser.$('[aria-label="Workspace folder"]').setValue('Setup sandbox');
    await browser.$('button=Review setup').click();
    await browser.$('button=Use this workspace').click();
    await browser.$('.modal-title').waitForExist({ reverse: true });
    expect(await readVaultFile('Setup sandbox/Templates/Candidate.md')).toBe(customTemplate);
    expect(await readVaultFile('Setup sandbox/Templates/Task.md')).toContain('Description');
    const epicPath = 'Setup sandbox/Epics/FF-99001 Accidental Epic.md';
    await browser.executeObsidian(async ({ app }, path) => {
      await app.vault.create(path, '---\nfocus_flow:\n  schema_version: 1\n  id: 01994710-2d87-7f10-9df8-8150e5543999\n  key: FF-99001\n  type: epic\n  lifecycle: backlog\n  backlog_rank: a0\n  created_at: 2026-09-05T09:00:00Z\n---\n# Accidental Epic\n\n## Intent\nResearch worth checking before deletion.\n');
    }, epicPath);
    await browser.$('[aria-label="Refresh notes"]').click();
    await browser.$('[aria-label="Actions for FF-99001"]').waitForExist();
    await clickButton('[aria-label="Actions for FF-99001"]');
    await clickMenuAction('Delete…');
    await expect(browser.$('button=Move to trash')).toBeDisabled();
    await browser.$('[role="dialog"] input[type="checkbox"]').click();
    await browser.$('button=Move to trash').click();
    await browser.waitUntil(async () => (await readVaultFile(epicPath)) === '');
    const candidatePath = 'Setup sandbox/Inbox/FF-99002 Accidental Candidate.md';
    await browser.executeObsidian(async ({ app }, path) => {
      await app.vault.create(path, '---\nfocus_flow:\n  schema_version: 1\n  id: 01994710-2d87-7f10-9df8-8150e5543998\n  key: FF-99002\n  type: candidate\n  lifecycle: inbox\n  created_at: 2026-09-05T09:00:00Z\n---\n## Description\nAn accidental idea with content.\n');
    }, candidatePath);
    await browser.executeObsidianCommand('focus-flow:open-inbox');
    await browser.$('[aria-label="Refresh notes"]').click();
    await clickButton('[aria-label="More actions for FF-99002"]');
    await clickMenuAction('Delete…');
    await expect(browser.$('button=Move to trash')).toBeDisabled();
    await browser.$('[role="dialog"]').$('button=Cancel').click();
    expect(await readVaultFile(candidatePath)).toContain('lifecycle: inbox');
    await clickButton('[aria-label="More actions for FF-99002"]');
    await clickMenuAction('Delete…');
    await browser.$('[role="dialog"] input[type="checkbox"]').click();
    await browser.$('button=Move to trash').click();
    await browser.waitUntil(async () => (await readVaultFile(candidatePath)) === '');
    const obsidian = browser.getObsidianPage();
    await browser.executeObsidian(async ({ app }) => {
      const plugin = (app as unknown as { plugins: { getPlugin(id: string): { settings: Record<string, unknown>; saveData(data: unknown): Promise<void> } } }).plugins.getPlugin('focus-flow');
      await plugin.saveData({ ...plugin.settings, rootFolder: 'Focus Flow', setupCompleted: false, templates: { candidate: 'Focus Flow/Templates/Candidate.md', task: 'Focus Flow/Templates/Task.md', retrospective: 'Focus Flow/Templates/Retrospective.md' } });
    });
    await obsidian.disablePlugin('focus-flow');
    await obsidian.enablePlugin('focus-flow');
  });

  it('opens Focus Flow from the left ribbon', async () => {
    const ribbonAction = browser.$(
      '.side-dock-ribbon-action[aria-label="Open focus"]',
    );
    await ribbonAction.waitForExist();
    await ribbonAction.click();
    await expect(browser.$('.modal-title')).toHaveText('Set up Focus Flow');
    await browser.keys('Escape');
  });

  it('blocks a conflicted root on first use and opens a pre-adopted fixture after reload', async () => {
    await browser.executeObsidianCommand('focus-flow:open-focus');

    await expect(browser.$('.modal-title')).toHaveText('Set up Focus Flow');
    await browser.$('button=Review setup').click();
    await expect(browser.$('button=Use this workspace')).toBeDisabled();
    await browser.keys('Escape');

    await browser.executeObsidian(async ({ app }) => {
      const plugin = (
        app as unknown as {
          plugins: {
            getPlugin(id: string): {
              settings: Record<string, unknown>;
              saveData(data: unknown): Promise<void>;
            };
          };
        }
      ).plugins.getPlugin('focus-flow');
      await plugin.saveData({ ...plugin.settings, setupCompleted: true });
    });

    const obsidian = browser.getObsidianPage();
    await obsidian.disablePlugin('focus-flow');
    await obsidian.enablePlugin('focus-flow');
    await browser.executeObsidianCommand('focus-flow:open-focus');

    const focusView = browser.$('.workspace-leaf-content[data-type="focus-flow"]');
    await expect(focusView).toExist();
    await expect(focusView.$('h1')).toHaveText('No active sprint');

    await obsidian.disablePlugin('focus-flow');
    await browser.waitUntil(
      async () => (await browser.$$('.focus-flow').length) === 0,
    );

    await obsidian.enablePlugin('focus-flow');
    await browser.executeObsidianCommand('focus-flow:open-focus');
    await browser.waitUntil(
      async () => (await browser.$$('.focus-flow').length) === 1,
    );
    await expect(browser.$('.focus-flow h1')).toHaveText('No active sprint');
    const lifecycleState = await browser.executeObsidian(({ app }) => ({
        leaves: app.workspace.getLeavesOfType('focus-flow').length,
        connectedRoots: Array.from(document.querySelectorAll('.focus-flow')).filter(
          (root) => root.isConnected,
        ).length,
      }));
    expect(lifecycleState).toEqual({ leaves: 1, connectedRoots: 1 });
  });

  it('repairs a stale parent link without changing user content', async () => {
    const storyPath =
      'Focus Flow/Stories/FF-42 Improve weekly focus.md';
    await browser.executeObsidianCommand('focus-flow:open-plan');
    await openAttention();

    const repairButton = browser.$(
      `[aria-label="Repair parent link for ${storyPath}"]`,
    );
    await repairButton.waitForExist();
    await repairButton.click();
    await clickButton('[aria-label="Close dialog"]');

    await browser.waitUntil(async () => {
      const content = await readVaultFile(storyPath);
      return content.includes(
        '[[Focus Flow/Epics/FF-40 Build a calmer system]]',
      );
    });

    const repairedContent = await readVaultFile(storyPath);
    expect(repairedContent).toContain('custom_managed_extension: preserve-me');
    expect(repairedContent).toContain('cssclasses:');
    expect(repairedContent).toContain('USER BODY MARKER MUST SURVIVE REPAIR.');
    expect(repairedContent).not.toContain('[[FF-99 Wrong Epic]]');
  });

  it('rebalances duplicate ranks without changing user content', async () => {
    const firstEpicPath =
      'Focus Flow/Epics/FF-40 Build a calmer system.md';
    const secondEpicPath =
      'Focus Flow/Epics/FF-44 Make reviews repeatable.md';
    await browser.executeObsidianCommand('focus-flow:open-plan');
    await openAttention();

    const repairButton = browser.$(
      '[aria-label="Rebalance ranks for the Epic Backlog"]',
    );
    await repairButton.waitForExist();
    await repairButton.click();
    await clickButton('[aria-label="Close dialog"]');

    await browser.waitUntil(async () => {
      const content = await readVaultFile(secondEpicPath);
      return content.includes('backlog_rank: a1');
    });

    const [firstEpicContent, secondEpicContent] = await Promise.all([
      readVaultFile(firstEpicPath),
      readVaultFile(secondEpicPath),
    ]);

    expect(firstEpicContent).toContain('backlog_rank: a0');
    expect(secondEpicContent).toContain('backlog_rank: a1');
    expect(secondEpicContent).toContain('custom_managed_extension: preserve-me');
    expect(secondEpicContent).toContain(
      'USER BODY MARKER MUST SURVIVE RANK REPAIR.',
    );
  });

  it('moves a misplaced note without changing user content', async () => {
    const sourcePath =
      'Focus Flow/Tasks/FF-41 Explore weekly focus.md';
    const destinationPath =
      'Focus Flow/Inbox/FF-41 Explore weekly focus.md';
    await browser.executeObsidianCommand('focus-flow:open-plan');
    await openAttention();

    const repairButton = browser.$('[aria-label="Move note to Inbox"]');
    await repairButton.waitForExist();
    await repairButton.click();
    await clickButton('[aria-label="Close dialog"]');

    await browser.waitUntil(async () => {
      const content = await readVaultFile(destinationPath);
      return content.includes('USER BODY MARKER MUST SURVIVE MOVE REPAIR.');
    });

    const [sourceContent, movedContent] = await Promise.all([
      readVaultFile(sourcePath),
      readVaultFile(destinationPath),
    ]);
    expect(sourceContent).toBe('');
    expect(movedContent).toContain('custom_managed_extension: preserve-me');
    expect(movedContent).toContain('cssclasses:');
    expect(movedContent).toContain(
      'USER BODY MARKER MUST SURVIVE MOVE REPAIR.',
    );
  });

  it('repairs a duplicate key, filename, and derived parent link', async () => {
    const oldEpicPath =
      'Focus Flow/Epics/FF-40 Make reviews repeatable.md';
    const newEpicPath =
      'Focus Flow/Epics/FF-47 Make reviews repeatable.md';
    const childStoryPath =
      'Focus Flow/Stories/FF-46 Review consistently.md';
    await browser.executeObsidianCommand('focus-flow:open-plan');
    await openAttention();

    const repairButton = browser.$(
      '[aria-label="Repair duplicate keys"]',
    );
    await repairButton.waitForExist();
    await repairButton.click();
    await clickButton('[aria-label="Close dialog"]');

    await browser.waitUntil(async () => {
      const repairError = browser.$('.focus-flow__repair-error');
      const [oldContent, newContent, storyContent] = await Promise.all([
        readVaultFile(oldEpicPath),
        readVaultFile(newEpicPath),
        readVaultFile(childStoryPath),
      ]);
      return (
        (oldContent === '' &&
          newContent.includes('key: FF-47') &&
          storyContent.includes('FF-47 Make reviews repeatable]]')) ||
        (await repairError.isExisting())
      );
    });

    const [oldEpicContent, newEpicContent, childStoryContent] =
      await Promise.all([
        readVaultFile(oldEpicPath),
        readVaultFile(newEpicPath),
        readVaultFile(childStoryPath),
      ]);
    expect(oldEpicContent).toBe('');
    expect(newEpicContent).toContain('key: FF-47');
    expect(newEpicContent).toContain('custom_managed_extension: preserve-me');
    expect(newEpicContent).toContain(
      'USER BODY MARKER MUST SURVIVE KEY REPAIR.',
    );
    expect(childStoryContent).toContain('FF-47 Make reviews repeatable]]');
  });

  it('repairs a duplicate UUID and its derived parent reference', async () => {
    const originalId = '01994820-0000-7000-8000-000000000001';
    const storyPath =
      'Focus Flow/Stories/FF-45 Summarize review notes.md';
    const childTaskPath =
      'Focus Flow/Tasks/FF-39 Draft review summary.md';
    await browser.executeObsidianCommand('focus-flow:open-plan');
    await openAttention();

    const repairButton = browser.$(
      '[aria-label="Repair duplicate UUIDs"]',
    );
    await repairButton.waitForExist();
    await repairButton.click();
    await clickButton('[aria-label="Close dialog"]');

    await browser.waitUntil(async () => {
      const content = await readVaultFile(storyPath);
      return !content.includes(`id: ${originalId}`);
    });

    const [storyContent, childTaskContent] = await Promise.all([
      readVaultFile(storyPath),
      readVaultFile(childTaskPath),
    ]);
    const replacementId = storyContent.match(
      /\n  id: ([0-9a-f-]{36})\n/,
    )?.[1];

    expect(replacementId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(replacementId).not.toBe(originalId);
    expect(childTaskContent).toContain(`story_id: ${replacementId}`);
    expect(storyContent).toContain('custom_managed_extension: preserve-me');
    expect(storyContent).toContain(
      'USER BODY MARKER MUST SURVIVE UUID REPAIR.',
    );
    expect(childTaskContent).toContain(
      'USER BODY MARKER MUST SURVIVE UUID CASCADE.',
    );
  });

  it('captures a Candidate from the command even when Mission is missing', async () => {
    const candidatePath =
      'Focus Flow/Inbox/FF-48 Capture a calmer weekly signal.md';
    await browser.executeObsidianCommand('focus-flow:open-inbox');

    const missionNote = browser.$('.focus-flow__mission-note');
    await missionNote.waitForExist();
    await expect(missionNote).toHaveText(
      expect.stringContaining('MISSION.md'),
    );
    await expect(missionNote).toHaveText(
      expect.stringContaining('quiet reference'),
    );

    await browser.executeObsidianCommand('focus-flow:capture-candidate');
    const title = browser.$('.modal-container [aria-label="Candidate title"]');
    await title.waitForExist();
    await title.setValue('Capture a calmer weekly signal');
    const tags = browser.$('.modal-container [aria-label="Tags"]');
    await tags.setValue('weekly');
    await tags.click();
    await browser.keys('Enter');
    await browser.$('.modal-container button[type="submit"]').click();

    await browser.waitUntil(async () => {
      const content = await readVaultFile(candidatePath);
      return content.includes('type: candidate');
    });
    const content = await readVaultFile(candidatePath);
    expect(content).toContain('key: FF-48');
    expect(content).toContain('tags: ["weekly"]');
    expect(content).toMatch(
      /\n  id: [0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\n/,
    );
    expect(content).toContain('## Description');
    expect(content).not.toContain('# Capture a calmer weekly signal');
    await browser.waitUntil(async () => (await activeVaultFile()) === candidatePath);
  });

  it('keeps Inbox controls isolated from Obsidian host styles', async () => {
    await browser.executeObsidianCommand('focus-flow:open-inbox');

    const segments = browser.$('.focus-flow__segments button');
    const search = browser.$('.focus-flow__search-field input[type="search"]');
    const tag = browser.$('.focus-flow__compact-tags > span');
    await Promise.all([
      segments.waitForExist(),
      search.waitForExist(),
      tag.waitForExist(),
    ]);

    const segmentStyles = await computedControlStyles('.focus-flow__segments button');
    expect(segmentStyles).toMatchObject({
      alignItems: 'center',
      display: 'flex',
      justifyContent: 'center',
      whiteSpace: 'normal',
    });
    const tagStyles = await computedControlStyles('.focus-flow__compact-tags > span');
    expect(tagStyles.color).toBe(tagStyles.mutedColor);

    const searchIdle = await computedControlStyles('.focus-flow__search-field input[type="search"]');
    await search.moveTo();
    const searchHover = await computedControlStyles('.focus-flow__search-field input[type="search"]');
    expect(searchHover.borderColor).not.toBe(searchIdle.borderColor);
    expect(searchHover.boxShadow).toBe('none');

    await browser.$('[aria-label="Capture Candidate"]').click();
    const capture = browser.$('.focus-flow__candidate-form [aria-label="Candidate title"]');
    await capture.waitForExist();
    const captureIdle = await computedControlStyles('.focus-flow__candidate-form [aria-label="Candidate title"]');
    await capture.moveTo();
    const captureHover = await computedControlStyles('.focus-flow__candidate-form [aria-label="Candidate title"]');
    expect(captureHover.backgroundColor).toBe(captureIdle.backgroundColor);
    expect(captureHover.color).toBe(captureIdle.color);
    await browser.keys('Escape');
  });

  it('accepts Candidates as Epic and Story without replacing their notes', async () => {
    const epicSource =
      'Focus Flow/Inbox/FF-1 Shape a sustainable rhythm.md';
    const epicPath =
      'Focus Flow/Epics/FF-1 Shape a sustainable rhythm.md';
    const storySource =
      'Focus Flow/Inbox/FF-2 Clarify the weekly signal.md';
    const storyPath =
      'Focus Flow/Stories/FF-2 Clarify the weekly signal.md';
    const epicId = '01994780-0000-7000-8000-000000000001';
    await browser.executeObsidianCommand('focus-flow:open-inbox');

    await clickButton('[aria-label="More actions for FF-1"]');
    await clickMenuAction('Accept as Epic');
    await clickButton('[aria-label="Create Epic"]');
    await browser.waitUntil(async () => {
      const content = await readVaultFile(epicPath);
      return content.includes('type: epic');
    });

    const [removedEpicSource, epicContent] = await Promise.all([
      readVaultFile(epicSource),
      readVaultFile(epicPath),
    ]);
    expect(removedEpicSource).toBe('');
    expect(epicContent).toContain(`id: ${epicId}`);
    expect(epicContent).toContain('key: FF-1');
    expect(epicContent).toContain('tags:');
    expect(epicContent).toContain('## Entry Review');
    expect(epicContent).toContain('custom_managed_extension: preserve-me');
    expect(epicContent).toContain(
      'CANDIDATE BODY MUST SURVIVE EPIC ACCEPTANCE.',
    );

    await clickButton('[aria-label="More actions for FF-2"]');
    await clickMenuAction('Accept as Story');
    const parent = browser.$('[aria-label="Parent Epic"]');
    await parent.waitForExist();
    await parent.click();
    await parent.setValue('Shape a sustainable rhythm');
    await browser.$('[role="option"]').click();
    await clickButton('[aria-label="Create Story"]');
    await browser.waitUntil(async () => {
      const content = await readVaultFile(storyPath);
      return content.includes('type: story');
    });

    const [removedStorySource, storyContent] = await Promise.all([
      readVaultFile(storySource),
      readVaultFile(storyPath),
    ]);
    expect(removedStorySource).toBe('');
    expect(storyContent).toContain(
      'id: 01994780-0000-7000-8000-000000000002',
    );
    expect(storyContent).toContain('key: FF-2');
    expect(storyContent).toContain('tags:');
    expect(storyContent).toContain(`epic_id: ${epicId}`);
    expect(storyContent).toContain(
      'epic_link: "[[Focus Flow/Epics/FF-1 Shape a sustainable rhythm]]"',
    );
    expect(storyContent).toContain('## Entry Review');
    expect(storyContent).toContain(
      'CANDIDATE BODY MUST SURVIVE STORY ACCEPTANCE.',
    );
    expect(storyContent).toContain('lifecycle: epic_backlog');
    expect(storyContent).not.toContain('backlog_rank:');
    await browser.executeObsidianCommand('focus-flow:open-plan');
    await clickButton('[aria-label="Expand FF-1"]');
    await clickButton('[aria-label="Add FF-2 to Month backlog"]');
    await browser.waitUntil(async () => (await readVaultFile(storyPath)).includes('lifecycle: backlog'));
    await clickButton('[aria-label="Reorder FF-2"]');
    await clickMenuAction('Return to Epic');
    await browser.waitUntil(async () => (await readVaultFile(storyPath)).includes('lifecycle: epic_backlog'));
    await clickButton('[aria-label="Add FF-2 to Month backlog"]');
    await browser.waitUntil(async () => (await readVaultFile(storyPath)).includes('lifecycle: backlog'));
  });

  it('rejects a Candidate and keeps it inspectable as a Distraction', async () => {
    const sourcePath =
      'Focus Flow/Inbox/FF-3 Chase another dashboard.md';
    const distractionPath =
      'Focus Flow/Distractions/FF-3 Chase another dashboard.md';
    await browser.executeObsidianCommand('focus-flow:open-inbox');

    await clickButton('[aria-label="More actions for FF-3"]');
    await clickMenuAction('Reject');
    const reason = browser.$('[aria-label="Rejection reason for FF-3"]');
    await reason.waitForExist();
    await reason.setValue('Not aligned with this cycle.');
    await browser.$('[aria-label="Reject FF-3"]').click();
    await browser.waitUntil(async () => {
      const content = await readVaultFile(distractionPath);
      return content.includes('lifecycle: rejected');
    });

    const [removedSource, content] = await Promise.all([
      readVaultFile(sourcePath),
      readVaultFile(distractionPath),
    ]);
    expect(removedSource).toBe('');
    expect(content).toContain(
      'id: 01994780-0000-7000-8000-000000000003',
    );
    expect(content).toContain('key: FF-3');
    expect(content).toContain('tags:');
    expect(content).toContain('rejection_reason: Not aligned with this cycle.');
    expect(content).toContain('CANDIDATE BODY MUST SURVIVE REJECTION.');

    await browser.executeObsidianCommand('focus-flow:open-inbox');
    await browser.$('button=Distractions 1').click();
    const open = browser.$(
      '[aria-label="Open FF-3 Chase another dashboard"]',
    );
    await open.waitForExist();
    await expect(browser.$('.focus-flow')).toHaveText(
      expect.stringContaining('Not aligned with this cycle.'),
    );
    await open.click();
    await browser.waitUntil(
      async () => (await activeVaultFile()) === distractionPath,
    );
  });

  it('creates, opens, and reloads Task and backlog ranks without drift', async () => {
    const taskPath =
      'Focus Flow/Tasks/FF-49 Write the next weekly review.md';
    const acceptedEpicPath =
      'Focus Flow/Epics/FF-1 Shape a sustainable rhythm.md';
    const acceptedStoryPath =
      'Focus Flow/Stories/FF-2 Clarify the weekly signal.md';
    await browser.executeObsidianCommand('focus-flow:open-plan');

    await clickButton('[aria-label="Expand FF-42"]');
    await clickButton('[aria-label="Create Task for FF-42"]');
    const taskInputs = await browser.$$('[aria-label="New Task for FF-42"]');
    expect(taskInputs.length).toBeGreaterThan(0);
    await taskInputs[0]!.setValue('Write the next weekly review');
    await clickButton('[aria-label="Add Task to FF-42"]');
    await browser.waitUntil(async () => {
      const content = await readVaultFile(taskPath);
      return content.includes('story_id: 019946f1-8d2a-7f05-87b1-1eebbb476300');
    });

    const created = await readVaultFile(taskPath);
    expect(created).toContain(
      'story_link: "[[Focus Flow/Stories/FF-42 Improve weekly focus]]"',
    );
    expect(created).toContain('status: todo');
    expect(created).toContain('## Description');
    expect(created).not.toContain('# Write the next weekly review');

    const openTask = browser.$(
      '[aria-label="Open FF-49 Write the next weekly review"]',
    );
    await openTask.waitForExist();
    await openTask.scrollIntoView({ block: 'center' });
    await browser.$('[role="dialog"]').waitForExist({ reverse: true });
    await browser.execute(() => document.querySelector('[aria-label="Open FF-49 Write the next weekly review"]')?.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await openTask.click();
    await browser.waitUntil(async () => (await activeVaultFile()) === taskPath);

    await browser.executeObsidianCommand('focus-flow:open-plan');
    const reorderTask = browser.$('[aria-label="Reorder FF-49"]');
    await reorderTask.waitForExist();
    await clickButton('[aria-label="Reorder FF-49"]');
    await clickMenuAction('Move to top');
    const originalRank = created.match(/\n  task_rank: (.+)\n/)?.[1];
    await browser.waitUntil(async () => {
      const current = await readVaultFile(taskPath);
      return current.match(/\n  task_rank: (.+)\n/)?.[1] !== originalRank;
    });
    const reordered = await readVaultFile(taskPath);
    const persistedRank = reordered.match(/\n  task_rank: (.+)\n/)?.[1];
    expect(persistedRank).toBeTruthy();

    const epicBefore = await readVaultFile(acceptedEpicPath);
    const originalEpicRank = epicBefore.match(
      /\n  backlog_rank: (.+)\n/,
    )?.[1];
    const reorderEpic = browser.$('[aria-label="Actions for FF-1"]');
    await clickButton('[aria-label="Expand FF-1"]');
    await reorderEpic.waitForExist();
    await clickButton('[aria-label="Actions for FF-1"]');
    await clickMenuAction('Move to top');
    await browser.waitUntil(async () => {
      const current = await readVaultFile(acceptedEpicPath);
      return current.match(/\n  backlog_rank: (.+)\n/)?.[1] !== originalEpicRank;
    });
    const persistedEpicRank = (await readVaultFile(acceptedEpicPath)).match(
      /\n  backlog_rank: (.+)\n/,
    )?.[1];

    const storyBefore = await readVaultFile(acceptedStoryPath);
    const originalStoryRank = storyBefore.match(
      /\n  backlog_rank: (.+)\n/,
    )?.[1];
    await clickButton('[aria-label="Expand FF-2"]');
    const reorderStory = browser.$('[aria-label="Reorder FF-2"]');
    await reorderStory.waitForExist();
    await clickButton('[aria-label="Reorder FF-2"]');
    await clickMenuAction('Move to top');
    await browser.waitUntil(async () => {
      const current = await readVaultFile(acceptedStoryPath);
      return current.match(/\n  backlog_rank: (.+)\n/)?.[1] !== originalStoryRank;
    });
    const persistedStoryRank = (
      await readVaultFile(acceptedStoryPath)
    ).match(/\n  backlog_rank: (.+)\n/)?.[1];

    const obsidian = browser.getObsidianPage();
    await obsidian.disablePlugin('focus-flow');
    await obsidian.enablePlugin('focus-flow');
    await browser.executeObsidianCommand('focus-flow:open-plan');
    const month = browser.$(
      '[aria-labelledby="focus-flow-month-backlog"]',
    );
    await month.waitForExist();
    await expandStory('FF-42');
    const monthTaskSelector =
      '[aria-labelledby="focus-flow-month-backlog"] .focus-flow__task-list .focus-flow__title-link';
    await browser.waitUntil(
      () =>
        browser.execute(
          (selector) => document.querySelectorAll(selector).length >= 2,
          monthTaskSelector,
        ),
    );
    const monthTaskTitles = await browser.$$(monthTaskSelector);
    await expect(monthTaskTitles[0]!).toHaveAttribute(
      'aria-label',
      'Open FF-49 Write the next weekly review',
    );
    const firstMonthStory = browser.$(
      '[aria-labelledby="focus-flow-month-backlog"] > .focus-flow__planning-list > .focus-flow__planning-item:first-child .focus-flow__planning-heading .focus-flow__title-link',
    );
    await expect(firstMonthStory).toHaveAttribute(
      'aria-label',
      'Open FF-2 Clarify the weekly signal',
    );
    const firstEpic = browser.$(
      '[aria-labelledby="focus-flow-epic-backlog"] > .focus-flow__planning-list > .focus-flow__planning-item:first-child .focus-flow__planning-heading .focus-flow__title-link',
    );
    await expect(firstEpic).toHaveAttribute(
      'aria-label',
      'Open FF-1 Shape a sustainable rhythm',
    );
    const [afterReload, epicAfterReload, storyAfterReload] = await Promise.all([
      readVaultFile(taskPath),
      readVaultFile(acceptedEpicPath),
      readVaultFile(acceptedStoryPath),
    ]);
    expect(afterReload.match(/\n  task_rank: (.+)\n/)?.[1]).toBe(persistedRank);
    expect(epicAfterReload.match(/\n  backlog_rank: (.+)\n/)?.[1]).toBe(
      persistedEpicRank,
    );
    expect(storyAfterReload.match(/\n  backlog_rank: (.+)\n/)?.[1]).toBe(
      persistedStoryRank,
    );
  });

  it('plans, cancels, starts, and reloads a Markdown-native Sprint', async () => {
    const draftPath = 'Focus Flow/Sprints/DRAFT.md';
    const sprintPath = 'Focus Flow/Sprints/SPR-001.md';
    const focusedStoryPath =
      'Focus Flow/Stories/FF-42 Improve weekly focus.md';
    const emptyTaskStoryPath =
      'Focus Flow/Stories/FF-46 Review consistently.md';
    await browser.executeObsidianCommand('focus-flow:open-plan');

    const createDraft = browser.$('button=Create Draft Sprint');
    await createDraft.waitForClickable();
    await createDraft.click();
    await browser.waitUntil(async () =>
      (await readVaultFile(draftPath)).includes('lifecycle: draft'),
    );

    await expandStory('FF-42');
    await clickButton('[aria-label="Add FF-42 to Draft Sprint"]');
    await browser.waitUntil(async () =>
      (await readVaultFile(focusedStoryPath)).includes(
        'lifecycle: draft_sprint',
      ),
    );
    await expandStory('FF-46');
    await clickButton('[aria-label="Add FF-46 to Draft Sprint"]');
    await browser.waitUntil(async () =>
      (await readVaultFile(emptyTaskStoryPath)).includes(
        'lifecycle: draft_sprint',
      ),
    );

    const originalRank = (await readVaultFile(emptyTaskStoryPath)).match(
      /\n  sprint_rank: (.+)\n/,
    )?.[1];
    await expandStory('FF-46');
    await clickButton('[aria-labelledby="focus-flow-draft-sprint"] [aria-label="Reorder FF-46"]');
    await clickMenuAction('Move to top');
    await browser.waitUntil(async () => {
      const content = await readVaultFile(emptyTaskStoryPath);
      return content.match(/\n  sprint_rank: (.+)\n/)?.[1] !== originalRank;
    });

    await browser.$('button=Cancel Draft Sprint').click();
    await browser.waitUntil(async () => (await readVaultFile(draftPath)) === '');
    const [returnedFocusedStory, returnedEmptyTaskStory] = await Promise.all([
      readVaultFile(focusedStoryPath),
      readVaultFile(emptyTaskStoryPath),
    ]);
    expect(returnedFocusedStory).toContain('lifecycle: backlog');
    expect(returnedEmptyTaskStory).toContain('lifecycle: backlog');
    expect(returnedFocusedStory).not.toContain('sprint_id:');
    expect(returnedEmptyTaskStory).not.toContain('sprint_rank:');

    await browser.$('button=Create Draft Sprint').click();
    await browser.waitUntil(async () =>
      (await readVaultFile(draftPath)).includes('lifecycle: draft'),
    );
    await expandStory('FF-42');
    await clickButton('[aria-label="Add FF-42 to Draft Sprint"]');
    await browser.waitUntil(async () =>
      (await readVaultFile(focusedStoryPath)).includes(
        'lifecycle: draft_sprint',
      ),
    );
    await expandStory('FF-46');
    await clickButton('[aria-label="Add FF-46 to Draft Sprint"]');
    await browser.waitUntil(async () =>
      (await readVaultFile(emptyTaskStoryPath)).includes(
        'lifecycle: draft_sprint',
      ),
    );

    const startSprint = browser.$('button=Start Sprint');
    await startSprint.waitForClickable();
    await startSprint.click();
    await browser.waitUntil(async () =>
      (await readVaultFile(sprintPath)).includes('lifecycle: active'),
    );

    const [sprint, focusedStory, emptyTaskStory] = await Promise.all([
      readVaultFile(sprintPath),
      readVaultFile(focusedStoryPath),
      readVaultFile(emptyTaskStoryPath),
    ]);
    expect(await readVaultFile(draftPath)).toBe('');
    expect(sprint).toContain('code: SPR-001');
    expect(sprint).toContain('sequence: 1');
    expect(sprint).toMatch(/\n  starts_on: \d{4}-\d{2}-\d{2}\n/);
    expect(sprint).toMatch(/\n  due_on: \d{4}-\d{2}-\d{2}\n/);
    expect(sprint).toContain('start_snapshot:');
    expect(sprint).toContain('acceptance_criteria_hash: sha256:');
    expect(sprint).toContain('completed_before_sprint: true');
    expect(sprint).toContain('key: FF-46');
    expect(focusedStory).toContain('lifecycle: active_sprint');
    expect(emptyTaskStory).toContain('lifecycle: active_sprint');

    const obsidian = browser.getObsidianPage();
    await obsidian.disablePlugin('focus-flow');
    await obsidian.enablePlugin('focus-flow');
    await browser.executeObsidianCommand('focus-flow:open-plan');

    const activeSprint = browser.$(
      '[aria-labelledby="focus-flow-active-sprint"]',
    );
    await activeSprint.waitForExist();
    await expect(activeSprint.$('h2')).toHaveText('SPR-001');
    await expect(
      activeSprint.$('[aria-label="Open FF-46 Review consistently"]'),
    ).toExist();
    await expandStory('FF-42');
    await expect(activeSprint).toHaveText(expect.stringContaining('Prior Done'));
  });

  it('keeps multi-line Focus card content inside its controls in the real host', async () => {
    await browser.executeObsidianCommand('focus-flow:open-focus');
    const picker = browser.$('[aria-label="Task column"]');
    await browser.$('.focus-flow__focus-board').waitForExist();
    if (await picker.isExisting()) await picker.selectByAttribute('value', 'todo');
    await browser.$('.focus-flow__board-task .focus-flow__title-link').waitForExist();
    await assertChildrenFit('.focus-flow__board-task .focus-flow__title-link');
    const geometry = await browser.execute(() => Array.from(document.querySelectorAll<HTMLElement>('.focus-flow__task-next')).map((button) => ({ width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height, shape: getComputedStyle(button).getPropertyValue('corner-shape') })));
    expect(geometry.length).toBeGreaterThan(0);
    for (const button of geometry) { expect(Math.abs(button.width - button.height)).toBeLessThan(1); if (button.shape !== '') expect(button.shape).toBe('round'); }
    const toggle = browser.$('.focus-flow__board-toggle input');
    if (await toggle.isExisting()) {
      await toggle.click();
      expect(await browser.execute(() => getComputedStyle(document.querySelector('.focus-flow__board-toggle input')!, '::after').display)).toBe('none');
    }
  });

  it('confirms Active Sprint membership changes and returns a Story to Month and back', async () => {
    const storyPath = 'Focus Flow/Stories/FF-46 Review consistently.md';
    await browser.executeObsidianCommand('focus-flow:open-plan');
    const original = await readVaultFile(storyPath);
    await clickButton('[aria-label="Return FF-46 to Month backlog"]');
    await browser.$('[role="dialog"]').waitForExist();
    expect(await readVaultFile(storyPath)).toBe(original);
    await browser.$('[role="dialog"]').$('button=Cancel').click();
    expect(await readVaultFile(storyPath)).toBe(original);

    await clickButton('[aria-label="Return FF-46 to Month backlog"]');
    await browser.$('[role="dialog"]').$('button=Return to Month').click();
    await browser.waitUntil(async () => (await readVaultFile(storyPath)).includes('lifecycle: backlog'));
    await clickButton('[aria-label="Add FF-46 to Active Sprint"]');
    await browser.$('[role="dialog"]').waitForExist();
    expect(await readVaultFile(storyPath)).toContain('lifecycle: backlog');
    await browser.$('[role="dialog"]').$('button=Add to Sprint').click();
    await browser.waitUntil(async () => (await readVaultFile(storyPath)).includes('lifecycle: active_sprint'));
    await expect(browser.$('[aria-label="Return FF-46 to Month backlog"]')).toExist();
  });

  it('moves Tasks on the Focus Board and preserves timestamp semantics', async () => {
    const taskPath = 'Focus Flow/Tasks/FF-49 Write the next weekly review.md';
    await browser.executeObsidianCommand('focus-flow:open-focus');

    await expect(browser.$('.focus-flow__focus-board')).toExist();
    await moveTask('FF-49', 'Today', 'todo');
    await browser.waitUntil(async () =>
      (await readVaultFile(taskPath)).includes('status: today'),
    );

    await moveTask('FF-49', 'Done', 'today');
    const archivedPath = taskPath.replace('/Tasks/', `/Tasks/Archive/${new Date().toISOString().slice(0, 7).replace('-', '/')}/`);
    await browser.waitUntil(async () =>
      (await readVaultFile(archivedPath)).includes('status: done'),
    );
    const completed = await readVaultFile(archivedPath);
    expect(await readVaultFile(taskPath)).toBe('');
    expect(completed).toMatch(/\n  completed_at: \d{4}-\d{2}-\d{2}T/);
    expect(completed).not.toMatch(/\n  started_at: \d{4}-\d{2}-\d{2}T/);
  });

  it('creates an in-scope Task and confirms a soft In Progress WIP excess', async () => {
    const firstTaskPath = 'Focus Flow/Tasks/FF-4 Outline the weekly review.md';
    let addedTaskPath = '';
    await browser.executeObsidianCommand('focus-flow:open-focus');

    await browser.$('[aria-label="Create Task for FF-42"]').click();
    const newTask = browser.$('[aria-label="New Task"]');
    await newTask.waitForEnabled();
    await newTask.setValue('Test narrow Focus board');
    const addTask = browser.$('button=Add Task');
    await addTask.waitForEnabled();
    await clickButton('.focus-flow__task-dialog-form button[type="submit"]');
    await browser.waitUntil(async () => {
      addedTaskPath = await browser.executeObsidian(({ app }) =>
        app.vault.getMarkdownFiles().find(
          (file) =>
            file.parent?.path === 'Focus Flow/Tasks' &&
            file.basename.endsWith('Test narrow Focus board'),
        )?.path ?? '',
      );
      return addedTaskPath !== '';
    });
    const addedTask = await readVaultFile(addedTaskPath);
    expect(addedTask).toContain('status: todo');
    const addedTaskKey = addedTask.match(/\n  key: (FF-\d+)\n/)?.[1];
    expect(addedTaskKey).toBeTruthy();

    await moveTask('FF-4', 'Today', 'todo');
    await browser.waitUntil(async () =>
      (await readVaultFile(firstTaskPath)).includes('status: today'),
    );
    await moveTask('FF-4', 'In Progress', 'today');
    await browser.waitUntil(async () =>
      (await readVaultFile(firstTaskPath)).includes('status: in_progress'),
    );
    const columnPicker = browser.$('[aria-label="Task column"]');
    if (await columnPicker.isExisting()) await columnPicker.selectByAttribute('value', 'in_progress');
    await browser.waitUntil(() =>
      browser.execute(() =>
        document
          .querySelector('[aria-label="Open FF-4 Outline the weekly review"]')
          ?.closest('.focus-flow__kanban-cell, .focus-flow__status-column')
          ?.getAttribute('aria-label')?.endsWith('In Progress tasks'),
      ),
    );

    await moveTask(addedTaskKey!, 'Today', 'todo');
    await browser.waitUntil(async () =>
      (await readVaultFile(addedTaskPath)).includes('status: today'),
    );
    if (await columnPicker.isExisting()) await columnPicker.selectByAttribute('value', 'today');
    await browser.waitUntil(() =>
      browser.execute(
        (key) =>
          document
            .querySelector(`[aria-label="Open ${key} Test narrow Focus board"]`)
            ?.closest('.focus-flow__kanban-cell, .focus-flow__status-column')
            ?.getAttribute('aria-label')?.endsWith('Today tasks'),
        addedTaskKey!,
      ),
    );
    await moveTask(addedTaskKey!, 'In Progress', 'today');
    const warning = browser.$('.focus-flow__move-message');
    await warning.waitForExist();
    await expect(warning).toHaveText(
      expect.stringContaining('exceeds its WIP limit by 1'),
    );
    await warning.$('button=Move anyway').click();
    await browser.waitUntil(async () =>
      (await readVaultFile(addedTaskPath)).includes('status: in_progress'),
    );
    expect(await readVaultFile(addedTaskPath)).toMatch(
      /\n  started_at: \d{4}-\d{2}-\d{2}T/,
    );
  });

  it('edits Task fields from Focus and reopens them in Plan without changing workflow state', async () => {
    await browser.executeObsidianCommand('focus-flow:open-focus');
    let addedTaskPath = await browser.executeObsidian(({ app }) => app.vault.getMarkdownFiles().find((file) => file.path.endsWith(' Test narrow Focus board.md'))!.path);
    const addedTaskKey = addedTaskPath.split('/').at(-1)!.split(' ')[0]!;
    const before = await readVaultFile(addedTaskPath);
    const properties = await browser.executeObsidian(({ obsidian }, content) => obsidian.parseYaml(content.split('---')[1]!) as { focus_flow: Record<string, unknown> }, before);
    const column = browser.$('[aria-label="Task column"]');
    if (await column.isExisting()) await column.selectByAttribute('value', 'in_progress');
    await browser.$(`[aria-label="More actions for ${addedTaskKey}"]`).waitForExist();
    await browser.$(`[aria-label="More actions for ${addedTaskKey}"]`).click();
    await clickMenuAction('Edit…');
    await browser.$('[role="dialog"] input[aria-label="Title"]').waitForEnabled();
    await browser.$('[role="dialog"] input[aria-label="Title"]').setValue('Verify a calmer Task editor');
    await browser.$('[role="dialog"] textarea[aria-label="Description"]').setValue('Keep **Markdown** context.');
    await browser.$('[role="dialog"] input[aria-label="Tags"]').setValue('task-editor');
    await browser.keys('Enter');
    await browser.$('button=Add criterion').click();
    await browser.$('[role="dialog"] textarea[aria-label="Criterion 1"]').setValue('Works with keyboard\n- And touch');
    await browser.$('button=Save changes').click();
    await browser.$('[role="dialog"]').waitForExist({ reverse: true });
    const editedPath = `Focus Flow/Tasks/${addedTaskKey} Verify a calmer Task editor.md`;
    await browser.waitUntil(async () => (await readVaultFile(editedPath)).includes('- [ ] Works with keyboard\n  - And touch'));
    const saved = await readVaultFile(editedPath);
    const afterProperties = await browser.executeObsidian(({ obsidian }, content) => obsidian.parseYaml(content.split('---')[1]!) as { focus_flow: Record<string, unknown>; tags: string[] }, saved);
    expect(afterProperties.focus_flow).toEqual(properties.focus_flow);
    expect(afterProperties.tags).toContain('task-editor');
    expect(saved).toContain('Keep **Markdown** context.');
    addedTaskPath = editedPath;
    await browser.executeObsidianCommand('focus-flow:open-plan');
    await browser.$('[aria-label="Expand FF-42"]').click();
    await browser.$(`[aria-label="Reorder ${addedTaskKey}"]`).click();
    await clickMenuAction('Edit…');
    await expect(browser.$('[aria-label="Description"]')).toHaveValue('Keep **Markdown** context.');
    await expect(browser.$('[aria-label="Criterion 1"]')).toHaveValue('Works with keyboard\n- And touch');
    await browser.$('[role="dialog"] input[aria-label="Title"]').waitForEnabled();
    await browser.$('[role="dialog"] input[aria-label="Title"]').setValue('Test narrow Focus board');
    await browser.$('button=Save changes').click();
    await browser.$('[role="dialog"]').waitForExist({ reverse: true });
    addedTaskPath = `Focus Flow/Tasks/${addedTaskKey} Test narrow Focus board.md`;
    await browser.waitUntil(async () => (await readVaultFile(addedTaskPath)).includes('Keep **Markdown** context.'));
  });

  it('edits typed Story criteria in Focus and defers the change to the Sprint Delta', async () => {
    const storyPath = 'Focus Flow/Stories/FF-42 Improve weekly focus.md';
    await browser.executeObsidianCommand('focus-flow:open-focus');
    await browser.$('[aria-label="Actions for FF-42"]').click();
    await clickMenuAction('Edit…');
    await browser.$('[aria-label="Criterion 1"]').setValue('Weekly priorities remain visible on narrow screens');
    await browser.$('button=Save changes').click();
    await browser.waitUntil(async () => (await readVaultFile(storyPath)).includes('Weekly priorities remain visible on narrow screens'));
    await expect(browser.$('[aria-label="Create Task for FF-42"]')).toExist();
  });

  it('evaluates, resumes an interrupted close, preserves reclassification history, and promotes an Improvement', async () => {
    const sprintPath = 'Focus Flow/Sprints/SPR-001.md';
    const archiveMonth = new Date().toISOString().slice(0, 7).replace('-', '/');
    const archivedSprintPath = `Focus Flow/Sprints/Archive/${archiveMonth}/SPR-001.md`;
    const achievedStoryPath = 'Focus Flow/Stories/FF-42 Improve weekly focus.md';
    const continuingStoryPath = 'Focus Flow/Stories/FF-46 Review consistently.md';
    const reclassifiedTaskPath =
      'Focus Flow/Tasks/FF-4 Outline the weekly review.md';
    await browser.executeObsidianCommand('focus-flow:open-focus');
    await browser.$('[aria-label="Review and close Sprint"]').click();
    await assertChildrenFit('.focus-flow__review-checklist button');
    await browser.$('button=Outcomes').click();
    await assertChildrenFit('.focus-flow__outcome-stories button');

    await browser.$('[aria-label="Outcome for FF-42"] button[data-outcome="achieved"]').click();
    await browser
      .$('[aria-label="Reflection for FF-42"]')
      .setValue('Verified the primary weekly flow');
    await browser
      .$('[aria-label="Acceptance Criteria exception for FF-42"]')
      .setValue('The narrow-screen wording remains provisional');
    await clickButton('[aria-label="Save evaluation for FF-42"]');
    await browser.waitUntil(async () =>
      (await readVaultFile(sprintPath)).includes(
        'acceptance_exception_reason: The narrow-screen wording remains provisional',
      ),
    );

    await browser.$('[aria-label="Review FF-46"]').click();
    await browser.$('[aria-label="Outcome for FF-46"] button[data-outcome="not_achieved"]').click();
    await expect(browser.$('[aria-label="Reflection for FF-46"]')).toHaveValue('');
    await clickButton('[aria-label="Save evaluation for FF-46"]');
    const monthPosition = browser.$('[aria-label="Month position for FF-46"]');
    await monthPosition.waitForExist();
    await monthPosition.selectByAttribute('value', '__end__');

    await browser.$('button=Tasks').click();

    const promotedResolution = browser.$('[aria-label="Resolution for FF-4"]');
    await promotedResolution.waitForExist();
    await browser.execute(() => {
      const select = document.querySelector<HTMLSelectElement>(
        '[aria-label="Resolution for FF-4"]',
      );
      if (select === null) throw new Error('FF-4 resolution was not found');
      select.value = 'reclassify';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const parentEpic = browser.$('[aria-label="Parent Epic for FF-4"]');
    await parentEpic.waitForExist();
    const firstEpicValue = await parentEpic.$('option:nth-child(2)').getAttribute('value');
    await parentEpic.selectByAttribute('value', firstEpicValue!);
    await browser.execute(() => {
      const resolutions = Array.from(
        document.querySelectorAll<HTMLSelectElement>(
          '[aria-label^="Resolution for "]',
        ),
      );
      const other = resolutions.find(
        (select) => select.getAttribute('aria-label') !== 'Resolution for FF-4',
      );
      if (other === undefined) throw new Error('Second Task resolution was not found');
      other.value = 'irrelevant';
      other.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await browser.executeObsidian(({ app }) => {
      const original = app.vault.process.bind(app.vault);
      let interrupted = false;
      app.vault.process = async (file, mutate) => {
        if (!interrupted && file.path.includes('/Tasks/')) {
          interrupted = true;
          app.vault.process = original;
          throw new Error('Simulated close interruption');
        }
        return original(file, mutate);
      };
    });
    await browser.$('button=Review').click();
    await clickButton('.focus-flow__close-navigation button:last-child');
    if (await browser.$('button=Close early').isExisting()) await browser.$('button=Close early').click();
    await browser.waitUntil(async () =>
      /pending_close:\s+operation_id:/.test(await readVaultFile(sprintPath)),
    );
    const obsidianPage = browser.getObsidianPage();
    await obsidianPage.disablePlugin('focus-flow');
    await obsidianPage.enablePlugin('focus-flow');
    await browser.executeObsidianCommand('focus-flow:open-focus');
    await browser.$('[aria-label="Review and close Sprint"]').click();
    const recovery = browser.$('.focus-flow__close-recovery');
    await recovery.waitForExist();
    await recovery.$('button=Inspect changes').click();
    await expect(recovery).toHaveText(expect.stringContaining('Operation'));
    await recovery.$('button=Resume close').click();
    await browser.waitUntil(async () =>
      /^  lifecycle: closed$/m.test(await readVaultFile(archivedSprintPath)),
    );
    await browser.$('.focus-flow__history').waitForExist();

    const promotedStoryPath = reclassifiedTaskPath.replace('/Tasks/', '/Stories/');
    const [sprint, achievedStory, continuingStory, promotedStory] =
      await Promise.all([
        readVaultFile(archivedSprintPath),
        readVaultFile(achievedStoryPath.replace('/Stories/', `/Stories/Archive/${new Date().toISOString().slice(0, 7).replace('-', '/')}/`)),
        readVaultFile(continuingStoryPath),
        readVaultFile(promotedStoryPath),
      ]);
    expect(sprint).toContain('lifecycle: closed');
    expect(sprint).not.toContain('pending_close:');
    expect(sprint).toContain('<!-- focus-flow:report:start -->');
    expect(sprint).toContain('### Sprint Delta');
    expect(sprint).toContain('Acceptance Criteria changed: FF-42 Improve weekly focus');
    expect(sprint).toContain('Task added:');
    expect(sprint).toContain('resolution: reclassify');
    expect(achievedStory).toContain('lifecycle: done');
    expect(achievedStory).toContain('outcome: achieved');
    expect(continuingStory).toContain('lifecycle: backlog');
    expect(continuingStory).not.toContain('sprint_id:');
    expect(promotedStory).toContain('type: story');
    expect(promotedStory).toContain('lifecycle: backlog');
    expect(promotedStory).toContain('Outline the weekly review');
    expect(await readVaultFile(reclassifiedTaskPath)).toBe('');

    await browser.executeObsidian(
      async ({ app, obsidian }, path) => {
        const file = app.vault.getAbstractFileByPath(path);
        if (!(file instanceof obsidian.TFile)) throw new Error('Sprint not found');
        await app.vault.process(file, (content) =>
          content.replace(
            '## Improvements',
            '## Improvements\n\n- Automate the close checklist',
          ),
        );
      },
      archivedSprintPath,
    );
    await browser.executeObsidianCommand('focus-flow:open-history');
    await browser.$('.focus-flow__report-detail > summary').waitForExist();
    await browser.execute(() => {
      document.querySelector<HTMLElement>(
        '.focus-flow__report-detail > summary',
      )?.click();
    });
    await clickButton('[aria-label="SPR-001"]');
    await browser.waitUntil(async () => (await activeVaultFile()) === archivedSprintPath);
    await browser.executeObsidianCommand('focus-flow:open-history');
    const reportDetail = browser.$('.focus-flow__report-detail > summary');
    await reportDetail.waitForExist();
    await browser.execute(() => {
      const summary = document.querySelector<HTMLElement>(
        '.focus-flow__report-detail > summary',
      );
      if (summary === null) throw new Error('History report details were not found.');
      summary.click();
    });
    const promote = browser.$(
      '[aria-label="Promote Automate the close checklist"]',
    );
    await promote.waitForExist();
    await clickButton('[aria-label="Promote Automate the close checklist"]');
    const candidatePath = await browser.waitUntil(
      () => browser.executeObsidian(({ app }) =>
        app.vault.getMarkdownFiles().find((file) =>
          file.parent?.path === 'Focus Flow/Inbox' &&
          file.basename.endsWith('Automate the close checklist'),
        )?.path ?? '',
      ),
      { timeoutMsg: 'Improvement Candidate was not created' },
    );
    expect(await readVaultFile(candidatePath)).toContain(
      'Source Sprint: [[SPR-001]]',
    );
  });

  it('mounts and disposes a Focus root in a pop-out leaf', async () => {
    await browser.executeObsidian(async ({ app }) => {
      const leaf = app.workspace.openPopoutLeaf();
      await leaf.setViewState({
        type: 'focus-flow',
        active: true,
        state: { mode: 'history' },
      });
    });
    await browser.waitUntil(() =>
      browser.executeObsidian(({ app }) =>
        app.workspace
          .getLeavesOfType('focus-flow')
          .some(
            (leaf) =>
              leaf.view.containerEl.ownerDocument !== document &&
              leaf.view.containerEl.querySelector('.focus-flow') !== null,
          ),
      ),
    );
    const result = await browser.executeObsidian(({ app }) => {
      const leaf = app.workspace
        .getLeavesOfType('focus-flow')
        .find((candidate) => candidate.view.containerEl.ownerDocument !== document);
      if (leaf === undefined) throw new Error('Pop-out Focus leaf was not found.');
      const rootCount = leaf.view.containerEl.querySelectorAll('.focus-flow').length;
      const inPopout = leaf.view.containerEl.ownerDocument !== document;
      leaf.detach();
      return {
        inPopout,
        rootCount,
        detachedRootCount:
          leaf.view.containerEl.querySelectorAll('.focus-flow').length,
      };
    });

    expect(result).toEqual({
      inPopout: true,
      rootCount: 1,
      detachedRootCount: 0,
    });
  });

  it('creates and edits a Candidate through Inbox, then moves the rejected note to recoverable trash', async () => {
    await browser.executeObsidianCommand('focus-flow:open-inbox');
    await browser.$('[aria-label="Capture Candidate"]').click();
    const dialog = browser.$('.modal-container');
    await expect(dialog).toHaveText(expect.stringContaining('New candidate'));
    await dialog.$('input[aria-label="Candidate title"]').waitForEnabled();
    await dialog.$('input[aria-label="Candidate title"]').setValue('Inbox editor smoke');
    await dialog.$('input[aria-label="Tags"]').setValue('ux-smoke');
    await dialog.$('input[aria-label="Tags"]').click();
    await browser.keys('Enter');
    await browser.$('button=Create Candidate').click();
    await browser.$('.modal-container').waitForExist({ reverse: true });
    await browser.waitUntil(async () => (await browser.executeObsidian(({ app }) => app.vault.getMarkdownFiles().some((file) => file.path.endsWith(' Inbox editor smoke.md')))));
    await browser.waitUntil(async () => (await readVaultFile('Focus Flow/TAGS.md')).includes('ux-smoke'));
    const path = await browser.executeObsidian(({ app }) => app.vault.getMarkdownFiles().find((file) => file.path.endsWith(' Inbox editor smoke.md'))!.path);
    const key = path.split('/').at(-1)!.split(' ')[0]!;
    const before = await readVaultFile(path);
    // Scroll the nested Obsidian leaf, not only the browser viewport.
    await browser.execute((itemKey) => {
      document.querySelector<HTMLElement>(`[aria-label="More actions for ${itemKey}"]`)?.scrollIntoView({ block: 'center' });
    }, key);
    await clickButton(`[aria-label="More actions for ${key}"]`);
    await clickMenuAction('Edit…');
    await expect(browser.$('[role="dialog"]')).toHaveText(expect.stringContaining(`Edit ${key}`));
    await browser.$('input[aria-label="Candidate title"]').waitForEnabled();
    await browser.$('input[aria-label="Candidate title"]').setValue('Inbox edited smoke');
    await browser.$('[aria-label="Remove tag ux-smoke"]').click();
    await browser.$('input[aria-label="Tags"]').setValue('edited-smoke');
    await browser.$('input[aria-label="Tags"]').click();
    await browser.keys('Enter');
    await browser.$('button=Save changes').click();
    await browser.$('[role="dialog"]').waitForExist({ reverse: true });
    const editedPath = path.replace(' Inbox editor smoke.md', ' Inbox edited smoke.md');
    await browser.waitUntil(async () => (await readVaultFile(editedPath)).includes('edited-smoke'));
    await browser.waitUntil(async () => (await readVaultFile('Focus Flow/TAGS.md')).includes('edited-smoke'));
    const edited = await readVaultFile(editedPath);
    expect(edited.match(/\n  id: ([^\n]+)/)?.[1]).toBe(before.match(/\n  id: ([^\n]+)/)?.[1]);
    expect(edited.split('---').slice(2).join('---')).toBe(before.split('---').slice(2).join('---'));
    expect(await readVaultFile(path)).toBe('');
    await clickButton(`[aria-label="More actions for ${key}"]`);
    await clickMenuAction('Reject');
    await browser.$(`[aria-label="Reject ${key}"]`).click();
    const rejectedPath = editedPath.replace('/Inbox/', '/Distractions/');
    await browser.waitUntil(async () => (await readVaultFile(rejectedPath)).includes('lifecycle: rejected'));
    await clickButton('[aria-label="Inbox section"] button:nth-child(2)');
    await clickButton(`[aria-label="More actions for ${key}"]`);
    await clickMenuAction('Move to trash…');
    await browser.$('button=Cancel').click();
    expect(await readVaultFile(rejectedPath)).toContain('lifecycle: rejected');
    await browser.executeObsidian(({ app }) => {
      (app.vault as typeof app.vault & { setConfig(key: string, value: string): void }).setConfig('trashOption', 'local');
    });
    await clickButton(`[aria-label="More actions for ${key}"]`);
    await clickMenuAction('Move to trash…');
    await browser.$('button=Move to trash').click();
    await browser.waitUntil(async () => (await readVaultFile(rejectedPath)) === '');
    expect(await browser.executeObsidian(async ({ app }, filename) => app.vault.adapter.exists(`.trash/${filename}`), rejectedPath.split('/').at(-1)!)).toBe(true);
    await clickButton('[aria-label="Inbox section"] button:nth-child(1)');
  });

  it('edits the tag catalog through Settings and recolors History without rewriting its snapshot', async () => {
    const archiveMonth = new Date().toISOString().slice(0, 7).replace('-', '/');
    const sprintPath = `Focus Flow/Sprints/Archive/${archiveMonth}/SPR-001.md`;
    const sprintBefore = await readVaultFile(sprintPath);
    await browser.executeObsidianCommand('focus-flow:open-history');
    await browser.$('[aria-label="Settings"]').click();
    await clickButton('[aria-label="Tags"][aria-expanded]');
    const row = browser.$('.focus-flow__tag-catalog-row');
    await row.waitForExist();
    await row.scrollIntoView({ block: 'center' });
    const label = await row.getAttribute('aria-description') ?? await row.getAttribute('aria-label');
    const tag = label!.replace('Edit #', '');
    await clickButton('.focus-flow__tag-catalog-row');
    await browser.$('[aria-label="Description"]').setValue('Used in the current focus area');
    await browser.$('button=Save description').click();
    await browser.$('[aria-label="Teal"]').click();
    await browser.waitUntil(async () => (await readVaultFile('Focus Flow/TAGS.md')).includes('#0F766E'));
    expect(await readVaultFile('Focus Flow/TAGS.md')).toContain('Used in the current focus area');
    await browser.$('button=History').click();
    expect(await readVaultFile(sprintPath)).toBe(sprintBefore);
    await browser.executeObsidian(async ({ app, obsidian }, name) => {
      const file = app.vault.getAbstractFileByPath('Focus Flow/TAGS.md');
      if (!(file instanceof obsidian.TFile)) throw new Error('Tag Catalog missing');
      await app.vault.process(file, (content) => `${content.replace('#0F766E', '#6750A4')}\nMy catalog notes for ${name}.\n`);
    }, tag);
    await browser.$('[aria-label="Settings"]').click();
    const tagsToggle = browser.$('[aria-label="Tags"][aria-expanded]');
    if (await tagsToggle.getAttribute('aria-expanded') !== 'true') {
      await clickButton('[aria-label="Tags"][aria-expanded]');
    }
    await browser.waitUntil(async () => browser.execute((expectedTag) => Array.from(document.querySelectorAll<HTMLButtonElement>('.focus-flow__tag-catalog-row')).some((candidate) => candidate.textContent?.includes(`#${expectedTag}`)), tag));
    await browser.execute((expectedTag) => {
      const row = Array.from(document.querySelectorAll<HTMLButtonElement>('.focus-flow__tag-catalog-row')).find((candidate) => candidate.textContent?.includes(`#${expectedTag}`));
      if (row === undefined) throw new Error(`Tag catalog row was not found for #${expectedTag}`);
      row.click();
    }, tag);
    await browser.$('[aria-label="Blue"]').click();
    await browser.waitUntil(async () => (await readVaultFile('Focus Flow/TAGS.md')).includes('#2563EB'));
    expect(await readVaultFile('Focus Flow/TAGS.md')).toContain('My catalog notes');
  });

  it('prepares a Draft after Close, explains the occupied window, and reopens only after explicit Draft cancellation', async () => {
    await browser.executeObsidianCommand('focus-flow:open-plan');
    await browser.$('button=Create Draft Sprint').click();
    await browser.$('button=Start Sprint').waitForExist();
    await expect(browser.$('button=Start Sprint')).toBeDisabled();
    await expect(browser.$('.focus-flow__sprint-readiness')).toHaveText(expect.stringContaining('already used'));
    await browser.$('button=History').click();
    await browser.$('button=Reopen SPR-001').waitForExist();
    await expect(browser.$('button=Reopen SPR-001')).toBeDisabled();
    await expect(browser.$('.focus-flow__reopen-sprint')).toHaveText(expect.stringContaining('Cancel the Draft'));
    await browser.$('button=Plan').click();
    await browser.$('button=Cancel Draft Sprint').click();
    await browser.$('button=Create Draft Sprint').waitForExist();
    await browser.$('button=History').click();
    await browser.$('button=Reopen SPR-001').click();
    await browser.$('[role="dialog"]').$('button=Reopen Sprint').waitForExist();
    await browser.$('[role="dialog"]').$('button=Reopen Sprint').click();
    await browser.waitUntil(async () => /^  lifecycle: active$/m.test(await readVaultFile('Focus Flow/Sprints/SPR-001.md')));
    const sprint = await readVaultFile('Focus Flow/Sprints/SPR-001.md');
    expect(sprint).not.toContain('close_snapshot:');
    expect(sprint).not.toContain('reopen_recovery:');
    expect(sprint).not.toContain('focus-flow:report:start');
    expect(await readVaultFile('Focus Flow/Tasks/FF-4 Outline the weekly review.md')).toContain('type: task');
    expect(await readVaultFile('Focus Flow/Stories/FF-42 Improve weekly focus.md')).toContain('lifecycle: active_sprint');
    await browser.$('button=Focus').click();
    await browser.$('.focus-flow__focus-board').waitForExist();

    const rootSprintPath = 'Focus Flow/Sprints/SPR-001.md';
    const previousArchiveMonth = new Date().toISOString().slice(0, 7).replace('-', '/');
    const previousArchivedPath = `Focus Flow/Sprints/Archive/${previousArchiveMonth}/SPR-001.md`;
    const reclosedPath = 'Focus Flow/Sprints/Archive/2030/10/SPR-001.md';
    const sprintId = (await readVaultFile(rootSprintPath)).match(/\n  id: ([^\n]+)/)?.[1];
    expect(sprintId).toBeTruthy();
    await browser.execute((iso) => {
      const scope = globalThis as typeof globalThis & {
        __focusFlowRealDate?: DateConstructor;
      };
      scope.__focusFlowRealDate ??= Date;
      const NativeDate = scope.__focusFlowRealDate;
      const FixedDate = new Proxy(NativeDate, {
        construct(target, args) {
          return Reflect.construct(target, args.length === 0 ? [iso] : args);
        },
      });
      Object.defineProperty(FixedDate, 'now', {
        value: () => NativeDate.parse(iso),
      });
      Object.defineProperty(globalThis, 'Date', {
        configurable: true,
        writable: true,
        value: FixedDate,
      });
    }, '2030-10-15T12:00:00+04:00');
    try {
      await clickButton('[aria-label="Review and close Sprint"]');
      await browser.$('button=Outcomes').click();
      await browser.$('[aria-label="Review FF-46"]').click();
      await browser.$('[aria-label="Month position for FF-46"]').selectByAttribute('value', '__end__');
      await browser.$('button=Tasks').click();
      await browser.execute(() => {
        const resolutions = Array.from(
          document.querySelectorAll<HTMLSelectElement>('[aria-label^="Resolution for "]'),
        );
        for (const select of resolutions) {
          select.value = select.getAttribute('aria-label') === 'Resolution for FF-4'
            ? 'reclassify'
            : 'irrelevant';
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
      const parentEpic = browser.$('[aria-label="Parent Epic for FF-4"]');
      await parentEpic.waitForExist();
      const parentEpicId = await parentEpic.$('option:nth-child(2)').getAttribute('value');
      await parentEpic.selectByAttribute('value', parentEpicId!);
      await browser.$('button=Review').click();
      await clickButton('.focus-flow__close-navigation button:last-child');
      await browser.waitUntil(async () =>
        /^  lifecycle: closed$/m.test(await readVaultFile(reclosedPath)),
      );
      await browser.$('.focus-flow__history').waitForExist();
      const reclosedSprint = await readVaultFile(reclosedPath);
      expect(reclosedSprint.match(/\n  id: ([^\n]+)/)?.[1]).toBe(sprintId);
      expect(reclosedSprint).toContain('closed_at: 2030-10-15T08:00:00.000Z');
      expect(await readVaultFile(rootSprintPath)).toBe('');
      expect(await readVaultFile(previousArchivedPath)).toBe('');
    } finally {
      await browser.execute(() => {
        const scope = globalThis as typeof globalThis & {
          __focusFlowRealDate?: DateConstructor;
        };
        if (scope.__focusFlowRealDate === undefined) return;
        Object.defineProperty(globalThis, 'Date', {
          configurable: true,
          writable: true,
          value: scope.__focusFlowRealDate,
        });
        delete scope.__focusFlowRealDate;
      });
    }
  });

  it('organizes legacy terminal notes from an explicit preview and then reports an empty preview', async () => {
    await browser.$('[aria-label="Settings"]').click();
    await browser.$('[aria-label="Review terminal notes"]').click();
    await browser.$('[role="dialog"]').waitForExist();
    const organize = browser.$('button=Organize notes');
    if (await organize.isEnabled()) {
      await organize.click();
      await browser.$('[role="dialog"]').waitForExist({ reverse: true });
      await browser.$('[aria-label="Review terminal notes"]').click();
    }
    await expect(browser.$('[role="dialog"]')).toHaveText(expect.stringContaining('Everything is already in place'));
    await browser.$('[aria-label="Close dialog"]').click();
  });

  it('reacts to external create, modify, rename, and delete events', async () => {
    const originalPath = 'Focus Flow/Inbox/FF-9000 External signal.md';
    const renamedPath = 'Focus Flow/Inbox/FF-9000 External signal renamed.md';
    const validContent = `---
focus_flow:
  schema_version: 1
  id: 01990000-0000-7000-8000-000000009000
  key: FF-9000
  type: candidate
  lifecycle: inbox
  created_at: 2026-08-31T12:00:00+04:00
tags:
  - external/edit
---
# External signal
`;
    await browser.executeObsidianCommand('focus-flow:open-inbox');
    const vaultRoot = await browser.executeObsidian(({ app }) =>
      (
        app.vault.adapter as typeof app.vault.adapter & {
          getBasePath(): string;
        }
      ).getBasePath(),
    );
    const originalAbsolutePath = join(vaultRoot, originalPath);
    await browser.executeObsidian(
      async ({ app, obsidian }, [path, content]) => {
        const existing = app.vault.getAbstractFileByPath(path);
        if (existing instanceof obsidian.TFile) await app.vault.delete(existing);
        await app.vault.create(path, content);
      },
      [originalPath, validContent] as const,
    );
    const externalCandidate = browser.$(
      '[aria-label="Open FF-9000 External signal"]',
    );
    await externalCandidate.waitForExist({
      timeoutMsg: 'External Candidate was not indexed',
    });
    await openAttention();
    await browser.$('[aria-label="Add #external/edit to catalog"]').click();
    await browser.waitUntil(async () => (await readVaultFile('Focus Flow/TAGS.md')).includes('external/edit'));
    expect(await readVaultFile(originalPath)).toBe(validContent);
    if (await browser.$('[aria-label="Close dialog"]').isExisting()) await browser.$('[aria-label="Close dialog"]').click();

    await writeFile(
      originalAbsolutePath,
      validContent.replace('lifecycle: inbox', 'lifecycle: backlog'),
    );
    await browser.executeObsidian(
      ({ app, obsidian }, path) => {
        const file = app.vault.getAbstractFileByPath(path);
        if (!(file instanceof obsidian.TFile)) throw new Error('External file missing.');
        app.vault.trigger('modify', file);
      },
      originalPath,
    );
    await openAttention();
    await browser
      .$(`.focus-flow__diagnostic-path=${originalPath}`)
      .waitForExist();

    await writeFile(originalAbsolutePath, validContent);
    await browser.executeObsidian(
      ({ app, obsidian }, path) => {
        const file = app.vault.getAbstractFileByPath(path);
        if (!(file instanceof obsidian.TFile)) throw new Error('External file missing.');
        app.vault.trigger('modify', file);
      },
      originalPath,
    );
    await browser
      .$('[aria-label="Open FF-9000 External signal"]')
      .waitForExist();
    await browser.executeObsidian(
      async ({ app, obsidian }, [from, to]) => {
        const file = app.vault.getAbstractFileByPath(from);
        if (!(file instanceof obsidian.TFile)) throw new Error('External file missing.');
        await app.fileManager.renameFile(file, to);
      },
      [originalPath, renamedPath] as const,
    );
    await browser
      .$('[aria-label="Open FF-9000 External signal renamed"]')
      .waitForExist();

    await browser.executeObsidian(
      async ({ app, obsidian }, path) => {
        const file = app.vault.getAbstractFileByPath(path);
        if (!(file instanceof obsidian.TFile)) throw new Error('Renamed file missing.');
        await app.vault.delete(file);
      },
      renamedPath,
    );
    await browser.waitUntil(
      async () =>
        !(await browser
          .$('[aria-label="Open FF-9000 External signal renamed"]')
          .isExisting()),
    );
  });
});
