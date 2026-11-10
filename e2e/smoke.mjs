// End-to-end smoke test: loads the built extension in headless Chromium and
// drives it on a test page. The agent is a fake one, so no tokens are spent.
//
//   pnpm build && node e2e/smoke.mjs [light|dark]
//
// CHROME_BIN names the browser (default: chromium). Screenshots go to dist/e2e.

import puppeteer from 'puppeteer-core';
import http from 'node:http';
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXT = join(ROOT, 'dist', 'omapen');
const OUT = join(ROOT, 'dist', 'e2e');
const ID = 'olimmfdblijhjidlaidahlinamdhjblm';
const HOST_NAME = 'com.stempelv.omapen';
const scheme = process.argv[2] ?? 'light';
const assert = (condition, message) => {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`ok  ${message}`);
};

const html = `<!doctype html><title>t</title><body style="font-family:sans-serif;padding:40px">
<h3>Test page</h3><p id="p">Some plain page text to select here.</p>
<textarea id="ta" style="width:500px;height:120px">i has went to the store</textarea><br><br>
<input id="in" style="width:300px" value="single line"><br><br>
<div id="ce" contenteditable style="width:500px;min-height:60px;border:1px solid #999;padding:8px">hello <b>world</b> text</div>
<div style="position:relative;display:inline-block;margin-top:20px">
<textarea id="chat" style="display:block;width:500px;height:80px">chat message</textarea>
<button id="send" onclick="window.sent=(window.sent||0)+1" style="position:absolute;right:6px;bottom:6px;width:30px;height:26px;padding:0">➤</button>
</div>
<br><textarea id="low" rows="1" style="display:block;width:400px;height:60px;margin-top:20px;resize:none">low field</textarea>
<div style="height:1200px"></div></body>`;
const server = http.createServer((_, res) => res.end(html)).listen(0);
const url = `http://localhost:${server.address().port}/`;

