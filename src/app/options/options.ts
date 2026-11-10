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

const AGENTS: readonly AgentChoice[] = ['claude', 'pi', 'omp', 'ollama'];
/** The id that the key in the manifest gives. The host installer knows it. */
const KNOWN_ID = 'olimmfdblijhjidlaidahlinamdhjblm';
const REPOSITORY = 'https://github.com/vladimirstempel/omapen-extension.git';

@Component({
  selector: 'app-options',
  templateUrl: './options.html',
  styleUrl: './options.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Options implements OnInit {
  private readonly extension = inject(Extension);

  protected readonly agents = AGENTS;
  protected readonly settings = signal<Settings>(DEFAULT_SETTINGS);
  protected readonly host = signal<HostStatus | null>(null);
  protected readonly checking = signal(false);
  protected readonly presetsText = signal('');
  protected readonly presetsError = signal('');
  protected readonly presetsSaved = signal(false);
  protected readonly testing = signal(false);
  protected readonly testResult = signal('');
  protected readonly testError = signal('');

  protected readonly installCommand = computed(() => {
    const id = chrome.runtime.id;
    const extra = id === KNOWN_ID ? '' : ` --extension-id ${id}`;
    return `git clone ${REPOSITORY}\nnode omapen-extension/host/install.mjs${extra}`;
  });

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

  protected isInstalled(agent: string): boolean {
    return this.host()?.agents?.includes(agent) ?? true;
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
