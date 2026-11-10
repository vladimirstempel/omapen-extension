import { execFile, spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { access, constants } from 'node:fs/promises';
import {
  AGENTS,
  agentCommand,
  buildPrompt,
  cleanError,
  cleanOutput,
  extractAnswer,
} from './agent.mjs';

const TIMEOUT_MS = 180_000;

export async function isInstalled(command) {
  for (const dir of (process.env.PATH ?? '').split(delimiter)) {
    if (!dir) continue;
    try {
      await access(join(dir, command), constants.X_OK);
      return true;
    } catch {
      // Not in this directory.
    }
  }
  return false;
}

function capture(command, args) {
  return new Promise((resolve) => {
    execFile(command, args, { timeout: 5000 }, (error, stdout) => {
      resolve(error ? '' : String(stdout).trim());
    });
  });
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
      stdio: [stdin === null ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
    if (stdin !== null) {
      child.stdin.on('error', () => {});
      child.stdin.end(stdin);
    }
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
    if (!(await isInstalled(agent))) throw new Error(`${agent} is not installed.`);
    const chosen = model || (agent === 'ollama' ? await newestOllamaModel() : '');
    invocation = agentCommand(agent, chosen, prompt);
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
