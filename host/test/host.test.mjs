import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  SYSTEM_PROMPT,
  agentCommand,
  buildPrompt,
  cleanError,
  cleanOutput,
  extractAnswer,
} from '../lib/agent.mjs';
import { createDecoder, encodeMessage } from '../lib/protocol.mjs';

const HOST = join(dirname(fileURLToPath(import.meta.url)), '..', 'omapen-host.mjs');

test('claude runs with every tool off and the prompt on stdin', () => {
  const { command, args, stdin } = agentCommand('claude', '', 'PROMPT');
  assert.equal(command, 'claude');
  assert.equal(args[args.indexOf('--tools') + 1], '');
  assert.ok(args.includes('--restricted'));
  assert.ok(args.includes('--strict-mcp-config'));
  assert.equal(args[args.indexOf('--model') + 1], 'haiku');
  assert.equal(args[args.indexOf('--system-prompt') + 1], SYSTEM_PROMPT);
  assert.equal(stdin, 'PROMPT');
  assert.ok(!args.includes('PROMPT'));
});

test('pi and omp run with --no-tools', () => {
  assert.deepEqual(agentCommand('pi', 'm1', 'P').args, ['--no-tools', '--model', 'm1', '-p', 'P']);
  assert.deepEqual(agentCommand('omp', 'm1', 'P').args, ['--no-tools', '--model=m1', '-p', 'P']);
  assert.deepEqual(agentCommand('pi', '', 'P').args, ['--no-tools', '-p', 'P']);
});

test('ollama needs a model', () => {
  assert.throws(() => agentCommand('ollama', '', 'P'), /no model/);
  assert.deepEqual(agentCommand('ollama', 'gemma3:4b', 'P').args, [
    'run',
    'gemma3:4b',
    '--hidethinking',
    '--nowordwrap',
    'P',
  ]);
});

test('agents that cannot be confined are refused', () => {
  assert.throws(() => agentCommand('codex', '', 'P'), /tools switched off/);
});

test('a model name that looks like a flag is refused', () => {
  assert.throws(() => agentCommand('claude', '--dangerously-skip-permissions', 'P'), /not a valid/);
  assert.throws(() => agentCommand('ollama', 'a b', 'P'), /not a valid/);
});

test('only claude gets the rules outside the prompt', () => {
  assert.equal(buildPrompt('Shorten', 'abc', 'claude'), 'Shorten\n\n<text>\nabc\n</text>');
  assert.ok(buildPrompt('Shorten', 'abc', 'pi').startsWith(SYSTEM_PROMPT));
});

test('cleanOutput drops escape codes and the header line', () => {
  assert.equal(cleanOutput('\n> model: x\n\n\x1b[1mHello\x1b[0m\n'), 'Hello');
  assert.equal(cleanOutput('\x1b]9;done\x07Hi\nthere\n'), 'Hi\nthere');
});

test('extractAnswer takes the last tagged answer', () => {
  assert.equal(extractAnswer('Sure.\n<rewrite>\nHi\n</rewrite>'), 'Hi');
  assert.equal(extractAnswer('use <rewrite> tags\n<rewrite>A</rewrite>'), 'A');
  assert.equal(extractAnswer('no tags here'), 'no tags here');
});

test('cleanError stops at the stack trace', () => {
  const raw = 'Warning: no colour\nNot logged in\n    at foo (bar.js:1:1)\n{"x":1}';
  assert.equal(cleanError(raw), 'Not logged in');
  assert.equal(cleanError('Warning: only this'), 'Warning: only this');
});

test('the protocol decoder handles split and joined chunks', () => {
  const seen = [];
  const decode = createDecoder((message) => seen.push(message));
  const bytes = Buffer.concat([encodeMessage({ a: 1 }), encodeMessage({ b: 'ü' })]);
  decode(bytes.subarray(0, 3));
  decode(bytes.subarray(3));
  assert.deepEqual(seen, [{ a: 1 }, { b: 'ü' }]);
});

function callHost(message, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [HOST], { env: { ...process.env, ...env } });
    const decode = createDecoder(resolve);
    child.stdout.on('data', decode);
    child.on('error', reject);
    child.stdin.write(encodeMessage(message));
    // The browser keeps stdin open until it has the answer.
    child.stdout.once('data', () => child.stdin.end());
  });
}

test('the host answers a ping', async () => {
  const answer = await callHost({ type: 'ping' });
  assert.equal(answer.ok, true);
  assert.ok(Array.isArray(answer.agents));
});

test('the host runs the whole chain against a fake agent', async () => {
  const answer = await callHost(
    { type: 'run', agent: 'claude', model: '', instruction: 'Shorten', text: 'some text' },
    { OMAPEN_AGENT_CMD: "cat >/dev/null; printf 'note\\n<rewrite>\\nshort\\n</rewrite>\\n'" },
  );
  assert.deepEqual(answer, { ok: true, agent: 'claude', result: 'short' });
});

test('a failing agent comes back as an error, never as text', async () => {
  const answer = await callHost(
    { type: 'run', agent: 'claude', model: '', instruction: 'Shorten', text: 'some text' },
    { OMAPEN_AGENT_CMD: 'cat >/dev/null; echo "Not logged in" >&2; echo junk; exit 3' },
  );
  assert.deepEqual(answer, { ok: false, error: 'Not logged in' });
});

test('the host refuses an empty text', async () => {
  const answer = await callHost({ type: 'run', agent: 'claude', instruction: 'x', text: ' ' });
  assert.equal(answer.ok, false);
});
