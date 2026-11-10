// Makes the images for the Chrome Web Store in docs/store.
//
//   pnpm build && node scripts/store-assets.mjs
//
// Every picture of the UI is the real extension: the script loads the build in
// headless Chromium, opens a demo page, and lets the extension draw its icon
// and its panel there. Run it again after a change in the UI.

import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ID, ROOT, panelFrame, sleep, startExtension } from '../e2e/harness.mjs';

const OUT = join(ROOT, 'docs', 'store');
const ICON = readFileSync(join(ROOT, 'public', 'icons', 'icon.svg'), 'utf8');
const DRAFT = 'thanks for the update. lets move the review to friday so everyone have time to prepare';
const REWRITE = 'Thanks for the update. Let us move the review to Friday, so everyone has time to prepare.';

// The store wants 1280x800. The page is laid out at 1024x640 and drawn at
// 1.25, so the real UI is a little larger and easier to read in the store.
const SHOT = { width: 1024, height: 640, deviceScaleFactor: 1.25 };

const STYLE = `
  * { box-sizing: border-box; }
  html {
    height: 100%;
    background:
      radial-gradient(900px 600px at 85% 15%, rgba(91, 91, 214, 0.28), transparent 70%),
      radial-gradient(700px 500px at 5% 100%, rgba(158, 206, 106, 0.1), transparent 70%),
      #16161e;
  }
  body {
    margin: 0;
    height: 100%;
    overflow: hidden;
    color: #c0caf5;
    font-family: Inter, 'Segoe UI', system-ui, sans-serif;
  }
  .brand { display: flex; align-items: center; gap: 10px; color: #9ece6a; font-size: 17px; font-weight: 700; }
  .brand svg { width: 28px; height: 28px; }
  h1 { margin: 26px 0 12px; color: #fff; font-size: 40px; line-height: 1.08; letter-spacing: -1px; text-wrap: balance; }
  .lead { margin: 0; color: #a9b1d6; font-size: 17px; line-height: 1.5; }
  .points { margin: 30px 0 0; padding: 0; list-style: none; font-size: 16px; line-height: 1.4; }
  .points li { display: flex; gap: 12px; align-items: baseline; margin-top: 14px; color: #c0caf5; }
  .points li::before { content: ''; flex: none; width: 8px; height: 8px; background: #9ece6a; translate: 0 -1px; }
  .keys { margin: 26px 0 0; display: grid; grid-template-columns: auto 1fr; gap: 12px 14px; align-items: center; font-size: 16px; }
  kbd {
    justify-self: start; padding: 5px 10px; border: 1px solid #414868; border-bottom-width: 2px; border-radius: 6px;
    background: #1f2335; color: #fff; font: 600 14px ui-monospace, 'JetBrains Mono', monospace; white-space: nowrap;
  }
  .foot { position: absolute; left: 48px; bottom: 30px; color: #565f89; font-size: 12px; letter-spacing: 1.5px; }

  /* The two columns of a screenshot. */
  .layout { height: 100%; padding: 44px 48px; display: grid; grid-template-columns: 380px 1fr; gap: 44px; }
  .layout > :first-child { align-self: center; padding-bottom: 30px; }
  .layout > :last-child { justify-self: end; }
  .layout.centre > :last-child { align-self: center; }
  .message { margin-bottom: 16px; padding: 12px 14px; border-radius: 10px; background: #1f2335; font-size: 14px; line-height: 1.5; }
  .message b { display: block; margin-bottom: 2px; color: #7aa2f7; font-size: 13px; }

  /* A plain invented page for the field to live in. */
  .app { width: 500px; padding: 22px; border: 1px solid #292e42; border-radius: 14px; background: #1a1b26; box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45); }
  .app-label { color: #565f89; font-size: 11px; letter-spacing: 1.5px; }
  .app-title { margin: 6px 0 14px; color: #fff; font-size: 17px; font-weight: 600; }
  .app textarea {
    display: block; width: 100%; height: 104px; padding: 12px 14px; resize: none; outline: none;
    border: 1px solid #414868; border-radius: 10px; background: #16161e; color: #c0caf5; font-family: inherit; font-size: 15px; line-height: 1.5;
  }
  .app textarea:focus { border-color: #7aa2f7; }
  .app-row { margin-top: 14px; display: flex; justify-content: space-between; align-items: center; color: #565f89; font-size: 13px; }
  .send { padding: 8px 18px; border-radius: 8px; background: #7aa2f7; color: #16161e; font-weight: 600; font-size: 14px; }
  .callout { margin: 14px 4px 0 0; text-align: right; color: #9ece6a; font-size: 15px; font-weight: 600; }

  .shot { max-width: 100%; border-radius: 12px; box-shadow: 0 0 0 1px #292e42, 0 24px 60px rgba(0, 0, 0, 0.5); }
`;

