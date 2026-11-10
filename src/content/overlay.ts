import { ICON, iconPosition } from './placement';

const GAP = 6;
const MARGIN = 8;
const PANEL_WIDTH = 440;
const PANEL_START_HEIGHT = 300;

const STYLES = `
  :host { all: initial; }
  button {
    position: fixed;
    top: 0;
    left: 0;
    width: ${ICON}px;
    height: ${ICON}px;
    padding: 0;
    border: 0;
    border-radius: 7px;
    background: #1a1b26;
    cursor: pointer;
    display: grid;
    place-items: center;
    opacity: 0.88;
    box-shadow: 0 0 0 1px rgba(158, 206, 106, 0.35), 0 1px 3px rgba(0, 0, 0, 0.3);
    transition: opacity 120ms, scale 120ms;
  }
  button:hover, button:focus-visible { opacity: 1; scale: 1.08; }
  button:focus-visible { outline: 2px solid #9ece6a; outline-offset: 1px; }
  button[hidden], iframe[hidden] { display: none; }
  iframe {
    position: fixed;
    top: 0;
    left: 0;
    border: 0;
    border-radius: 14px;
    background: #fff;
    color-scheme: light dark;
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.1), 0 16px 48px rgba(0, 0, 0, 0.3);
  }
  @media (prefers-color-scheme: dark) {
    iframe { background: #1b1b1f; box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.12), 0 16px 48px rgba(0, 0, 0, 0.6); }
  }
`;

// The same drawing as public/icons/icon.svg. The dark tile keeps the green
// lines readable on a field of any colour.
const PEN = `<svg width="17" height="17" viewBox="0 0 128 128" fill="none" stroke="#9ECE6A" stroke-width="11" aria-hidden="true"><path d="M62 19.500H13.500V114.500H108.500V66"/><path d="M97 8.500 119.500 31 66 84.500 40 88 43.500 62Z"/></svg>`;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

/**
 * Everything OmaPen draws on a page: the icon in the focused field and the
 * frame that holds the panel. It lives in a closed shadow root, so the page
 * styles do not reach it and the page cannot read it.
 */
export class Overlay {
  private readonly host = document.createElement('omapen-overlay');
  private readonly button = document.createElement('button');
  private frame: HTMLIFrameElement | null = null;
  private frameHeight = PANEL_START_HEIGHT;
  private readonly root: ShadowRoot;

  constructor(onIconClick: () => void) {
    this.host.style.cssText =
      'all: initial !important; position: fixed !important; top: 0 !important; left: 0 !important;' +
      'width: 0 !important; height: 0 !important; z-index: 2147483647 !important;';
    this.root = this.host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = STYLES;

    this.button.type = 'button';
    this.button.title = 'OmaPen: help me write';
    this.button.setAttribute('aria-label', this.button.title);
    this.button.innerHTML = PEN;
    this.button.hidden = true;
    // The field must keep its focus and its selection.
    this.button.addEventListener('mousedown', (event) => event.preventDefault());
    this.button.addEventListener('click', onIconClick);
    this.root.append(style, this.button);
  }

  private attach(): void {
    if (!this.host.isConnected) document.documentElement.append(this.host);
  }

  /** True when the event started in the icon or the panel. */
  owns(event: Event): boolean {
    return event.composedPath().includes(this.host);
  }

  /** Puts the icon in a free corner of the field. */
  showIcon(field: Element, rect: DOMRect): void {
    this.attach();
    const { x, y } = iconPosition(field, rect, this.host);
    this.button.style.translate = `${Math.round(x)}px ${Math.round(y)}px`;
    this.button.hidden = false;
  }

  hideIcon(): void {
    this.button.hidden = true;
  }

  openFrame(url: string, anchor: DOMRect): void {
    this.closeFrame();
    this.attach();
    const frame = document.createElement('iframe');
    frame.title = 'OmaPen';
    frame.allow = 'clipboard-write';
    frame.src = url;
    frame.addEventListener('load', () => frame.focus());
    this.frame = frame;
    this.frameHeight = PANEL_START_HEIGHT;
    this.root.append(frame);
    this.placeFrame(anchor);
  }

  setFrameHeight(height: number): void {
    this.frameHeight = height;
  }

  /** Below the anchor when there is room, above it when not. */
  placeFrame(anchor: DOMRect): void {
    if (!this.frame) return;
    const width = Math.min(PANEL_WIDTH, innerWidth - 2 * MARGIN);
    const height = Math.min(this.frameHeight, innerHeight - 2 * MARGIN);
    const below = anchor.bottom + GAP;
    const above = anchor.top - GAP - height;
    const limit = innerHeight - MARGIN - height;
    const top = below <= limit ? below : above >= MARGIN ? above : limit;
    const left = clamp(anchor.left, MARGIN, innerWidth - width - MARGIN);
    Object.assign(this.frame.style, {
      width: `${width}px`,
      height: `${height}px`,
      translate: `${Math.round(left)}px ${Math.round(Math.max(top, MARGIN))}px`,
    });
  }

  closeFrame(): void {
    this.frame?.remove();
    this.frame = null;
  }

  /** Takes everything off the page. */
  destroy(): void {
    this.closeFrame();
    this.host.remove();
  }
}
