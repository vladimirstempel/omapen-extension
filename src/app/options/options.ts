import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { HostStatus } from '../../shared/messages';
import { DEFAULT_PRESETS, parsePresets } from '../../shared/prompts';
import { AgentChoice, DEFAULT_SETTINGS, ResultMode, Settings } from '../../shared/settings';
import { Extension } from '../core/extension';
import { AGENT_GUIDES, GuideStep } from './agent-guides';
import { Command } from './command';

const AGENTS: readonly AgentChoice[] = ['claude', 'pi', 'omp', 'ollama'];
/** The ids that the host installer knows: see EXTENSION_IDS in host/install.mjs. */
const KNOWN_IDS = ['olimmfdblijhjidlaidahlinamdhjblm'];
const RAW = 'https://raw.githubusercontent.com/vladimirstempel/omapen-extension/main/host';

function onWindows(): boolean {
  const hints = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
  return /win/i.test(hints?.platform ?? navigator.platform);
}

@Component({
  selector: 'app-options',
  imports: [Command],
  templateUrl: './options.html',
  styleUrl: './options.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Options implements OnInit {
  private readonly extension = inject(Extension);

  protected readonly agents = AGENTS;
  protected readonly guides = AGENT_GUIDES;
  protected readonly settings = signal<Settings>(DEFAULT_SETTINGS);
  protected readonly host = signal<HostStatus | null>(null);
  protected readonly checking = signal(false);
  protected readonly presetsText = signal('');
  protected readonly presetsError = signal('');
  protected readonly presetsSaved = signal(false);
  protected readonly testing = signal(false);
  protected readonly testResult = signal('');
  protected readonly testError = signal('');

  /** The commands and the words for them are different on Windows. */
  protected readonly windows = onWindows();
  protected readonly terminal = this.windows ? 'PowerShell' : 'the Terminal application';

  /** One command that downloads the host and installs it. */
  protected readonly installCommand = computed(() => {
    const id = chrome.runtime.id;
    const known = KNOWN_IDS.includes(id);
    if (this.windows) {
      return `${known ? '' : `$env:OMAPEN_EXTENSION_ID='${id}'; `}irm ${RAW}/install.ps1 | iex`;
    }
    return `curl -fsSL ${RAW}/install.sh | sh${known ? '' : ` -s -- --extension-id ${id}`}`;
  });

  protected commandFor(step: GuideStep): string | undefined {
    return (this.windows && step.windowsCommand) || step.command;
  }

  protected readonly hostReady = computed(() => this.host()?.ok === true);
  protected readonly anyAgent = computed(() => (this.host()?.agents?.length ?? 0) > 0);

  async ngOnInit(): Promise<void> {
    const settings = await this.extension.settings();
    this.settings.set(settings);
    this.presetsText.set(JSON.stringify(settings.presets, null, 2));
    await this.checkHost();
  }

  protected async checkHost(): Promise<void> {
    this.checking.set(true);
    this.host.set(await this.extension.pingHost());
    this.checking.set(false);
  }

  /** Before the host answers, nothing is known about the agents. */
  protected isInstalled(agent: string): boolean {
    return this.host()?.agents?.includes(agent) ?? false;
  }

  private async patch(patch: Partial<Settings>): Promise<void> {
    this.settings.update((settings) => ({ ...settings, ...patch }));
    await this.extension.save(patch);
  }

  protected setAgent(agent: string): void {
    // A model id belongs to the agent it came from.
    void this.patch({ agent: agent as AgentChoice, model: '' });
  }

  protected setModel(model: string): void {
    void this.patch({ model: model.trim() });
  }

  protected setResultMode(resultMode: ResultMode): void {
    void this.patch({ resultMode });
  }

  protected setShowIcon(showIcon: boolean): void {
    void this.patch({ showIcon });
  }

  protected setIconInInputs(iconInInputs: boolean): void {
    void this.patch({ iconInInputs });
  }

  protected editPresets(text: string): void {
    this.presetsText.set(text);
    this.presetsSaved.set(false);
  }

  protected async savePresets(): Promise<void> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(this.presetsText());
    } catch (error) {
      this.presetsError.set(`Not valid JSON: ${(error as Error).message}`);
      return;
    }
    const presets = parsePresets(parsed);
    if (typeof presets === 'string') {
      this.presetsError.set(presets);
      return;
    }
    this.presetsError.set('');
    await this.patch({ presets });
    this.presetsText.set(JSON.stringify(presets, null, 2));
    this.presetsSaved.set(true);
  }

  protected async resetPresets(): Promise<void> {
    this.presetsText.set(JSON.stringify(DEFAULT_PRESETS, null, 2));
    await this.savePresets();
  }

  protected async test(): Promise<void> {
    this.testing.set(true);
    this.testResult.set('');
    this.testError.set('');
    const response = await this.extension.run({
      instruction: DEFAULT_PRESETS[0].instruction,
      text: 'i has went to the store yestarday',
    }).done;
    this.testing.set(false);
    if (response.ok && response.result) {
      this.testResult.set(`${response.agent}: ${response.result}`);
    } else {
      this.testError.set(response.error || 'The agent produced nothing.');
    }
  }
}
