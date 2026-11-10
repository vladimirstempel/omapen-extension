// Finds an agent on the PATH and, on Windows, a way to start it with no shell.
//
// On Windows many agents are installed as a `.cmd` script that starts Node.
// Only cmd.exe can run such a script, and cmd.exe reads `&`, `|`, `%` and `^`
// in the arguments as commands. The prompt is an argument and comes from a web
// page, so the host never goes through cmd.exe: it reads the script, finds the
// program that the script starts, and starts that program itself.

import { access, constants, readFile } from 'node:fs/promises';
import path from 'node:path';

const WINDOWS_EXTENSIONS = ['.exe', '.cmd', '.bat'];

/** The full path of a command on the PATH, or null. */
export async function findCommand(name, { platform = process.platform, env = process.env } = {}) {
  const windows = platform === 'win32';
  const names = windows ? WINDOWS_EXTENSIONS.map((extension) => name + extension) : [name];
  for (const dir of (env.PATH ?? '').split(windows ? ';' : ':')) {
    if (!dir) continue;
    for (const file of names) {
      const full = path.join(dir, file);
      try {
        await access(full, windows ? constants.F_OK : constants.X_OK);
        return full;
      } catch {
        // Not in this directory.
      }
    }
  }
  return null;
}

// npm, pnpm and yarn write the target as "%dp0%\path\cli.js" or "%~dp0\path\cli.js".
const SHIM_TARGET = /"%(?:~dp0|dp0%)\\?([^"%]+\.(?:[cm]?js|exe))"/gi;

/**
 * The program that a package manager `.cmd` script starts, as a path relative
 * to the script. Null when the script is not of that kind.
 */
export function shimTarget(script) {
  const targets = [...script.matchAll(SHIM_TARGET)]
    .map((match) => match[1])
    // The script also names a node.exe that can be next to it. That is the runtime.
    .filter((target) => !/(^|\\)node\.exe$/i.test(target));
  return targets.at(-1) ?? null;
}

/**
 * Windows only. Changes `file args` into a command that needs no shell.
 * Throws when `file` is a script whose target cannot be found.
 */
export async function directInvocation(file, args) {
  if (!/\.(cmd|bat)$/i.test(file)) return { command: file, args };
  const target = shimTarget(await readFile(file, 'utf8').catch(() => ''));
  if (!target) {
    throw new Error(
      `${path.basename(file)} is a script that only cmd.exe can run. OmaPen does not send text from a page through cmd.exe. Install the agent with npm, or as a program (.exe).`,
    );
  }
  const resolved = path.resolve(path.dirname(file), target.replaceAll('\\', path.sep));
  if (/\.exe$/i.test(resolved)) return { command: resolved, args };
  // The host already runs in Node: the same Node runs the agent.
  return { command: process.execPath, args: [resolved, ...args] };
}
