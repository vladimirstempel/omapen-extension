import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Options } from './options/options';
import { Panel } from './panel/panel';

/**
 * One page, three places: the panel in a page (#session=<id>), the toolbar
 * popup (#compose) and the options page (#options).
 */
@Component({
  selector: 'app-root',
  imports: [Panel, Options],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (options) {
      <app-options />
    } @else {
      <app-panel [sessionId]="sessionId" />
    }
  `,
})
export class App {
  private readonly hash = location.hash.slice(1);
  protected readonly options = this.hash === 'options';
  protected readonly sessionId = this.hash.startsWith('session=')
    ? this.hash.slice('session='.length)
    : null;

  constructor() {
    document.documentElement.dataset['mode'] = this.options
      ? 'options'
      : this.sessionId
        ? 'frame'
        : 'popup';
  }
}
