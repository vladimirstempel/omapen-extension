# OmaPen for the browser

"Help me write" with the AI agent on your own machine. The browser version of
[OmaPen](https://github.com/vladimirstempel/omapen): no API key in the
extension, the same agents, the same actions.

Put the cursor in a text field and a pen icon shows in its corner. Click it, or
press `Alt+Shift+H`, and a panel opens next to the field with the text in it.
Pick an action, or open `Custom` and say what you want. `Replace` writes the
result back into the field.

- A selection in the field is rewritten alone. With no selection, the whole field is.
- `Alt+Shift+H` with text selected on the page (not in a field) opens the panel on that text. There is no field to write back into, so `Copy` is the way out.
- The toolbar button opens an empty panel to type or paste into.

## Install

Chromium browsers (Chrome, Chromium, Brave, Edge, Vivaldi) on Linux and macOS.
You need Node.js and one agent: `claude`, `pi`, `omp` or `ollama`.

```bash
git clone https://github.com/vladimirstempel/omapen-extension.git
cd omapen-extension
pnpm install
pnpm build              # the extension, in dist/omapen
pnpm host:install       # the host program that runs your agent
```

Then open `chrome://extensions`, turn on **Developer mode**, click **Load
unpacked** and pick `dist/omapen`. The options page says if the host was found
and has a button to test the agent.

`pnpm host:uninstall` removes the host.

## Keyboard

| Key | What it does |
|---|---|
| `Alt+Shift+H` | Open the panel on the focused field or the selected text. Again to close. Change it on `chrome://extensions/shortcuts` |
| `Alt+1` … `Alt+9` | Run that action. The last digit toggles `Custom` |
| `Ctrl+Return` | Write the result back (or copy it when there is no field) |
| `Esc` | Close |

## How it works

A browser extension cannot start a program, so the work is split in two:

- **The extension** (`src/`): a content script finds the focused field and draws the icon and the panel frame in a closed shadow root. The panel and the options page are one Angular app. The service worker passes messages.
- **The host** (`host/`): a small Node.js program the browser starts through [native messaging](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging). It runs the agent and returns the text. Only this extension is allowed to call it.

Text from a web page is not trusted, and a coding agent can act on your
machine. So the host accepts only agents that have a documented switch for "no
tools at all", and runs them in an empty temporary directory:

| Agent | How it is confined |
|---|---|
| claude | `--restricted --tools ""`, and `--strict-mcp-config` with an empty config |
| pi | `--no-tools` |
| omp | `--no-tools` |
| ollama | has no tools: it runs a local model and prints the answer |

`Automatic` follows `omarchy default agent` where Omarchy is installed, then
takes the first agent it finds. Model empty gives claude `haiku`, gives ollama
your most recent pull, and leaves pi and omp on their own default.

## Development

```bash
pnpm watch    # rebuild on change, then reload the extension
pnpm test     # host unit tests
pnpm e2e      # builds, then drives the extension in headless Chromium with a fake agent
```

The build uses [`@stempelv/ng-builders`](https://github.com/vladimirstempel/ng-builders).
After a change in `host/`, run `pnpm host:install` again: the host is copied
out of the checkout.

## License

MIT, see [LICENSE](LICENSE).
