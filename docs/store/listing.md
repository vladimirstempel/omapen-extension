# Chrome Web Store listing

The text to paste into the Developer Dashboard. The images are in this directory.
Make the ZIP with `pnpm package`.

## Store listing tab

**Name** (from the manifest): OmaPen

**Summary** (from the manifest `description`, 132 characters maximum):

> Help me write, with your own local AI agent: rewrite the text in any field with claude, pi, omp or ollama.

**Category**: Tools (or Workflow & Planning, if Tools is not offered)

**Language**: English

**Description**:

```
OmaPen rewrites the text in any field with the AI agent on your own computer.

☕ OmaPen is free. If it helps you, you can buy me a coffee: https://buymeacoffee.com/stempelv

Write a reply, a comment or a mail. Click the pen in the field, or press Alt+Shift+H. A small panel opens next to your text. Pick an action:

• Fix grammar
• Rewrite
• Shorten
• Elaborate
• More formal
• More casual
• To bullets
• Translate to English
• Custom: your own instruction

Read the result, then click Replace to put it into the field, or Copy.

YOUR OWN AGENT
OmaPen has no server and no account. The work is done by an AI agent that you install on your computer: Ollama, Claude Code, pi or oh-my-pi. With Ollama the model runs on your computer and your text does not leave it. With the other agents you use your own account with the provider.

IMPORTANT: ONE MORE INSTALL STEP
A browser extension is not permitted to start programs. OmaPen needs a small helper program for that, and one AI agent. The settings page of the extension has step by step instructions for both, with commands that you copy and paste. You need Node.js. Linux, macOS and Windows are supported.

KEYBOARD
• Alt+Shift+H: open the panel on the field or on the selected text
• Alt+1 to Alt+9: pick an action
• Ctrl+Enter: replace the text
• Esc: close

MORE
• Works on a selection: only the selected part is rewritten
• Works on text that you select on a page (the result is for Copy)
• The toolbar button opens an empty panel to type or paste into
• Change, add or remove actions in the settings
• The agent runs with its tools switched off, because text from a web page is not trusted

Free and open source (MIT): https://github.com/vladimirstempel/omapen-extension
```

**Images**

| Field | File |
|---|---|
| Store icon | `store-icon.png` (128x128) |
| Screenshots | `screenshot-1.png` to `screenshot-5.png` (1280x800) |
| Small promo tile | `promo-small.png` (440x280) |
| Marquee promo tile | `promo-marquee.png` (1400x560) |

**Homepage URL**: https://github.com/vladimirstempel/omapen-extension

**Support URL**: https://github.com/vladimirstempel/omapen-extension/issues

## Privacy tab

**Single purpose**:

> OmaPen rewrites the text that the user is writing in a field of a web page (fix grammar, shorten, translate and so on) with an AI agent that is installed on the user's own computer.

**Permission justifications**

- `nativeMessaging`:
  > OmaPen has no server. The rewrite is done by an AI program on the user's computer (ollama, claude, pi or omp). The extension uses native messaging to send the text and the instruction to the OmaPen helper program, which starts that AI program and returns the result. This is the core function of the extension.
- `storage`:
  > Stores the user's settings (selected agent, model name, behaviour options, list of actions) in chrome.storage.local. Keeps the text of an open panel in chrome.storage.session so that the panel can read it. The session entry is removed when the panel closes.
- `clipboardWrite`:
  > The Copy button in the panel writes the rewritten text to the clipboard when the user clicks it.
- Host permission (`<all_urls>` in `content_scripts`):
  > The user can write in a text field on any site, so the content script must run on all sites. It shows the pen icon in the field that has focus, opens the panel next to it, and writes the result back into that field. It reads the text of a field only when the user opens the panel on it.

**Remote code**: No, I am not using remote code.

**Data usage**. Tick:

- **Website content**: the text of the field or the selection that the user opens the panel on.
- **Personal communications**: tick this too. The text can be a mail or a message that the user writes.

Leave the other categories empty. Tick all three certifications (no sale of data, no use for unrelated purposes, no use for creditworthiness): all are true.

**Privacy policy URL**: https://github.com/vladimirstempel/omapen-extension/blob/main/PRIVACY.md

## Distribution tab

- Visibility: Public
- Price: free
- Regions: all

## Test instructions tab

The field takes 500 characters at most. This text has 470.

```
No account is necessary. The rewrite needs a helper program and a local AI agent (Node.js necessary).

Without them: click in a multi-line text field on any page. The pen icon shows. Click it: the panel opens. An action shows an error with the link "Open setup".

Full test: open the options page, run the command from step 1, restart the browser. Install Ollama, run: ollama pull gemma3. Click "Test the agent". Then in a text field: pen icon, "Fix grammar", "Replace".
```

## After the first upload

1. Done: the item id is `omdbmocaoacjcabkcfebgbnlnpofpmci`. It is in `EXTENSION_IDS` in `host/install.mjs` and in `KNOWN_IDS` in `src/app/options/options.ts`. Without this the helper program refuses the store build.
2. Done: the public key of the item (Package tab, "View public key") is in `key` of `src/manifest.json`. An unpacked build has the same id as the store item.

## Account

- One-time registration fee.
- Trader declaration: non-trader, if the extension is not part of a business.
