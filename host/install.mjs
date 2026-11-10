#!/usr/bin/env node
// Installs the native messaging host for the OmaPen browser extension.
//
//   node host/install.mjs                       install
//   node host/install.mjs --extension-id <id>   allow one more extension id
//   node host/install.mjs --uninstall           remove
//
// Linux and macOS. The host files are copied to the data directory, so the
// checkout can move or be deleted afterwards.

import { chmod, cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HOST_NAME = 'com.stempelv.omapen';
// The id that the `key` in src/manifest.json gives an unpacked build.
export const EXTENSION_ID = 'olimmfdblijhjidlaidahlinamdhjblm';

const home = homedir();
const source = dirname(fileURLToPath(import.meta.url));

function browserDirs() {
  if (platform() === 'darwin') {
    const base = join(home, 'Library', 'Application Support');
    return [
      join(base, 'Google', 'Chrome'),
      join(base, 'Chromium'),
      join(base, 'BraveSoftware', 'Brave-Browser'),
      join(base, 'Microsoft Edge'),
      join(base, 'Vivaldi'),
    ];
  }
  const base = process.env.XDG_CONFIG_HOME || join(home, '.config');
  return [
    join(base, 'google-chrome'),
    join(base, 'chromium'),
    join(base, 'BraveSoftware', 'Brave-Browser'),
    join(base, 'microsoft-edge'),
    join(base, 'vivaldi'),
    join(base, 'helium'),
  ];
}

function dataDir() {
  if (platform() === 'darwin') return join(home, 'Library', 'Application Support', 'omapen-host');
  return join(process.env.XDG_DATA_HOME || join(home, '.local', 'share'), 'omapen-host');
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : (process.argv[index + 1] ?? null);
}

async function uninstall() {
  for (const dir of browserDirs()) {
    await rm(join(dir, 'NativeMessagingHosts', `${HOST_NAME}.json`), { force: true });
  }
  await rm(dataDir(), { recursive: true, force: true });
  console.log('OmaPen host removed.');
}

async function install() {
  if (platform() === 'win32') {
    throw new Error('Windows is not supported yet.');
  }
  const target = dataDir();
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
  await cp(join(source, 'lib'), join(target, 'lib'), { recursive: true });
  await cp(join(source, 'omapen-host.mjs'), join(target, 'omapen-host.mjs'));

  // A browser started from the desktop does not have the PATH of your shell.
  // The launcher keeps the PATH of this install, so the agents are found.
  const launcher = join(target, 'omapen-host');
  const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`;
  await writeFile(
    launcher,
    `#!/bin/sh\nPATH=${quote(process.env.PATH ?? '')}\nexport PATH\nexec ${quote(process.execPath)} ${quote(join(target, 'omapen-host.mjs'))} "$@"\n`,
  );
  await chmod(launcher, 0o755);

  const ids = new Set([EXTENSION_ID]);
  const extra = argument('--extension-id');
  if (extra) ids.add(extra);
  const manifest = {
    name: HOST_NAME,
    description: 'OmaPen: runs your local AI agent for the browser extension',
    path: launcher,
    type: 'stdio',
    allowed_origins: [...ids].map((id) => `chrome-extension://${id}/`),
  };

  const installed = [];
  for (const dir of browserDirs()) {
    if (!existsSync(dir)) continue;
    const hosts = join(dir, 'NativeMessagingHosts');
    await mkdir(hosts, { recursive: true });
    await writeFile(join(hosts, `${HOST_NAME}.json`), `${JSON.stringify(manifest, null, 2)}\n`);
    installed.push(dir);
  }

  if (!installed.length) {
    throw new Error('No supported browser profile directory found.');
  }
  console.log(`OmaPen host installed in ${target}`);
  for (const dir of installed) console.log(`  registered for ${dir}`);
  console.log('Restart the browser if the extension does not find the host.');
}

const action = process.argv.includes('--uninstall') ? uninstall : install;
action().catch((error) => {
  console.error(`omapen-host: ${error.message}`);
  process.exit(1);
});
