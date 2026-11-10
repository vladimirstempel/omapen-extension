# help-me-write-extension

OmaPen browser extension (Chromium MV3): AI writing helper for text fields. Port of the omapen plugin (`/home/ds/Projects/omapen`). Repo: `vladimirstempel/omapen-extension`.

## Layout

- `src/content.ts`, `src/content/`: content script. Finds the focused field, draws the icon and the panel frame, writes the result back.
- `src/background.ts`: service worker. Sessions, message relay, native messaging.
- `src/app/`: Angular app (zoneless, signals). One page for three places: panel frame (`#session=<id>`), toolbar popup (`#compose`), options (`#options`).
- `src/shared/`: types and settings used by all three.
- `host/`: Node native messaging host. Runs the agent with tools off. Port of `bin/omapen` `run`.
- Build: `@stempelv/ng-builders:extension` (the user's own builder). Output: `dist/omapen`.

## Commands

- `pnpm build`: build the extension.
- `pnpm test`: host unit tests (`node --test`).
- `pnpm e2e`: build, then smoke test in headless Chromium with a fake agent. Run it after each change in `src/`.
- `pnpm host:install`: copy the host to `~/.local/share/omapen-host` and register it. Run again after a change in `host/`.

## Rules

- The agent table in `host/lib/agent.mjs` accepts only agents with a documented "no tools" switch. Do not add an agent without one.
- The extension id is fixed by `key` in `src/manifest.json`. `host/install.mjs`, `e2e/smoke.mjs` and the options page know this id.

## Workflow

- Development stage: no CI/CD, no branches, no PR process. Commit directly to `main`.
- Priority: quality and speed. Skip process that does not improve one of them.

## Agent skills

### Issue tracker

Issues live as local markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: bug, enhancement, needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` at root, ADRs in `docs/adr/`. See `docs/agents/domain.md`.

### External peers

Mode `auto`: Claude or Codex adapter, default models, effort high. See `docs/agents/cross-model.json`.
