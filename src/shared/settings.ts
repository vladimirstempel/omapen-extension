import { DEFAULT_PRESETS, Preset } from './prompts';

export type AgentChoice = 'auto' | 'claude' | 'pi' | 'omp' | 'ollama';
export type ResultMode = 'panel' | 'replace';

export interface Settings {
  /** 'auto' lets the host pick: the Omarchy default agent, or the first one installed. */
  agent: AgentChoice;
  /** Empty uses the default model of the agent. */
  model: string;
  resultMode: ResultMode;
  /** Show the icon in multi-line fields that have focus. */
  showIcon: boolean;
  /** Show the icon in single-line inputs also. */
  iconInInputs: boolean;
  presets: Preset[];
}

export const DEFAULT_SETTINGS: Settings = {
  agent: 'auto',
  model: '',
  resultMode: 'panel',
  showIcon: true,
  iconInInputs: false,
  presets: [...DEFAULT_PRESETS],
};

export async function loadSettings(): Promise<Settings> {
  const stored = (await chrome.storage.local.get(
    DEFAULT_SETTINGS as unknown as Record<string, unknown>,
  )) as unknown as Settings;
  // The storage sorts the keys of an object. Put them back in the order people write them.
  const presets = stored.presets.map(({ id, label, instruction }) => ({ id, label, instruction }));
  return { ...stored, presets };
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  await chrome.storage.local.set(patch);
}

export function onSettingsChanged(listener: () => void): void {
  chrome.storage.local.onChanged.addListener(listener);
}
