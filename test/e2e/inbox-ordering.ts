import { browser, expect } from '@wdio/globals';

export async function verifyInboxOrdering(dragEnabled: boolean): Promise<void> {
  const closeDialog = browser.$('[aria-label="Close dialog"]');
  if (await closeDialog.isExisting()) await closeDialog.click();
  await browser.$('.focus-flow__dialog-backdrop').waitForExist({ reverse: true });
  const first = { key: 'FF-98001', title: 'First Inbox order probe', id: '01994780-0000-7000-8000-000000009801' };
  const second = { key: 'FF-98002', title: 'Second Inbox order probe', id: '01994780-0000-7000-8000-000000009802' };
  await browser.executeObsidian(async ({ app }, notes) => {
    if (!app.vault.getAbstractFileByPath('Focus Flow/Inbox')) await app.vault.createFolder('Focus Flow/Inbox');
    for (const note of notes) await app.vault.create(`Focus Flow/Inbox/${note.key} ${note.title}.md`, `---\nfocus_flow:\n  schema_version: 1\n  id: ${note.id}\n  key: ${note.key}\n  type: candidate\n  lifecycle: inbox\n  created_at: 2030-01-01T00:00:00Z\n---\n\n## Description\n\nInbox order evidence.\n`);
  }, [first, second]);
  await browser.executeObsidianCommand('focus-flow:open-inbox');
  await browser.$('[aria-label="Refresh notes"]').click();
  await browser.$(`[aria-label="More actions for ${second.key}"]`).waitForExist();
  expect((await order()).indexOf(first.title)).toBeLessThan((await order()).indexOf(second.title));
  const initial = await content(first.key, first.title);
  expect(initial).not.toContain('inbox_rank');
  const handleCount = await browser.$$('[aria-label^="Drag "]').length;
  expect(handleCount > 0).toBe(dragEnabled);

  await move(second.key, 'Move to top');
  await browser.waitUntil(async () => (await order())[0] === second.title);
  expect(await content(first.key, first.title)).toBe(initial);
  await move(first.key, 'Move to top');
  await browser.waitUntil(async () => (await order())[0] === first.title);
  await move(first.key, 'Move to bottom');
  await browser.waitUntil(async () => (await order()).at(-1) === first.title);
  const savedOrder = await order();
  const saved = await content(first.key, first.title);
  expect(saved).toContain('inbox_rank:');
  expect(saved).toContain('Inbox order evidence.');

  const obsidian = browser.getObsidianPage();
  await obsidian.disablePlugin('focus-flow');
  await obsidian.enablePlugin('focus-flow');
  await browser.executeObsidianCommand('focus-flow:open-inbox');
  await browser.waitUntil(async () => JSON.stringify(await order()) === JSON.stringify(savedOrder));
  expect(await content(first.key, first.title)).toBe(saved);

  const search = browser.$('[aria-label="Search Candidates"]');
  await search.setValue('Inbox order probe');
  expect(await browser.$$('[aria-label^="Drag "]')).toHaveLength(0);
  await openMenu(first.key);
  await expect(browser.$('.focus-flow__popover-menu').$('button=Move up')).not.toExist();
  await expect(browser.$('.focus-flow__popover-menu').$('button=Move down')).not.toExist();
  await clickMenuAction('Move to top');
  await clearSearch();
  await browser.waitUntil(async () => (await order())[0] === first.title);
  await verifyDistractionOrdering(dragEnabled);
}

