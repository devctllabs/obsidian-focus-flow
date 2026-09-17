import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import pkg from '../../package.json';

let directory: string;
let executable: string;

beforeAll(async () => {
  const build = spawnSync(process.execPath, ['esbuild.cli.config.mjs'], {
    encoding: 'utf8',
  });
  expect(build.status, build.stderr).toBe(0);
  directory = await mkdtemp(join(tmpdir(), 'focus-flow-bundle-'));
  executable = join(directory, 'focus-flow.mjs');
  await copyFile(resolve('dist/focus-flow.mjs'), executable);
});

afterAll(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
});

function execute(...args: string[]) {
  return spawnSync(process.execPath, [executable, ...args], {
    cwd: directory,
    encoding: 'utf8',
  });
}

it('runs the standalone bundle without the repository or installed dependencies', () => {
  const result = execute('--version');

  expect(result.status).toBe(0);
  expect(result.stderr).toBe('');
  expect(result.stdout).toBe(`${pkg.version}\n`);
});

it('checks a configured Vault through the packaged entrypoint', async () => {
  const vault = join(directory, 'Vault');
  await mkdir(join(vault, '.obsidian/plugins/focus-flow'), { recursive: true });
  await mkdir(join(vault, 'Focus Flow'), { recursive: true });
  await writeFile(
    join(vault, '.obsidian/plugins/focus-flow/data.json'),
    JSON.stringify({ rootFolder: 'Focus Flow' }),
  );
  await writeFile(join(vault, 'Focus Flow/MISSION.md'), '# Mission\n');

  const result = execute('check', '--vault', vault, '--json');

  expect(result.status).toBe(0);
  expect(result.stderr).toBe('');
  expect(JSON.parse(result.stdout)).toEqual({
    ok: true,
    command: 'check',
    diagnostics: [],
  });
});
