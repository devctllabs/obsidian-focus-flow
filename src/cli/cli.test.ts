import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runCli, type CliIo } from './main';

const firstId = '01990000-0000-7000-8000-000000000001';
const secondId = '01990000-0000-7000-8000-000000000002';

describe('Focus Flow CLI', () => {
  it('creates a Candidate and emits one JSON document', async () => {
    const vault = await createVault();
    const output: string[] = [];

    const exitCode = await runCli(
      ['create', 'candidate', '--vault', vault, '--title', 'Capture friction', '--json'],
      io(output, output),
    );

    expect(exitCode, output.join('')).toBe(0);
    expect(JSON.parse(output.join(''))).toMatchObject({
      ok: true,
      command: 'create candidate',
      entity: { id: firstId, key: 'FF-1', title: 'Capture friction' },
    });
    const candidate = await readFile(
      join(vault, 'Focus Flow/Inbox/FF-1 Capture friction.md'),
      'utf8',
    );
    expect(candidate).toContain('## Description');
    expect(candidate).not.toContain('# Capture friction');
  });

  it('creates a Task under the unique Story selected by FF key', async () => {
    const vault = await createVault();
    await writeManaged(
      vault,
      'Stories/FF-7 Ship the smallest slice.md',
      storyNote('FF-7'),
    );
    const output: string[] = [];

    const exitCode = await runCli(
      ['create', 'task', '--vault', vault, '--story', 'FF-7', '--title', 'Verify CLI'],
      io(output, output),
    );

    expect(exitCode, output.join('')).toBe(0);
    expect(output.join('')).toContain('Created Task FF-8');
    const task = await readFile(
      join(vault, 'Focus Flow/Tasks/FF-8 Verify CLI.md'),
      'utf8',
    );
    expect(task).toContain(`story_id: ${secondId}`);
    expect(task).toContain('story_link: "[[Focus Flow/Stories/FF-7 Ship the smallest slice]]"');
  });

  it('reports consistency diagnostics without treating missing MISSION.md as an error', async () => {
    const vault = await createVault();
    await writeManaged(vault, 'Inbox/FF-1 First.md', candidateNote(firstId, 'FF-1'));
    await writeManaged(vault, 'Inbox/FF-1 Duplicate.md', candidateNote(secondId, 'FF-1'));
    const output: string[] = [];

    const exitCode = await runCli(
      ['check', '--vault', vault, '--json'],
      io(output),
    );

    const result = JSON.parse(output.join('')) as {
      ok: boolean;
      diagnostics: Array<{ code: string; severity: string }>;
    };
    expect(exitCode).toBe(1);
    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'duplicate-key', severity: 'error' }),
        expect.objectContaining({ code: 'missing-mission', severity: 'warning' }),
      ]),
    );
  });

  it('exits zero when check finds only a transition-timestamp warning', async () => {
    const vault = await createVault();
    await writeManaged(vault, 'MISSION.md', '# Mission\n');
    await writeManaged(vault, 'Epics/FF-6 Epic.md', epicNote());
    await writeManaged(
      vault,
      'Stories/FF-7 Ship the smallest slice.md',
      storyNote('FF-7'),
    );
    await writeManaged(vault, 'Tasks/FF-8 Verify CLI.md', taskNote());
    const output: string[] = [];

    const exitCode = await runCli(
      ['check', '--vault', vault, '--json'],
      io(output),
    );

    expect(exitCode).toBe(0);
    expect(JSON.parse(output.join(''))).toMatchObject({
      ok: true,
      diagnostics: [{
        code: 'missing-transition-timestamp',
        severity: 'warning',
      }],
    });
  });

  it('reports Tag Catalog diagnostics as warnings without failing check', async () => {
    const vault = await createVault();
    await writeManaged(vault, 'MISSION.md', '# Mission\n');
    await writeManaged(
      vault,
      'Inbox/FF-1 Tagged.md',
      candidateNote(firstId, 'FF-1', ['area/focus']),
    );
    await writeManaged(
      vault,
      'TAGS.md',
      '---\nfocus_flow: [broken\n---\n',
    );
    const output: string[] = [];

    const exitCode = await runCli(
      ['check', '--vault', vault, '--json'],
      io(output),
    );

    const result = JSON.parse(output.join('')) as {
      ok: boolean;
      diagnostics: Array<{
        code: string;
        path: string;
        severity: string;
      }>;
    };
    expect(exitCode).toBe(0);
    expect(result.ok).toBe(true);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'invalid-tag-catalog',
          path: 'Focus Flow/TAGS.md',
          severity: 'warning',
        }),
        expect.objectContaining({
          code: 'uncataloged-tag',
          path: 'Focus Flow/Inbox/FF-1 Tagged.md',
          severity: 'warning',
        }),
      ]),
    );
    expect(output.join('')).not.toContain(vault);
  });

  it('accepts an exact Cataloged Tag on current work', async () => {
    const vault = await createVault();
    await writeManaged(vault, 'MISSION.md', '# Mission\n');
    await writeManaged(
      vault,
      'Inbox/FF-1 Tagged.md',
      candidateNote(firstId, 'FF-1', ['area/focus']),
    );
    await writeManaged(
      vault,
      'TAGS.md',
      `---
focus_flow:
  schema_version: 1
  type: tag_catalog
  tags:
    area/focus: {}
---
Use the narrowest relevant tag.
`,
    );
    const output: string[] = [];

    const exitCode = await runCli(
      ['check', '--vault', vault, '--json'],
      io(output),
    );

    expect(exitCode).toBe(0);
    expect(JSON.parse(output.join(''))).toMatchObject({
      ok: true,
      command: 'check',
      diagnostics: [],
    });
  });

  it('does not expose note bodies or absolute vault paths in diagnostics', async () => {
    const vault = await createVault();
    await writeManaged(vault, 'MISSION.md', '# Mission\n');
    await writeManaged(
      vault,
      'Tasks/FF-8 Broken.md',
      `---\nfocus_flow:\n  schema_version: 1\n  type: task\n---\nPRIVATE BODY SENTINEL\n`,
    );
    const output: string[] = [];

    const exitCode = await runCli(
      ['check', '--vault', vault, '--json'],
      io(output),
    );

    expect(exitCode).toBe(1);
    expect(output.join('')).not.toContain('PRIVATE BODY SENTINEL');
    expect(output.join('')).not.toContain(vault);
  });

  it('fails check when the configured root cannot be read safely', async () => {
    const vault = await createVault();
    await writeFile(
      join(vault, '.obsidian/plugins/focus-flow/data.json'),
      JSON.stringify({ rootFolder: '../outside-vault' }),
    );
    const output: string[] = [];

    const exitCode = await runCli(
      ['check', '--vault', vault, '--json'],
      io(output),
    );

    expect(exitCode).toBe(1);
    expect(JSON.parse(output.join(''))).toMatchObject({
      ok: false,
      command: 'check',
      error: 'Focus Flow could not read managed notes.',
    });
  });

  it('returns usage exit code 2 for an unknown command', async () => {
    const output: string[] = [];
    const errors: string[] = [];

    const exitCode = await runCli(['move', 'task'], io(output, errors));

    expect(exitCode).toBe(2);
    expect(errors.join('')).toContain('Usage: focus-flow');
  });
});

