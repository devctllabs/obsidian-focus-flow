import { browser, expect } from '@wdio/globals';
import { describe, it } from 'mocha';

async function readVaultFile(path: string): Promise<string> {
  return browser.executeObsidian(
    async ({ app, obsidian }, filePath) => {
      const file = app.vault.getAbstractFileByPath(filePath);
      return file instanceof obsidian.TFile ? app.vault.cachedRead(file) : '';
    },
    path,
  );
}

async function clickButton(selector: string): Promise<void> {
  await browser.$(selector).waitForExist();
  await browser.execute((buttonSelector) => {
    const button = buttonSelector.startsWith('button=')
      ? Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
          .find((candidate) => candidate.textContent?.trim() === buttonSelector.slice(7))
      : document.querySelector<HTMLElement>(buttonSelector) ?? undefined;
    if (button === undefined) throw new Error(`Control was not found: ${buttonSelector}`);
    button.click();
  }, selector);
}

describe('Focus Flow mobile-compatible path', () => {
  it('sets up on first use, renders without DnD, and survives plugin reload', async () => {
    await browser.executeObsidianCommand('focus-flow:open-focus');
    await expect(browser.$('.modal-title')).toHaveText('Set up Focus Flow');
    // Obsidian animates the mobile modal into place; a tap during that motion
    // can miss even though the button is already displayed and enabled.
    await browser.executeAsync((done) => {
      const animations = document.querySelector('.modal-container')?.getAnimations({ subtree: true }) ?? [];
      void Promise.all(animations.map((animation) => animation.finished.catch(() => undefined))).then(() => done());
    });
    await browser.$('button=Review setup').click();
    await expect(browser.$('button=Use this workspace')).toBeDisplayed();
    await expect(browser.$('button=Use this workspace')).toBeEnabled();
    await browser.$('button=Use this workspace').click();

    await expect(browser.$('.focus-flow__focus-board h1')).toHaveText('SPR-001');
    await expect(browser.$('.focus-flow__mobile-board')).toExist();
    expect(await browser.$$('.focus-flow__board-table')).toHaveLength(0);
    expect(await browser.$$('[aria-label^="Drag "]')).toHaveLength(0);
    expect(
      await browser.executeObsidian(({ obsidian }) => ({
        desktopUi: obsidian.Platform.isDesktop,
        mobileUi: obsidian.Platform.isMobile,
        desktopApp: obsidian.Platform.isDesktopApp,
        mobileApp: obsidian.Platform.isMobileApp,
      })),
    ).toEqual({
      desktopUi: false,
      mobileUi: true,
      desktopApp: true,
      mobileApp: false,
    });

    await browser.$('[aria-label="Task column"]').selectByAttribute('value', 'today');
    await expect(
      browser.$(
        '[aria-label="Open FF-43 Verify the mobile flow with a very long identifier-2026-08-31"]',
      ),
    ).toExist();

    const obsidianPage = browser.getObsidianPage();
    await obsidianPage.disablePlugin('focus-flow');
    await browser.waitUntil(
      async () => (await browser.$$('.focus-flow').length) === 0,
    );
    await obsidianPage.enablePlugin('focus-flow');
    await browser.executeObsidianCommand('focus-flow:open-focus');
    await browser.waitUntil(
      async () => (await browser.$$('.focus-flow__mobile-board').length) === 1,
    );

    const roots = await browser.executeObsidian(({ app }) => ({
      connected: Array.from(document.querySelectorAll('.focus-flow')).filter(
        (root) => root.isConnected,
      ).length,
      leaves: app.workspace.getLeavesOfType('focus-flow').length,
    }));
    expect(roots).toEqual({ connected: 1, leaves: 1 });

    await clickButton('[aria-label="Review and close Sprint"]');
    await clickButton('button=Outcomes');
    await clickButton('[aria-label="Outcome for FF-42"] button[data-outcome="not_achieved"]');
    await clickButton('[aria-label="Save evaluation for FF-42"]');
    await browser.$('[aria-label="Month position for FF-42"]').selectByAttribute('value', '__end__');
    await clickButton('button=Tasks');
    await browser.$('[aria-label="Resolution for FF-43"]').selectByAttribute('value', 'irrelevant');
    await clickButton('button=Review');
    await clickButton('.focus-flow__close-navigation button:last-child');
    if (await browser.$('button=Close early').isExisting()) {
      await clickButton('button=Close early');
    }

    const archiveMonth = new Date().toISOString().slice(0, 7).replace('-', '/');
    const archivedPath = `Focus Flow/Sprints/Archive/${archiveMonth}/SPR-001.md`;
    await browser.waitUntil(async () =>
      /^  lifecycle: closed$/m.test(await readVaultFile(archivedPath)),
    );
    await browser.$('.focus-flow__history').waitForExist();
    await browser.executeObsidianCommand('focus-flow:open-history');
    await clickButton('.focus-flow__report-detail > summary');
    await clickButton('[aria-label="SPR-001"]');
    await browser.waitUntil(async () =>
      (await browser.executeObsidian(({ app }) => app.workspace.getActiveFile()?.path)) === archivedPath,
    );

    await browser.executeObsidianCommand('focus-flow:open-history');
    await clickButton('button=Reopen SPR-001');
    await clickButton('button=Reopen Sprint');
    await browser.waitUntil(async () =>
      /^  lifecycle: active$/m.test(
        await readVaultFile('Focus Flow/Sprints/SPR-001.md'),
      ),
    );
    expect(await readVaultFile(archivedPath)).toBe('');

    const rootSprintPath = 'Focus Flow/Sprints/SPR-001.md';
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
      await clickButton('button=Focus');
      await clickButton('[aria-label="Review and close Sprint"]');
      await clickButton('button=Outcomes');
      await browser.$('[aria-label="Month position for FF-42"]').selectByAttribute('value', '__end__');
      await clickButton('button=Tasks');
      await browser.$('[aria-label="Resolution for FF-43"]').selectByAttribute('value', 'irrelevant');
      await clickButton('button=Review');
      await clickButton('.focus-flow__close-navigation button:last-child');
      await browser.waitUntil(async () =>
        /^  lifecycle: closed$/m.test(await readVaultFile(reclosedPath)),
      );
      await browser.$('.focus-flow__history').waitForExist();
      const reclosedSprint = await readVaultFile(reclosedPath);
      expect(reclosedSprint.match(/\n  id: ([^\n]+)/)?.[1]).toBe(sprintId);
      expect(reclosedSprint).toContain('closed_at: 2030-10-15T08:00:00.000Z');
      expect(await readVaultFile(rootSprintPath)).toBe('');
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
});
