// Makes the ZIP file for the Chrome Web Store from dist/omapen.
//
//   pnpm package
//
// The `key` of the manifest is left out: it fixes the id of an unpacked build,
// and the store gives the item its own id.

import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BUILD = join(ROOT, 'dist', 'omapen');

if (!existsSync(join(BUILD, 'manifest.json'))) {
  console.error('dist/omapen is not there. Run `pnpm build` first.');
  process.exit(1);
}

const stage = mkdtempSync(join(tmpdir(), 'omapen-package-'));
try {
  cpSync(BUILD, stage, { recursive: true });
  const file = join(stage, 'manifest.json');
  const { key: _key, ...manifest } = JSON.parse(readFileSync(file, 'utf8'));
  writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);

  const zip = join(ROOT, 'dist', `omapen-${manifest.version}.zip`);
  rmSync(zip, { force: true });
  // -X: no extra file attributes, so the same build gives the same archive.
  execFileSync('zip', ['-q', '-r', '-X', zip, '.', '-x', '*.map'], { cwd: stage });
  console.log(`${zip}\nversion ${manifest.version}, upload it on https://chrome.google.com/webstore/devconsole`);
} finally {
  rmSync(stage, { recursive: true, force: true });
}
