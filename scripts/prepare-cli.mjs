import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function dependenciesAvailable() {
  try {
    for (const dependency of [
      'esbuild',
      'fractional-indexing',
      'uuid',
      'yaml',
      'zod',
    ]) {
      require.resolve(dependency);
    }
    return true;
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') return false;
    throw error;
  }
}

// npm/cli#8440: global Git installs can prepare without installing local deps.
if (!dependenciesAvailable()) {
  const npmCli = process.env.npm_execpath;
  if (!npmCli) {
    throw new Error('Install project dependencies before building the CLI.');
  }
  execFileSync(
    process.execPath,
    [
      npmCli,
      'install',
      '--global=false',
      '--prefix',
      process.cwd(),
      '--include=dev',
      '--ignore-scripts',
      '--no-package-lock',
      '--no-audit',
      '--no-fund',
    ],
    { stdio: 'inherit' },
  );
}

await import('../esbuild.cli.config.mjs');
