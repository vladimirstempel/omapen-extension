# OmaPen privacy policy

Last change: 2026-11-10

OmaPen is a browser extension that rewrites the text in a field with an AI agent
that is installed on your own computer. It has no server and no account. The
author of OmaPen does not receive your text, your settings, or any other data.

## What OmaPen reads

OmaPen reads text only when you open its panel: with a click on the pen icon,
with the keyboard shortcut, or with the toolbar button.

- From a field: the text of that field, or the part that you selected.
- From a page: the text that you selected.
- From the toolbar panel: the text that you type or paste there.

OmaPen does not read fields that you did not open it on. It does not read your
browsing history, your passwords, your cookies, or the content of other tabs.

## Where the text goes

1. The panel shows the text. The browser keeps it in session memory until you
   close the panel. It is not written to disk by the extension.
2. When you select an action, the extension sends the text and the instruction
   to the OmaPen helper program on your computer. This connection does not use
   the network.
3. The helper program starts the AI agent that you selected (claude, pi, omp or
   ollama) and gives it the text. The agent runs with its tools switched off.
4. The result comes back the same way. It goes into the field only when you
   click Replace, or immediately if you selected that behaviour in the settings.

## The AI agent and its provider

What the agent does with the text depends on the agent that you selected.

- **ollama** runs the model on your computer. The text does not leave it.
- **claude**, **pi** and **omp** send the text to the AI provider of your
  account with that agent, for example Anthropic or Google. The privacy policy
  of that provider applies to this step. You have that account, not OmaPen.

OmaPen does not add other data to the text: no page address, no page title, no
identifier.

## What OmaPen stores

OmaPen stores your settings in the browser on your computer: the agent, the
model name, the behaviour options, and your list of actions. To delete them,
remove the extension.

## What OmaPen does not do

- No analytics, no telemetry, no advertising.
- No sale and no transfer of data to third parties.
- No remote code: all code is in the extension package and in the helper program.

## Source code and contact

OmaPen is open source: https://github.com/vladimirstempel/omapen-extension

For a question about this policy, open an issue:
https://github.com/vladimirstempel/omapen-extension/issues

A change to this policy is made in this file. The history of the file shows
each change.
