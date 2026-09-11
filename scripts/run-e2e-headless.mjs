import { spawnSync } from 'node:child_process';
import process from 'node:process';

const mobile = process.argv.includes('--mobile');
const image = 'mcr.microsoft.com/playwright:v1.62.1-noble';
const source = `${process.cwd()}:/source:ro`;
const command = mobile ? 'pnpm test:e2e:mobile' : 'pnpm test:e2e';
const containerScript = `
tar -C /source \
  --exclude=.git \
  --exclude=node_modules \
  --exclude=.obsidian-cache \
  --exclude=storybook-static \
  --exclude=release \
  -cf - . | tar -C /work -xf -
corepack enable
xvfb-run -a ${command}
`;
const args = [
  'run',
  '--rm',
  '--init',
  '--ipc=host',
  '-e',
  'CI=true',
  '-v',
  source,
  '-v',
  'focus-flow-linux-node-modules:/work/node_modules',
  '-v',
  'focus-flow-obsidian-cache:/work/.obsidian-cache',
  '-w',
  '/work',
];

for (const name of ['OBSIDIAN_APP_VERSION', 'OBSIDIAN_INSTALLER_VERSION']) {
  if (process.env[name] !== undefined) args.push('-e', name);
}

args.push(image, 'bash', '-lc', containerScript);

const result = spawnSync('docker', args, { stdio: 'inherit' });
if (result.error !== undefined) {
  console.error(`Could not start Docker: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
