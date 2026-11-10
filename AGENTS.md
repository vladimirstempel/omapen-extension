# help-me-write-extension

Browser extension: AI writing helper for text fields. Port of the omapen plugin (`/home/ds/Projects/omapen`).

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
