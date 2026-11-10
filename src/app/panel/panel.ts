import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  input,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { Session } from '../../shared/messages';
import { Preset } from '../../shared/prompts';
import { ResultMode } from '../../shared/settings';
import { Extension, Run } from '../core/extension';

type State = 'idle' | 'running' | 'done' | 'error';

const COMPOSE: Session = { text: '', selection: false, canReplace: false };

/**
 * The OmaPen panel: the text to work on, the actions, and the result.
 * With a session id it is the frame in a page. Without one it is the toolbar
 * popup, where there is no field to write back into.
 */
@Component({
  selector: 'app-panel',
  templateUrl: './panel.html',
  styleUrl: './panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'onKeydown($event)' },
})
export class Panel implements OnInit {
  readonly sessionId = input<string | null>(null);

  private readonly extension = inject(Extension);
  private readonly injector = inject(Injector);
  private readonly root = viewChild.required<ElementRef<HTMLElement>>('root');
  private readonly source = viewChild.required<ElementRef<HTMLTextAreaElement>>('source');
  private readonly customField = viewChild<ElementRef<HTMLInputElement>>('customField');

  private session: Session = COMPOSE;
  private resultMode: ResultMode = 'panel';
  private current: Run | null = null;
  private lastInstruction = '';

  protected readonly ready = signal(false);
  protected readonly text = signal('');
  protected readonly presets = signal<Preset[]>([]);
  protected readonly canReplace = signal(false);
  protected readonly badge = signal('YOUR TEXT');
  protected readonly customOpen = signal(false);
  protected readonly customPrompt = signal('');
  protected readonly state = signal<State>('idle');
  protected readonly runLabel = signal('');
  protected readonly result = signal('');
  protected readonly error = signal('');
  protected readonly hostMissing = signal(false);
  protected readonly copied = signal(false);

  protected readonly hasText = computed(() => this.text().trim() !== '');
  protected readonly busy = computed(() => this.state() === 'running');
  /** The digit of the Custom action, when one is free. */
  protected readonly customDigit = computed(() => {
    const digit = this.presets().length + 1;
    return digit <= 9 ? digit : null;
  });
  protected readonly inFrame = computed(() => this.sessionId() !== null);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.current?.cancel());
  }

  async ngOnInit(): Promise<void> {
    const id = this.sessionId();
    const [session, settings] = await Promise.all([
      id ? this.extension.getSession(id) : null,
      this.extension.settings(),
    ]);
    this.session = session ?? COMPOSE;
    this.resultMode = settings.resultMode;
    this.presets.set(settings.presets);
    this.text.set(this.session.text);
    this.canReplace.set(this.session.canReplace);
    this.badge.set(
      this.session.selection ? 'SELECTION' : this.session.canReplace ? 'FIELD' : 'YOUR TEXT',
    );
    this.ready.set(true);

    afterNextRender(
      () => {
        this.reportHeight();
        const root = this.root().nativeElement;
        if (this.hasText()) root.querySelector<HTMLElement>('.action')?.focus();
        else this.source().nativeElement.focus();
      },
      { injector: this.injector },
    );
  }

  /** The frame in the page follows the height of the panel. */
  private reportHeight(): void {
    const id = this.sessionId();
    if (!id) return;
    const root = this.root().nativeElement;
    const report = () =>
      this.extension.emit(id, {
        kind: 'resize',
        height: Math.ceil(root.getBoundingClientRect().height),
      });
    new ResizeObserver(report).observe(root);
    report();
  }

  protected runPreset(preset: Preset): void {
    this.start(preset.instruction, preset.label);
  }

  protected runCustom(event?: Event): void {
    event?.preventDefault();
    const prompt = this.customPrompt().trim();
    if (prompt) this.start(prompt, 'Custom');
  }

  protected again(): void {
    if (this.lastInstruction) this.start(this.lastInstruction, this.runLabel());
  }

  private async start(instruction: string, label: string): Promise<void> {
    if (!this.hasText()) return;
    this.current?.cancel();
    this.lastInstruction = instruction;
    this.runLabel.set(label);
    this.copied.set(false);
    this.state.set('running');

    const run = this.extension.run({ instruction, text: this.text() });
    this.current = run;
    const response = await run.done;
    if (this.current !== run) return;
    this.current = null;

    if (!response.ok || !response.result) {
      this.error.set(response.error || 'The agent produced nothing.');
      this.hostMissing.set(!!response.hostMissing);
      this.state.set('error');
      return;
    }
    this.result.set(response.result);
    this.state.set('done');
    if (this.resultMode === 'replace' && this.canReplace()) {
      this.replace();
      return;
    }
    afterNextRender(
      () => this.root().nativeElement.querySelector<HTMLElement>('.primary')?.focus(),
      { injector: this.injector },
    );
  }

  protected cancel(): void {
    this.current?.cancel();
    this.current = null;
    this.state.set('idle');
  }

  protected toggleCustom(): void {
    this.customOpen.update((open) => !open);
    if (this.customOpen()) {
      afterNextRender(() => this.customField()?.nativeElement.focus(), { injector: this.injector });
    }
  }

  protected replace(): void {
    const id = this.sessionId();
    if (id && this.canReplace()) this.extension.emit(id, { kind: 'replace', text: this.result() });
  }

  protected async copy(): Promise<void> {
    await navigator.clipboard.writeText(this.result());
    this.copied.set(true);
  }

  protected openOptions(): void {
    this.extension.openOptions();
  }

  protected close(): void {
    const id = this.sessionId();
    if (id) this.extension.emit(id, { kind: 'close' });
    else window.close();
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      if (this.state() !== 'done') return;
      event.preventDefault();
      if (this.canReplace()) this.replace();
      else void this.copy();
      return;
    }
    // event.code, because Alt changes the character on some layouts.
    const digit = /^(?:Digit|Numpad)([1-9])$/.exec(event.code)?.[1];
    if (!event.altKey || event.ctrlKey || event.metaKey || !digit) return;
    const index = Number(digit) - 1;
    const preset = this.presets()[index];
    if (preset) {
      event.preventDefault();
      this.runPreset(preset);
    } else if (Number(digit) === this.customDigit()) {
      event.preventDefault();
      this.toggleCustom();
    }
  }
}
