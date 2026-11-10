#!/usr/bin/env node
// Installs the native messaging host for the OmaPen browser extension.
//
//   node host/install.mjs                       install
//   node host/install.mjs --extension-id <id>   allow one more extension id
//   node host/install.mjs --uninstall           remove
//
// Linux, macOS and Windows. The host files are copied to the data directory,
// so the checkout can move or be deleted afterwards.

import { execFile } from 'node:child_process';
import { chmod, cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HOST_NAME = 'com.stempelv.omapen';
// The extensions that may start the host. The first id is the one that the
// `key` in src/manifest.json gives an unpacked build. The id of the Chrome Web
// Store item goes here too.
export const EXTENSION_IDS = ['olimmfdblijhjidlaidahlinamdhjblm'];

const home = homedir();
const source = dirname(fileURLToPath(import.meta.url));
const windows = platform() === 'win32';

// Windows finds a host through the registry, one key for each browser.
const WINDOWS_BROWSERS = [
  'Google\\Chrome',
  'Chromium',
  'Microsoft\\Edge',
  'BraveSoftware\\Brave-Browser',
  'Vivaldi',
];
const registryKey = (browser) => `HKCU\\Software\\${browser}\\NativeMessagingHosts\\${HOST_NAME}`;

function reg(args) {
  return new Promise((resolve, reject) => {
    execFile('reg', args, { windowsHide: true }, (error) => (error ? reject(error) : resolve()));
  });
}

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
  if (windows) {
    return join(process.env.LOCALAPPDATA || join(home, 'AppData', 'Local'), 'omapen-host');
  }
  if (platform() === 'darwin') return join(home, 'Library', 'Application Support', 'omapen-host');
  return join(process.env.XDG_DATA_HOME || join(home, '.local', 'share'), 'omapen-host');
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : (process.argv[index + 1] ?? null);
}

async function uninstall() {
  if (windows) {
    for (const browser of WINDOWS_BROWSERS) {
      await reg(['delete', registryKey(browser), '/f']).catch(() => undefined);
    }
  } else {
    for (const dir of browserDirs()) {
      await rm(join(dir, 'NativeMessagingHosts', `${HOST_NAME}.json`), { force: true });
    }
  }
  await rm(dataDir(), { recursive: true, force: true });
  console.log('OmaPen host removed.');
}

/** Writes the program that the browser starts. Returns its path. */
async function writeLauncher(target) {
  const script = join(target, 'omapen-host.mjs');
  if (windows) {
    // The browser gives the host the PATH of the user. The usual install
    // places of the agents are added, for an agent that is not on the PATH.
    const usual = [
      '%USERPROFILE%\\.local\\bin',
      '%APPDATA%\\npm',
      '%USERPROFILE%\\.bun\\bin',
      '%LOCALAPPDATA%\\Programs\\Ollama',
    ].join(';');
    const quote = (value) => `"${value.replaceAll('%', '%%')}"`;
    const launcher = join(target, 'omapen-host.cmd');
    await writeFile(
      launcher,
      `@echo off\r\nset "PATH=%PATH%;${usual}"\r\n${quote(process.execPath)} ${quote(script)} %*\r\n`,
    );
    return launcher;
  }

  // A browser started from the desktop does not have the PATH of your shell.
  // The launcher keeps the PATH of this install, so the agents are found.
  const launcher = join(target, 'omapen-host');
  const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`;
  // The usual install places of the agents are added: an agent installed after
  // the host is then found too.
  const usual = ['.local/bin', '.bun/bin', '.npm-global/bin', '.cargo/bin']
    .map((dir) => join(home, dir))
    .concat(['/usr/local/bin', '/opt/homebrew/bin']);
  const path = [...new Set([...(process.env.PATH ?? '').split(':'), ...usual])]
    .filter(Boolean)
    .join(':');
  await writeFile(
    launcher,
    `#!/bin/sh\nPATH=${quote(path)}\nexport PATH\nexec ${quote(process.execPath)} ${quote(script)} "$@"\n`,
  );
  await chmod(launcher, 0o755);
  return launcher;
}

/** Tells the browsers where the host is. Returns the places it was registered. */
async function register(target, manifest) {
  const text = `${JSON.stringify(manifest, null, 2)}\n`;
  const registered = [];
  if (windows) {
    const file = join(target, `${HOST_NAME}.json`);
    await writeFile(file, text);
    for (const browser of WINDOWS_BROWSERS) {
      await reg(['add', registryKey(browser), '/ve', '/t', 'REG_SZ', '/d', file, '/f']);
      registered.push(browser.split('\\').at(-1));
    }
    return registered;
  }
  for (const dir of browserDirs()) {
    if (!existsSync(dir)) continue;
    const hosts = join(dir, 'NativeMessagingHosts');
    await mkdir(hosts, { recursive: true });
    await writeFile(join(hosts, `${HOST_NAME}.json`), text);
    registered.push(dir);
  }
  return registered;
}

async function install() {
  const target = dataDir();
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
  await cp(join(source, 'lib'), join(target, 'lib'), { recursive: true });
  await cp(join(source, 'omapen-host.mjs'), join(target, 'omapen-host.mjs'));
  const launcher = await writeLauncher(target);

  const ids = new Set(EXTENSION_IDS);
  // The environment variable is for the PowerShell installer, which cannot pass arguments.
  const extra = argument('--extension-id') ?? process.env.OMAPEN_EXTENSION_ID;
  if (extra) ids.add(extra);
  const registered = await register(target, {
    name: HOST_NAME,
    description: 'OmaPen: runs your local AI agent for the browser extension',
    path: launcher,
    type: 'stdio',
    allowed_origins: [...ids].map((id) => `chrome-extension://${id}/`),
  });

  if (!registered.length) {
    throw new Error('No supported browser profile directory found.');
  }
  console.log(`OmaPen host installed in ${target}`);
  for (const place of registered) console.log(`  registered for ${place}`);
  console.log('Restart the browser if the extension does not find the host.');
}

const action = process.argv.includes('--uninstall') ? uninstall : install;
action().catch((error) => {
  console.error(`omapen-host: ${error.message}`);
  process.exit(1);
});
