import fs from 'node:fs';

const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

manifest.version = packageJson.version;

fs.writeFileSync('manifest.json', `${JSON.stringify(manifest, null, 2)}\n`);