async function verifyDistractionOrdering(dragEnabled: boolean): Promise<void> {
  const inboxOrder = await order();
  const older = { key: 'FF-98003', title: 'Older Distraction order probe', id: '01994780-0000-7000-8000-000000009803', rejectedAt: '2030-01-01T00:00:00Z' };
  const newer = { key: 'FF-98004', title: 'Newer Distraction order probe', id: '01994780-0000-7000-8000-000000009804', rejectedAt: '2030-01-02T00:00:00Z' };
  await browser.executeObsidian(async ({ app }, notes) => {
    if (!app.vault.getAbstractFileByPath('Focus Flow/Distractions')) await app.vault.createFolder('Focus Flow/Distractions');
    for (const note of notes) await app.vault.create(`Focus Flow/Distractions/${note.key} ${note.title}.md`, `---\nfocus_flow:\n  schema_version: 1\n  id: ${note.id}\n  key: ${note.key}\n  type: candidate\n  lifecycle: rejected\n  created_at: 2029-12-31T00:00:00Z\n  rejected_at: ${note.rejectedAt}\n---\n\nDistraction order evidence.\n`);
  }, [older, newer]);
  await browser.$('[aria-label="Inbox section"]').$('button*=Distractions').click();
  await browser.$('[aria-label="Refresh notes"]').click();
  await browser.$(`[aria-label="More actions for ${older.key}"]`).waitForExist();
  expect((await order()).indexOf(newer.title)).toBeLessThan((await order()).indexOf(older.title));
  const initial = await content(newer.key, newer.title, 'Distractions');
  expect(initial).not.toContain('distraction_rank:');
  expect((await browser.$$('[aria-label^="Drag "]').length) > 0).toBe(dragEnabled);

  await move(older.key, 'Move to top');
  await browser.waitUntil(async () => (await order())[0] === older.title);
  expect(await content(newer.key, newer.title, 'Distractions')).toBe(initial);
  await move(older.key, 'Move to bottom');
  await browser.waitUntil(async () => (await order()).at(-1) === older.title);
  const savedOrder = await order();
  const saved = await content(older.key, older.title, 'Distractions');
  expect(saved).toContain('distraction_rank:');
  expect(saved).not.toContain('inbox_rank:');
  expect(saved).toContain('Distraction order evidence.');
  const obsidian = browser.getObsidianPage();
  await obsidian.disablePlugin('focus-flow');
  await obsidian.enablePlugin('focus-flow');
  await browser.executeObsidianCommand('focus-flow:open-inbox');
  await browser.$('[aria-label="Inbox section"]').$('button*=Distractions').click();
  await browser.waitUntil(async () => JSON.stringify(await order()) === JSON.stringify(savedOrder));
  expect(await content(older.key, older.title, 'Distractions')).toBe(saved);

  const search = browser.$('[aria-label="Search Distractions"]');
  await search.setValue('Distraction order probe');
  expect(await browser.$$('[aria-label^="Drag "]')).toHaveLength(0);
  await openMenu(older.key);
  await expect(browser.$('.focus-flow__popover-menu').$('button=Move up')).not.toExist();
  await clickMenuAction('Move to top');
  await clearSearch();
  await browser.waitUntil(async () => (await order())[0] === older.title);
  await browser.$('[aria-label="Inbox section"]').$('button*=Candidates').click();
  await browser.waitUntil(async () => JSON.stringify(await order()) === JSON.stringify(inboxOrder));
}

async function clearSearch(): Promise<void> {
  const search = browser.$('.focus-flow__inbox input[type="search"]');
  await search.click();
  await browser.keys(['Control', 'a']);
  await browser.keys('Backspace');
  await expect(search).toHaveValue('');
}

async function order(): Promise<string[]> {
  return browser.execute(() => Array.from(document.querySelectorAll('.focus-flow__inbox .focus-flow__work-list h2')).map((heading) => heading.getAttribute('aria-label')!));
}

async function content(key: string, title: string, folder: 'Inbox' | 'Distractions' = 'Inbox'): Promise<string> {
  return browser.executeObsidian(async ({ app, obsidian }, path) => {
    const file = app.vault.getAbstractFileByPath(path);
    return file instanceof obsidian.TFile ? app.vault.read(file) : '';
  }, `Focus Flow/${folder}/${key} ${title}.md`);
}

async function openMenu(key: string): Promise<void> {
  await browser.execute((label) => {
    const button = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find((item) => item.getAttribute('aria-label') === label);
    if (!button) throw new Error(`Menu trigger not found: ${label}`);
    button.scrollIntoView({ block: 'center', behavior: 'instant' });
    button.focus();
  }, `More actions for ${key}`);
  await browser.keys('Enter');
}

async function clickMenuAction(label: string): Promise<void> {
  const button = browser.$('.focus-flow__popover-menu').$(`button=${label}`);
  await button.waitForEnabled();
  await button.click();
}

async function move(key: string, action: string): Promise<void> {
  await openMenu(key);
  await clickMenuAction(action);
}
