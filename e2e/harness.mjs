// Starts headless Chromium with the built extension, a throwaway profile, the
// host from this checkout and a fake agent. The smoke test and the store
// images use it.

import puppeteer from 'puppeteer-core';
import http from 'node:http';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const EXTENSION = join(ROOT, 'dist', 'omapen');
/** The id that the `key` in src/manifest.json gives. */
export const ID = 'omdbmocaoacjcabkcfebgbnlnpofpmci';
const HOST_NAME = 'com.stempelv.omapen';

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * `page(request)` gives the HTML of the test site. `agentCommand` is a shell
 * command that stands in for the agent: it gets the prompt on stdin.
 * Returns { browser, url, close }.
 */
export async function startExtension({ page, agentCommand }) {
  if (!existsSync(join(EXTENSION, 'manifest.json'))) {
    throw new Error('dist/omapen is not there. Run `pnpm build` first.');
  }
  const server = http
    .createServer((request, response) => {
      response.setHeader('content-type', 'text/html; charset=utf-8');
      response.end(page(request));
    })
    .listen(0);

  // A profile with the host registered straight from this checkout.
  const profile = mkdtempSync(join(tmpdir(), 'omapen-e2e-'));
  const launcher = join(profile, 'omapen-host');
  writeFileSync(
    launcher,
    `#!/bin/sh\nexec '${process.execPath}' '${join(ROOT, 'host', 'omapen-host.mjs')}'\n`,
  );
  chmodSync(launcher, 0o755);
  mkdirSync(join(profile, 'NativeMessagingHosts'));
  writeFileSync(
    join(profile, 'NativeMessagingHosts', `${HOST_NAME}.json`),
    JSON.stringify({
      name: HOST_NAME,
      description: 'OmaPen test host',
      path: launcher,
      type: 'stdio',
      allowed_origins: [`chrome-extension://${ID}/`],
    }),
  );

  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_BIN ?? '/usr/bin/chromium',
    headless: true,
    userDataDir: profile,
    args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`, '--no-first-run'],
    env: { ...process.env, OMAPEN_AGENT_CMD: agentCommand },
  });
  return {
    browser,
    url: `http://localhost:${server.address().port}/`,
    async close() {
      await browser.close();
      server.close();
      rmSync(profile, { recursive: true, force: true });
    },
  };
}

/** The panel frame of the extension in `page`, once it is open. */
export async function panelFrame(page) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const frame = page.frames().find((f) => f.url().startsWith(`chrome-extension://${ID}/`));
    if (frame) return frame;
    await sleep(100);
  }
  throw new Error('FAIL: panel frame did not open');
}
