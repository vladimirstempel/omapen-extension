/** The native messaging host that runs the agent. See host/install.mjs. */
export const HOST_NAME = 'com.stempelv.omapen';
export const RUN_PORT = 'omapen-run';

/** What the content script captured when the panel opened. */
export interface Session {
  text: string;
  /** True when the text is a selection, false when it is the whole field. */
  selection: boolean;
  /** False when there is no field to write the result back into. */
  canReplace: boolean;
}

export type PanelEvent =
  { kind: 'close' } | { kind: 'resize'; height: number } | { kind: 'replace'; text: string };

export interface HostStatus {
  ok: boolean;
  version?: string;
  agents?: string[];
  defaultAgent?: string;
  error?: string;
}

export interface RunRequest {
  instruction: string;
  text: string;
}

export interface RunResponse {
  ok: boolean;
  result?: string;
  agent?: string;
  error?: string;
  /** True when the browser could not start the host at all. */
  hostMissing?: boolean;
}

export type Message =
  | { type: 'session:create'; session: Session }
  | { type: 'session:get'; id: string }
  | { type: 'session:end'; id: string }
  | { type: 'panel:event'; id: string; event: PanelEvent }
  | { type: 'command:open' }
  | { type: 'host:ping' }
  | { type: 'options:open' };