const brand = `<div class="brand">${ICON}<span>OmaPen</span></div>`;
const document_ = (body) => `<!doctype html><meta charset="utf-8"><style>${STYLE}</style>${body}`;

function screenshotPage({ title, lead, extra = '', right, centre = false }) {
  return document_(`<div class="layout${centre ? ' centre' : ''}">
    <div>${brand}<h1>${title}</h1><p class="lead">${lead}</p>${extra}</div>
    ${right}
  </div><div class="foot">FREE AND OPEN SOURCE</div>`);
}

const points = (items) => `<ul class="points">${items.map((item) => `<li>${item}</li>`).join('')}</ul>`;

const MESSAGE = `<div class="message"><b>Maya</b>The draft is ready for review. Thursday is full for most of us. Can we find a different day?</div>`;

const demoApp = (above = '', callout = '') => `<div><div class="app">
  <div class="app-label">PROJECT UPDATE</div>
  <div class="app-title">Write a reply</div>${above}
  <textarea id="field" spellcheck="false">${DRAFT}</textarea>
  <div class="app-row"><span>Visible to the team</span><span class="send">Send</span></div>
</div>${callout}</div>`;

const PAGES = {
  icon: screenshotPage({
    title: 'Better writing in any field',
    lead: 'A pen shows in the field you write in, on any site.',
    extra: points(['Mail, chats, forms, comments', 'It moves out of the way of the buttons of the page', 'Or press Alt+Shift+H']),
    right: demoApp(MESSAGE, '<div class="callout">Click the pen ↑</div>'),
    centre: true,
  }),
  actions: screenshotPage({
    title: 'One click.<br>The right words.',
    lead: 'The panel opens next to your text. You stay on the page.',
    extra: points(['Fix grammar, rewrite, shorten, translate', 'Or write your own instruction', 'Change the actions in the settings']),
    right: demoApp(),
  }),
  result: screenshotPage({
    title: 'From rough draft to ready',
    lead: 'Read the result first. Then replace your text or copy it.',
    extra: points(['Replace writes it back into the field', 'Again asks for one more version', 'Works on a selection too']),
    right: demoApp(),
  }),
  keys: screenshotPage({
    title: 'Keep your hands on the keys',
    lead: 'Open, pick an action and replace with no mouse.',
    extra: `<div class="keys">
      <kbd>Alt + Shift + H</kbd><span>Open on the field or the selection</span>
      <kbd>Alt + 1 … 9</kbd><span>Pick an action</span>
      <kbd>Ctrl + Enter</kbd><span>Replace the text</span>
      <kbd>Esc</kbd><span>Close</span>
    </div>`,
    right: demoApp(),
  }),
};

const agentsPage = (image) =>
  screenshotPage({
    title: 'Your own AI agent',
    lead: 'OmaPen has no server. The agent on your computer does the work.',
    extra: points([
      'With Ollama the text does not leave your computer',
      'Or use claude, pi or omp with your own account',
      'The agent runs with its tools switched off',
    ]),
    right: `<img class="shot" style="width:500px" src="${image}">`,
    centre: true,
  });

