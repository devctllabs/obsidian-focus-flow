import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const temporary = await mkdtemp(join(tmpdir(), 'focus-flow-install-'));
const repository = join(temporary, 'repository');
const prefix = join(temporary, 'prefix');
const cache = join(temporary, 'npm-cache');
const vault = join(temporary, 'Vault');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
let passed = false;

function run(command, args, cwd = temporary) {
  return execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

async function createVault() {
  await mkdir(join(vault, '.obsidian/plugins/focus-flow'), { recursive: true });
  await mkdir(join(vault, 'Focus Flow'), { recursive: true });
  await writeFile(
    join(vault, '.obsidian/plugins/focus-flow/data.json'),
    JSON.stringify({ rootFolder: 'Focus Flow' }),
  );
  await writeFile(join(vault, 'Focus Flow/MISSION.md'), '# Mission\n');
}

function commandPath(installPrefix) {
  return join(
    installPrefix,
    process.platform === 'win32' ? 'focus-flow.cmd' : 'bin/focus-flow',
  );
}

try {
  await mkdir(repository);
  for (const name of [
    'src',
    'package.json',
    'esbuild.cli.config.mjs',
    '.gitignore',
  ]) {
    await cp(resolve(name), join(repository, name), { recursive: true });
  }
  await mkdir(join(repository, 'scripts'));
  await cp(
    resolve('scripts/prepare-cli.mjs'),
    join(repository, 'scripts/prepare-cli.mjs'),
  );
  run('git', ['init', '--quiet'], repository);
  run('git', ['add', '.'], repository);
  run(
    'git',
    [
      '-c',
      'user.name=CLI installation test',
      '-c',
      'user.email=cli-test@example.invalid',
      'commit',
      '--quiet',
      '-m',
      'CLI installation fixture',
    ],
    repository,
  );
  console.log('Installing the source Git package into an isolated npm prefix…');
  const spec = `git+${pathToFileURL(repository).href}`;
  run(npm, [
    'install',
    '--global',
    '--prefix',
    prefix,
    '--cache',
    cache,
    '--no-audit',
    '--no-fund',
    '--ignore-scripts=false',
    '--install-links',
    spec,
  ]);

  const modules = run(npm, ['root', '--global', '--prefix', prefix]).trim();
  const installed = join(modules, 'obsidian-focus-flow');
  const command = commandPath(prefix);
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  assert.equal(run(command, ['--version']).trim(), pkg.version);
  await readFile(join(installed, 'dist/focus-flow.mjs'), 'utf8');
  await assert.rejects(readFile(join(installed, 'src/cli/main.ts'), 'utf8'), {
    code: 'ENOENT',
  });
  await assert.rejects(
    readFile(join(installed, 'skills/focus-flow/SKILL.md'), 'utf8'),
    { code: 'ENOENT' },
  );

  await createVault();
  assert.deepEqual(
    JSON.parse(run(command, ['check', '--vault', vault, '--json'])),
    { ok: true, command: 'check', diagnostics: [] },
  );

  const localPrefix = join(temporary, 'local-prefix');
  run(npm, [
    'install',
    '--global',
    '--prefix',
    localPrefix,
    '--cache',
    cache,
    '--no-audit',
    '--no-fund',
    '.',
  ], resolve('.'));
  const localCommand = commandPath(localPrefix);
  assert.equal(run(localCommand, ['--version']).trim(), pkg.version);
  assert.deepEqual(
    JSON.parse(run(localCommand, ['check', '--vault', vault, '--json'])),
    { ok: true, command: 'check', diagnostics: [] },
  );

  console.log('Git and local npm installation, prepare and CLI checks passed.');
  passed = true;
} catch (error) {
  if (error.stderr) console.error(String(error.stderr));
  else console.error(error.message);
  console.error(`Installation check failed; artifacts retained at ${temporary}`);
  process.exitCode = 1;
} finally {
  if (passed) await rm(temporary, { recursive: true, force: true });
}