function io(output: string[], errors: string[] = []): CliIo {
  let sequence = 0;
  return {
    stdout: (value) => output.push(value),
    stderr: (value) => errors.push(value),
    now: () => '2026-09-02T10:00:00+04:00',
    nextId: () => [firstId, secondId][sequence++] ?? secondId,
  };
}

async function createVault(): Promise<string> {
  const vault = await mkdtemp(join(tmpdir(), 'focus-flow-cli-'));
  await mkdir(join(vault, '.obsidian/plugins/focus-flow'), { recursive: true });
  await writeFile(
    join(vault, '.obsidian/plugins/focus-flow/data.json'),
    JSON.stringify({ rootFolder: 'Focus Flow' }),
  );
  return vault;
}

async function writeManaged(
  vault: string,
  relativePath: string,
  content: string,
): Promise<void> {
  const path = join(vault, 'Focus Flow', relativePath);
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, content);
}

function candidateNote(
  id: string,
  key: string,
  tags: readonly string[] = [],
): string {
  return `---
${tags.length > 0 ? `tags: ${JSON.stringify(tags)}\n` : ''}\
focus_flow:
  schema_version: 1
  id: ${id}
  key: ${key}
  type: candidate
  lifecycle: inbox
  created_at: 2026-09-01T10:00:00+04:00
---
# Candidate
`;
}

function storyNote(key: string): string {
  return `---
focus_flow:
  schema_version: 1
  id: ${secondId}
  key: ${key}
  type: story
  lifecycle: backlog
  epic_id: 01990000-0000-7000-8000-000000000003
  epic_link: "[[Focus Flow/Epics/FF-6 Epic]]"
  backlog_rank: a0
  created_at: 2026-09-01T10:00:00+04:00
---
# Ship the smallest slice

## Acceptance Criteria

- [ ] CLI writes a valid Task
`;
}

function epicNote(): string {
  return `---
focus_flow:
  schema_version: 1
  id: 01990000-0000-7000-8000-000000000003
  key: FF-6
  type: epic
  lifecycle: backlog
  backlog_rank: a0
  created_at: 2026-09-01T10:00:00+04:00
---
# Epic
`;
}

function taskNote(): string {
  return `---
focus_flow:
  schema_version: 1
  id: 01990000-0000-7000-8000-000000000004
  key: FF-8
  type: task
  lifecycle: active
  story_id: ${secondId}
  story_link: "[[Focus Flow/Stories/FF-7 Ship the smallest slice]]"
  task_rank: a0
  status: in_progress
  created_at: 2026-09-01T10:00:00+04:00
---
# Verify CLI
`;
}