// A throwaway profile with the host registered straight from this checkout.
const profile = mkdtempSync(join(tmpdir(), 'omapen-e2e-'));
const launcher = join(profile, 'omapen-host');
writeFileSync(launcher, `#!/bin/sh\nexec '${process.execPath}' '${join(ROOT, 'host', 'omapen-host.mjs')}'\n`);
chmodSync(launcher, 0o755);
mkdirSync(join(profile, 'NativeMessagingHosts'));
mkdirSync(OUT, { recursive: true });
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
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--no-first-run'],
  env: { ...process.env, OMAPEN_AGENT_CMD: "cat >/dev/null; sleep 0.4; printf '<rewrite>\\nREWRITTEN\\n</rewrite>'" },
});
try {
  const page = await browser.newPage();
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
  await page.setViewport({ width: 900, height: 700 });
  page.on('console', (m) => console.log('  [page]', m.text()));
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
  await page.goto(url);
  await new Promise((r) => setTimeout(r, 500));

  const panelFrame = async () => {
    for (let i = 0; i < 50; i++) {
      const f = page.frames().find((f) => f.url().startsWith(`chrome-extension://${ID}/`));
      if (f) return f;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error('FAIL: panel frame did not open');
  };
  const iconPoint = (sel) => page.$eval(sel, (el) => { const r = el.getBoundingClientRect(); return { x: r.right - 8 - 13, y: r.bottom - 6 - 13 }; });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // 1. textarea, whole field
  await page.click('#ta');
  await sleep(300);
  assert(await page.$('omapen-overlay'), 'overlay appears when a textarea has focus');
  await page.screenshot({ path: `${OUT}/1-icon-${scheme}.png` });
  let pt = await iconPoint('#ta');
  await page.mouse.click(pt.x, pt.y);
  let frame = await panelFrame();
  await frame.waitForSelector('.action');
  assert((await frame.$eval('.source', (e) => e.value)) === 'i has went to the store', 'panel has the field text');
  assert((await frame.$eval('.badge', (e) => e.textContent)) === 'FIELD', 'badge is FIELD');
  await sleep(300);
  await page.screenshot({ path: `${OUT}/2-panel-${scheme}.png` });
  await frame.click('.action');
  await frame.waitForSelector('.status');
  await page.screenshot({ path: `${OUT}/3-running-${scheme}.png` });
  await frame.waitForSelector('.result-text');
  assert((await frame.$eval('.result-text', (e) => e.textContent)) === 'REWRITTEN', 'result comes from the host');
  await sleep(300);
  await page.screenshot({ path: `${OUT}/4-result-${scheme}.png` });
  await frame.click('.primary');
  await sleep(400);
  assert((await page.$eval('#ta', (e) => e.value)) === 'REWRITTEN', 'Replace writes the textarea');
  assert(!page.frames().some((f) => f.url().startsWith('chrome-extension://')), 'panel closes after Replace');

  // 2. textarea selection + keyboard (Alt+1, Ctrl+Enter)
  await page.$eval('#ta', (e) => { e.value = 'keep THIS keep'; e.focus(); e.setSelectionRange(5, 9); });
  await sleep(300);
  pt = await iconPoint('#ta');
  await page.mouse.click(pt.x, pt.y);
  frame = await panelFrame();
  await frame.waitForSelector('.action');
  assert((await frame.$eval('.source', (e) => e.value)) === 'THIS', 'panel has the selection only');
  assert((await frame.$eval('.badge', (e) => e.textContent)) === 'SELECTION', 'badge is SELECTION');
  await sleep(200);
  await page.keyboard.down('Alt'); await page.keyboard.press('Digit3'); await page.keyboard.up('Alt');
  await frame.waitForSelector('.result-text');
  await page.keyboard.down('Control'); await page.keyboard.press('Enter'); await page.keyboard.up('Control');
  await sleep(400);
  assert((await page.$eval('#ta', (e) => e.value)) === 'keep REWRITTEN keep', 'keyboard path replaces the selection only');

  // 3. contenteditable
  await page.click('#ce');
  await sleep(300);
  pt = await iconPoint('#ce');
  await page.mouse.click(pt.x, pt.y);
  frame = await panelFrame();
  await frame.waitForSelector('.action');
  assert((await frame.$eval('.source', (e) => e.value)).trim() === 'hello world text', 'panel has the contenteditable text');
  await frame.click('.action');
  await frame.waitForSelector('.result-text');
  await sleep(300);
  await frame.click('.primary');
  await sleep(400);
  assert((await page.$eval('#ce', (e) => e.innerText.trim())) === 'REWRITTEN', 'Replace writes the contenteditable');

  // 4. single-line input: no icon by default; Esc and outside click
  await page.click('#in');
  await sleep(300);
  pt = await iconPoint('#in');
  await page.mouse.click(pt.x, pt.y);
  await sleep(500);
  assert(!page.frames().some((f) => f.url().startsWith('chrome-extension://')), 'no icon in a single-line input by default');

  await page.click('#ta'); await sleep(300);
  pt = await iconPoint('#ta'); await page.mouse.click(pt.x, pt.y);
  frame = await panelFrame(); await frame.waitForSelector('.action'); await sleep(200);
  await page.keyboard.press('Escape'); await sleep(300);
  assert(!page.frames().some((f) => f.url().startsWith('chrome-extension://')), 'Esc closes the panel');
  assert(await page.evaluate(() => document.activeElement.id === 'ta'), 'focus goes back to the field');
  pt = await iconPoint('#ta'); await page.mouse.click(pt.x, pt.y);
  frame = await panelFrame(); await frame.waitForSelector('.action');
  await page.mouse.click(20, 20); await sleep(300);
  assert(!page.frames().some((f) => f.url().startsWith('chrome-extension://')), 'a click outside closes the panel');

  // 5. the keyboard command: a field, then selected page text
  const worker = await (await browser.waitForTarget((t) => t.type() === 'service_worker')).worker();
  const command = () =>
    worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      await chrome.tabs.sendMessage(tab.id, { type: 'command:open' });
    });
  await page.click('#in'); await sleep(200);
  await command();
  frame = await panelFrame(); await frame.waitForSelector('.action');
  assert((await frame.$eval('.source', (e) => e.value)) === 'single line', 'the command opens the panel on a single-line input');
  await command(); await sleep(300);
  assert(!page.frames().some((f) => f.url().startsWith('chrome-extension://')), 'the command closes an open panel');
  await page.evaluate(() => { document.activeElement.blur(); getSelection().selectAllChildren(document.querySelector('#p')); });
  await command();
  frame = await panelFrame(); await frame.waitForSelector('.action');
  assert((await frame.$eval('.source', (e) => e.value)) === 'Some plain page text to select here.', 'the command takes text selected on the page');
  await frame.click('.action'); await frame.waitForSelector('.result-text');
  assert(!(await frame.$$eval('.buttons button', (b) => b.map((x) => x.textContent.trim()))).some((t) => t.startsWith('Replace')), 'page text has no Replace');
  // Not Esc: the focus is in the panel, and the browser can lose the key-up
  // event of a frame that the key-down removed.
  await command(); await sleep(300);

  // 6. a field with a button of the page in its corner
  await page.click('#chat', { offset: { x: 30, y: 20 } });
  await sleep(300);
  await page.screenshot({ path: `${OUT}/7-busy-corner-${scheme}.png` });
  pt = await iconPoint('#chat');
  await page.mouse.click(pt.x - 32, pt.y);
  frame = await panelFrame(); await frame.waitForSelector('.action');
  assert((await frame.$eval('.source', (e) => e.value)) === 'chat message', 'the icon moves left of a button in the corner');
  await page.keyboard.press('Escape'); await sleep(300);
  await page.mouse.click(pt.x, pt.y); await sleep(300);
  assert((await page.evaluate(() => window.sent)) === 1, 'the button of the page still gets its click');
  assert(!page.frames().some((f) => f.url().startsWith('chrome-extension://')), 'and the panel stays closed');

  await page.click('#low', { offset: { x: 30, y: 20 } }); await sleep(300);
  await page.screenshot({ path: `${OUT}/8-low-field-${scheme}.png` });
  pt = await page.$eval('#low', (el) => { const r = el.getBoundingClientRect(); return { x: r.right - 8 - 13, y: r.bottom - 10 }; });
  await page.mouse.click(pt.x, pt.y); await sleep(400);
  assert(!page.frames().some((f) => f.url().startsWith('chrome-extension://')), 'in a low field the icon is not at an edge');
  await page.mouse.click(pt.x, pt.y - 28);
  frame = await panelFrame(); await frame.waitForSelector('.action');
  assert((await frame.$eval('.source', (e) => e.value)) === 'low field', 'it is on the centre line');
  await command(); await sleep(300);

  // 7. options and popup pages
  const options = await browser.newPage();
  await options.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
  await options.setViewport({ width: 900, height: 1300 });
  options.on('pageerror', (e) => console.log('  [options error]', e.message));
  await options.goto(`chrome-extension://${ID}/index.html#options`);
  await options.waitForSelector('.ok, .warning');
  const hostText = await options.$eval('section', (e) => e.innerText);
  assert(/is installed/.test(hostText), 'options page finds the host: ' + hostText.split('\n')[1]);
  assert((await options.$$('details')).length === 4, 'options page has a guide for each agent');
  await options.click('details summary');
  assert(await options.$('details[open] app-command'), 'a guide shows its commands');
  await options.screenshot({ path: `${OUT}/5-options-${scheme}.png`, fullPage: true });

  const windowsOptions = await browser.newPage();
  await windowsOptions.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'userAgentData', { get: () => ({ platform: 'Windows' }) });
  });
  await windowsOptions.goto(`chrome-extension://${ID}/index.html#options`);
  await windowsOptions.waitForSelector('details');
  const claudeGuide = await windowsOptions.$$eval('details', (all) => all.find((d) => /Claude/.test(d.textContent)).textContent);
  assert(/install\.ps1 \| iex/.test(claudeGuide), 'on Windows the guides show PowerShell commands');
  await windowsOptions.close();

  const popup = await browser.newPage();
  await popup.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
  await popup.setViewport({ width: 440, height: 400 });
  await popup.goto(`chrome-extension://${ID}/index.html#compose`);
  await popup.waitForSelector('.action');
  assert((await popup.$eval('.badge', (e) => e.textContent)) === 'YOUR TEXT', 'popup is in compose mode');
  await popup.type('.source', 'typed text');
  await popup.click('.action');
  await popup.waitForSelector('.result-text');
  assert(!(await popup.$$eval('.buttons button', (b) => b.map((x) => x.textContent.trim()))).some((t) => t.startsWith('Replace')), 'popup has no Replace');
  await popup.screenshot({ path: `${OUT}/6-popup-${scheme}.png` });

  // 8. the extension is reloaded while a page still has the old content script
  await page.bringToFront();
  await page.click('#ta');
  await sleep(300);
  assert(await page.$('omapen-overlay'), 'the icon is there before the reload');
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await worker.evaluate(() => chrome.runtime.reload()).catch(() => undefined);
  await sleep(1500);
  pt = await iconPoint('#ta');
  await page.mouse.click(pt.x, pt.y);
  await sleep(500);
  assert(!(await page.$('omapen-overlay')), 'the old content script takes itself off the page');
  assert(errors.length === 0, 'and it throws nothing');
  console.log('ALL PASSED');
} finally {
  await browser.close();
  server.close();
}
