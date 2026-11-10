/** A field the user can type text into. */
export type Editable = HTMLTextAreaElement | HTMLInputElement | HTMLElement;

const INPUT_TYPES = new Set(['text', 'search', 'email', 'url', '']);

function isTextControl(el: Element): el is HTMLTextAreaElement | HTMLInputElement {
  return el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement;
}

/** The focused element, through open shadow roots. */
export function deepActiveElement(): Element | null {
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return active;
}

/**
 * The editable field that `node` is, or is in. Single-line inputs count only
 * when `includeInputs` is true.
 */
export function findEditable(node: EventTarget | null, includeInputs: boolean): Editable | null {
  if (!(node instanceof HTMLElement)) return null;
  if (node instanceof HTMLTextAreaElement) {
    return node.readOnly || node.disabled ? null : node;
  }
  if (node instanceof HTMLInputElement) {
    const usable = INPUT_TYPES.has(node.type) && !node.readOnly && !node.disabled;
    return includeInputs && usable ? node : null;
  }
  if (!node.isContentEditable) return null;
  // The editing host is the outermost editable element.
  let host: HTMLElement = node;
  while (host.parentElement?.isContentEditable) host = host.parentElement;
  return host;
}

/**
 * A field, and the part of its text that was captured: the selection when
 * there is one, otherwise all of it. `replace` writes over that same part.
 */
export class Target {
  readonly text: string;
  readonly selection: boolean;
  private readonly start: number = 0;
  private readonly end: number = 0;
  private readonly range: Range | null = null;

  constructor(readonly el: Editable) {
    if (isTextControl(el)) {
      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? 0;
      this.selection = end > start;
      this.start = this.selection ? start : 0;
      this.end = this.selection ? end : el.value.length;
      this.text = el.value.slice(this.start, this.end);
      return;
    }
    const selection = el.ownerDocument.getSelection();
    const range = selection && selection.rangeCount ? selection.getRangeAt(0) : null;
    const inside = !!range && !range.collapsed && el.contains(range.commonAncestorContainer);
    this.selection = inside && selection!.toString().trim() !== '';
    if (this.selection) {
      this.range = range!.cloneRange();
      this.text = selection!.toString();
    } else {
      this.text = el.innerText;
    }
  }

  /** Writes `text` over the captured part, the way typing would. */
  replace(text: string): void {
    const el = this.el;
    el.focus();
    if (isTextControl(el)) {
      el.setSelectionRange(this.start, this.end);
      // execCommand keeps the undo history and tells the page framework.
      if (!document.execCommand('insertText', false, text)) {
        el.setRangeText(text, this.start, this.end, 'end');
        el.dispatchEvent(
          new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }),
        );
      }
      return;
    }

    const selection = el.ownerDocument.getSelection();
    if (!selection) return;
    const range = this.range ?? el.ownerDocument.createRange();
    if (!this.range) range.selectNodeContents(el);
    selection.removeAllRanges();
    selection.addRange(range);

    // Rich editors (ProseMirror, Slate, Lexical, Draft) keep their own model
    // and handle a paste themselves. They cancel the event when they do.
    const data = new DataTransfer();
    data.setData('text/plain', text);
    const paste = new ClipboardEvent('paste', {
      clipboardData: data,
      bubbles: true,
      cancelable: true,
    });
    if (!el.dispatchEvent(paste)) return;
    document.execCommand('insertText', false, text);
  }
}
