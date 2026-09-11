import { readFile, stat } from 'node:fs/promises';
import process from 'node:process';

const expectedArtifacts = ['main.js', 'manifest.json', 'styles.css'];
const [packageJson, manifest, versions] = await Promise.all(
  ['package.json', 'manifest.json', 'versions.json'].map(async (path) =>
    JSON.parse(await readFile(path, 'utf8')),
  ),
);

assert(
  packageJson.version === manifest.version,
  'package.json and manifest.json versions must match.',
);
assert(
  versions[manifest.version] === manifest.minAppVersion,
  'versions.json must map the release version to minAppVersion.',
);
assert(manifest.isDesktopOnly === false, 'The release must remain mobile-compatible.');

const releaseTag = process.env.RELEASE_TAG;
if (releaseTag !== undefined) {
  assert(
    releaseTag === manifest.version,
    `Release tag ${releaseTag} must exactly equal ${manifest.version}.`,
  );
}

for (const path of expectedArtifacts) {
  const details = await stat(path);
  assert(details.isFile() && details.size > 0, `${path} must be a non-empty file.`);
}

const bundle = await readFile('main.js', 'utf8');
assert(
  !/console\.(?:debug|info|log)\s*\(/.test(bundle),
  'Production bundle must not contain diagnostic logging.',
);
assert(
  !/require\(["'](?:electron|node:|fs|node:fs|child_process|node:child_process)/.test(
    bundle,
  ),
  'Production bundle must not import desktop-only filesystem or process APIs.',
);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
