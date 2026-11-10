import { Injectable } from '@angular/core';
import {
  HostStatus,
  Message,
  ModelList,
  PanelEvent,
  RUN_PORT,
  RunRequest,
  RunResponse,
  Session,
} from '../../shared/messages';
import { loadSettings, saveSettings, Settings } from '../../shared/settings';

/** A rewrite that is running. `cancel` stops the agent. */
export interface Run {
  readonly done: Promise<RunResponse>;
  cancel(): void;
}

/** The only place in the app that talks to the extension APIs. */
@Injectable({ providedIn: 'root' })
export class Extension {
  private send<T>(message: Message): Promise<T> {
    return chrome.runtime.sendMessage(message) as Promise<T>;
  }

  getSession(id: string): Promise<Session | null> {
    return this.send({ type: 'session:get', id });
  }

  emit(id: string, event: PanelEvent): void {
    void this.send({ type: 'panel:event', id, event });
  }

  pingHost(): Promise<HostStatus> {
    return this.send({ type: 'host:ping' });
  }

  /** The models of an agent. Empty when the agent has no list or the host is too old. */
  async models(agent: string): Promise<string[]> {
    const list = await this.send<ModelList | null>({ type: 'host:models', agent });
    return (list?.ok && list.models) || [];
  }

  openOptions(): void {
    void this.send({ type: 'options:open' });
  }

  settings(): Promise<Settings> {
    return loadSettings();
  }

  save(patch: Partial<Settings>): Promise<void> {
    return saveSettings(patch);
  }

  run(request: RunRequest): Run {
    const port = chrome.runtime.connect({ name: RUN_PORT });
    const done = new Promise<RunResponse>((resolve) => {
      port.onMessage.addListener((response: RunResponse) => {
        resolve(response);
        port.disconnect();
      });
      port.onDisconnect.addListener(() =>
        resolve({ ok: false, error: 'The extension stopped before the agent answered.' }),
      );
    });
    port.postMessage(request);
    return { done, cancel: () => port.disconnect() };
  }
}
