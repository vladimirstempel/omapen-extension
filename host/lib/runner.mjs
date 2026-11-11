import { execFile, spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  AGENTS,
  agentCommand,
  buildPrompt,
  cleanError,
  cleanOutput,
  extractAnswer,
  modelsCommand,
  parseModels,
} from './agent.mjs';
import { directInvocation, findCommand } from './command.mjs';

const TIMEOUT_MS = 180_000;

export async function isInstalled(command) {
  return (await findCommand(command)) !== null;
}

/** The output of a short command, or '' when it is not there or fails. */
async function capture(command, args) {
  const file = await findCommand(command);
  if (!file) return '';
  let invocation = { command: file, args };
  if (process.platform === 'win32') {
    invocation = await directInvocation(file, args).catch(() => null);
    if (!invocation) return '';
  }
  return new Promise((resolve) => {
    const options = { timeout: 15_000, maxBuffer: 16 * 1024 * 1024, windowsHide: true };
    execFile(invocation.command, invocation.args, options, (error, stdout) => {
      resolve(error ? '' : String(stdout).trim());
    });
  });
}

/**
 * The models that the settings offer for an agent. An empty list means the
 * agent has none to offer, and the model is then typed by hand.
 */
export async function listModels(configured) {
  const agent = await resolveAgent(configured);
  const list = modelsCommand(agent);
  const output = list ? await capture(list.command, list.args) : '';
  return { agent, models: parseModels(agent, output) };
}

export async function installedAgents() {
  const found = await Promise.all(AGENTS.map((agent) => isInstalled(agent)));
  return AGENTS.filter((_, index) => found[index]);
}

/**
 * 'auto' follows `omarchy default agent` where Omarchy is present, then
 * takes the first accepted agent that is installed.
 */
export async function resolveAgent(configured) {
  if (configured && configured !== 'auto') return configured;
  const system = await capture('omarchy-default-agent', []);
  if (AGENTS.includes(system) && (await isInstalled(system))) return system;
  const installed = await installedAgents();
  if (!installed.length) {
    throw new Error('No agent found. Install claude, pi, omp or ollama.');
  }
  return installed[0];
}

// `ollama list` prints the newest pull first.
async function newestOllamaModel() {
  const list = await capture('ollama', ['list']);
  return list.split('\n')[1]?.split(/\s+/)[0] ?? '';
}

function execute({ command, args, stdin }, cwd, signal) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      signal,
      timeout: TIMEOUT_MS,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
    child.stdin.on('error', () => {});
    child.stdin.end(stdin);
  });
}

/**
 * Runs one rewrite. Resolves with the rewritten text, rejects with a message
 * a person can act on.
 */
export async function runRewrite({ agent: configured, model = '', instruction, text }, signal) {
  if (!instruction?.trim()) throw new Error('No instruction given.');
  if (!text?.trim()) throw new Error('There is no text to rewrite.');

  const agent = await resolveAgent(configured);
  const testCommand = process.env.OMAPEN_AGENT_CMD;
  const prompt = buildPrompt(instruction, text, agent);

  let invocation;
  if (testCommand) {
    // Test seam: replaces the agent only. The output handling below still runs.
    invocation = { command: 'sh', args: ['-c', testCommand], stdin: prompt };
  } else {
    if (!AGENTS.includes(agent)) agentCommand(agent, model, prompt);
    const file = await findCommand(agent);
    if (!file) throw new Error(`${agent} is not installed.`);
    const chosen = model || (agent === 'ollama' ? await newestOllamaModel() : '');
    invocation = agentCommand(agent, chosen, prompt);
    if (process.platform === 'win32') {
      invocation = { ...invocation, ...(await directInvocation(file, invocation.args)) };
    }
  }

  // An empty directory keeps a project CLAUDE.md or a repository out of the rewrite.
  const workdir = await mkdtemp(join(tmpdir(), 'omapen-'));
  try {
    const { code, stdout, stderr } = await execute(invocation, workdir, signal);
    const answer = extractAnswer(cleanOutput(stdout));
    if (code !== 0 || !answer.trim()) {
      throw new Error(cleanError(stderr) || cleanError(stdout) || `${agent} produced nothing.`);
    }
    return { agent, result: answer };
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
}
