import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';

/** A terminal command with a button that copies it. */
@Component({
  selector: 'app-command',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <code>{{ text() }}</code>
    <button type="button" (click)="copy()">{{ copied() ? 'Copied' : 'Copy' }}</button>
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 6px;
      padding: 6px 6px 6px 10px;
      border-radius: 8px;
      background: var(--surface);
    }
    code {
      flex: 1;
      overflow-x: auto;
      white-space: pre;
      font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
      font-size: 12.5px;
      user-select: all;
    }
    button {
      flex: none;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--bg);
      padding: 3px 10px;
      font-size: 12.5px;
      cursor: pointer;
    }
  `,
})
export class Command {
  readonly text = input.required<string>();
  protected readonly copied = signal(false);

  protected async copy(): Promise<void> {
    await navigator.clipboard.writeText(this.text());
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 1500);
  }
}