const smallTile = document_(`<div style="height:100%;display:grid;place-content:center;justify-items:center;gap:14px;text-align:center">
  <div style="display:flex;align-items:center;gap:16px">
    <div style="width:64px;height:64px">${ICON}</div>
    <div style="color:#fff;font-size:52px;font-weight:800;letter-spacing:-1.5px">OmaPen</div>
  </div>
  <div style="color:#a9b1d6;font-size:21px">Better words in any field</div>
</div>`);

const marquee = (image) =>
  document_(`<div style="height:100%;padding:0 70px;display:grid;grid-template-columns:1fr auto;gap:60px;align-items:center">
  <div>
    <div style="display:flex;align-items:center;gap:22px">
      <div style="width:84px;height:84px">${ICON}</div>
      <div style="color:#fff;font-size:84px;font-weight:800;letter-spacing:-3px">OmaPen</div>
    </div>
    <p class="lead" style="margin-top:26px;font-size:28px">Better words in any field.<br>With your own AI agent.</p>
  </div>
  <img class="shot" style="height:440px" src="${image}">
</div>`);

const dataUrl = (png) => `data:image/png;base64,${Buffer.from(png).toString('base64')}`;

mkdirSync(OUT, { recursive: true });
const { browser, url, close } = await startExtension({
  page: (request) => PAGES[new URL(request.url, 'http://x').searchParams.get('page')] ?? '',
  agentCommand: `cat >/dev/null; sleep 0.3; printf '<rewrite>\\n%s\\n</rewrite>' "${REWRITE}"`,
});

async function newPage(viewport) {
  const page = await browser.newPage();
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  await page.setViewport(viewport);
  return page;
}

/** Opens a demo page with the cursor in the field, so the extension shows its icon. */
async function demo(name) {
  const page = await newPage(SHOT);
  await page.goto(`${url}?page=${name}`);
  await sleep(400);
  await page.click('#field', { offset: { x: 40, y: 80 } });
  await sleep(400);
  return page;
}

async function openPanel(page) {
  const corner = await page.$eval('#field', (field) => {
    const rect = field.getBoundingClientRect();
    return { x: rect.right - 21, y: rect.bottom - 19 };
  });
  await page.mouse.click(corner.x, corner.y);
  const frame = await panelFrame(page);
  await frame.waitForSelector('.action');
  await page.mouse.move(8, 8);
  await sleep(500);
  return frame;
}

async function save(page, name) {
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  console.log(`${name}.png`);
}

async function still(html, viewport, name) {
  const page = await newPage(viewport);
  await page.setContent(html);
  await save(page, name);
  await page.close();
}

try {
  let page = await demo('icon');
  await save(page, 'screenshot-1');

  page = await demo('actions');
  await openPanel(page);
  await save(page, 'screenshot-2');

  page = await demo('result');
  let frame = await openPanel(page);
  await frame.click('.action');
  await frame.waitForSelector('.result-text');
  await page.mouse.move(8, 8);
  await sleep(500);
  await save(page, 'screenshot-3');
  // The same panel, alone and sharp, for the wide tile.
  const panelImage = await (await frame.frameElement()).screenshot();

  // The agent list of the real options page.
  const options = await newPage({ width: 620, height: 900, deviceScaleFactor: 2 });
  await options.goto(`chrome-extension://${ID}/index.html#options`);
  await options.waitForSelector('.tag');
  // The last line of that section is about the terminal: not for this picture.
  await options.$eval('section:nth-of-type(2) > .hint', (hint) => hint.remove());
  const agentList = await (await options.$('section:nth-of-type(2)')).screenshot();
  await options.close();
  await still(agentsPage(dataUrl(agentList)), SHOT, 'screenshot-4');

  page = await demo('keys');
  frame = await openPanel(page);
  await page.keyboard.down('Alt');
  await page.keyboard.press('Digit1');
  await page.keyboard.up('Alt');
  await frame.waitForSelector('.result-text');
  await sleep(500);
  await save(page, 'screenshot-5');

  await still(smallTile, { width: 440, height: 280, deviceScaleFactor: 1 }, 'promo-small');
  await still(marquee(dataUrl(panelImage)), { width: 1400, height: 560, deviceScaleFactor: 1 }, 'promo-marquee');
} finally {
  await close();
}
