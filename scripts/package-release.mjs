import { copyFile, mkdir, rm } from 'node:fs/promises';

const releaseDirectory = 'release';
const artifacts = ['main.js', 'manifest.json', 'styles.css'];

await rm(releaseDirectory, { force: true, recursive: true });
await mkdir(releaseDirectory, { recursive: true });

for (const artifact of artifacts) {
  await copyFile(artifact, `${releaseDirectory}/${artifact}`);
}
