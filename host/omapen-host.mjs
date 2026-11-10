#!/usr/bin/env node
// Native messaging host for the OmaPen browser extension.
// Messages in:  { type: 'ping' } | { type: 'models', agent } |
//               { type: 'run', agent, model, instruction, text }
// Messages out: { ok: true, ... } | { ok: false, error }
// The browser closes stdin to cancel: every running agent is then stopped.

import { createDecoder, encodeMessage } from './lib/protocol.mjs';
import { installedAgents, listModels, resolveAgent, runRewrite } from './lib/runner.mjs';

export const HOST_VERSION = '0.2.0';

const abort = new AbortController();
let pending = 0;
let inputEnded = false;

function send(message) {
  process.stdout.write(encodeMessage(message));
}

function exitWhenIdle() {
  if (inputEnded && pending === 0) process.exit(0);
}

async function handle(message) {
  switch (message?.type) {
    case 'ping': {
      const agents = await installedAgents();
      const defaultAgent = await resolveAgent('auto').catch(() => '');
      return { ok: true, version: HOST_VERSION, agents, defaultAgent };
    }
    case 'models': {
      const { agent, models } = await listModels(message.agent);
      return { ok: true, agent, models };
    }
    case 'run': {
      const { agent, result } = await runRewrite(message, abort.signal);
      return { ok: true, agent, result };
    }
    default:
      throw new Error(`Unknown message type '${message?.type}'.`);
  }
}

const decode = createDecoder((message) => {
  pending += 1;
  handle(message)
    .then(send, (error) => send({ ok: false, error: String(error?.message ?? error) }))
    .finally(() => {
      pending -= 1;
      exitWhenIdle();
    });
});

process.stdout.on('error', () => {});
process.stdin.on('data', decode);
process.stdin.on('end', () => {
  inputEnded = true;
  abort.abort();
  exitWhenIdle();
});
