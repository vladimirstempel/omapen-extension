import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
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
import { directInvocation, findCommand, shimTarget } from '../lib/command.mjs';
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

const NPM_SHIM = [
  '@ECHO off',
  'IF EXIST "%dp0%\\node.exe" (',
  '  SET "_prog=%dp0%\\node.exe"',
  ') ELSE (',
  '  SET "_prog=node"',
  ')',
  'endLocal & goto #_undefined_# 2>NUL || title %COMSPEC% & "%_prog%"  "%dp0%\\node_modules\\@scope\\agent\\dist\\cli.js" %*',
].join('\r\n');

test('a Windows npm script gives the program that it starts', () => {
  assert.equal(shimTarget(NPM_SHIM), 'node_modules\\@scope\\agent\\dist\\cli.js');
  assert.equal(shimTarget('@"%~dp0\\node_modules\\x\\bin\\x.exe" %*'), 'node_modules\\x\\bin\\x.exe');
  assert.equal(shimTarget('@echo off\r\npowershell -File run.ps1 %*'), null);
});

test('on Windows an agent is found by its extension and started with no shell', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'omapen-test-'));
  try {
    await writeFile(join(dir, 'pi.cmd'), NPM_SHIM);
    await writeFile(join(dir, 'other.cmd'), '@echo off\r\necho %*');
    const env = { PATH: `C:\\nothing;${dir}` };
    const file = await findCommand('pi', { platform: 'win32', env });
    assert.equal(file, join(dir, 'pi.cmd'));
    assert.equal(await findCommand('claude', { platform: 'win32', env }), null);

    // The text of a page with shell characters stays one argument of node.
    const { command, args } = await directInvocation(file, ['-p', 'a & calc.exe']);
    assert.equal(command, process.execPath);
    assert.deepEqual(args, [join(dir, 'node_modules', '@scope', 'agent', 'dist', 'cli.js'), '-p', 'a & calc.exe']);
    assert.deepEqual(await directInvocation('C:\\bin\\ollama.exe', ['list']), {
      command: 'C:\\bin\\ollama.exe',
      args: ['list'],
    });
    await assert.rejects(directInvocation(join(dir, 'other.cmd'), []), /cmd\.exe/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('off Windows a command must be executable', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'omapen-test-'));
  try {
    await writeFile(join(dir, 'plain'), '');
    await writeFile(join(dir, 'tool'), '#!/bin/sh\n');
    await chmod(join(dir, 'tool'), 0o755);
    const options = { platform: 'linux', env: { PATH: dir } };
    assert.equal(await findCommand('tool', options), join(dir, 'tool'));
    assert.equal(await findCommand('plain', options), null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
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
