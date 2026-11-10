import { deepActiveElement, Editable, findEditable, Target } from './content/editable';
import { Overlay } from './content/overlay';
import { Message, Session } from './shared/messages';
import { DEFAULT_SETTINGS, loadSettings, onSettingsChanged, Settings } from './shared/settings';

interface OpenPanel {
  id: string;
  target: Target | null;
  anchor: () => DOMRect;
}

const MIN_FIELD_WIDTH = 120;
const MIN_FIELD_HEIGHT = 20;

let settings: Settings = DEFAULT_SETTINGS;
let focused: Editable | null = null;
let panel: OpenPanel | null = null;
let syncQueued = false;

const overlay = new Overlay(() => {
  if (focused) void openOnField(focused);
});
const resizeObserver = new ResizeObserver(() => scheduleSync());

function setFocused(el: Editable | null): void {
  if (el === focused) return;
  if (focused) resizeObserver.unobserve(focused);
  focused = el;
  if (focused) resizeObserver.observe(focused);
  scheduleSync();
}

function scheduleSync(): void {
  if (syncQueued) return;
  syncQueued = true;
  requestAnimationFrame(() => {
    syncQueued = false;
    sync();
  });
}

/** Keeps the icon and the panel where the field is. */
function sync(): void {
  if (panel) overlay.placeFrame(panel.anchor());
  if (focused && !focused.isConnected) setFocused(null);

  const rect = focused?.getBoundingClientRect();
  const visible =
    !!rect &&
    settings.showIcon &&
    !panel &&
    rect.width >= MIN_FIELD_WIDTH &&
    rect.height >= MIN_FIELD_HEIGHT &&
    rect.bottom > 0 &&
    rect.top < innerHeight &&
    rect.right > 0 &&
    rect.left < innerWidth;
  if (visible) overlay.showIcon(rect);
  else overlay.hideIcon();
}

async function openPanel(
  target: Target | null,
  session: Session,
  anchor: () => DOMRect,
): Promise<void> {
  closePanel(false);
  const created = await chrome.runtime.sendMessage({
    type: 'session:create',
    session,
  } satisfies Message);
  if (!created?.id) return;
  panel = { id: created.id, target, anchor };
  overlay.openFrame(`${chrome.runtime.getURL('index.html')}#session=${created.id}`, anchor());
  sync();
}

function openOnField(el: Editable): Promise<void> {
  const target = new Target(el);
  return openPanel(
    target,
    { text: target.text, selection: target.selection, canReplace: true },
    () => el.getBoundingClientRect(),
  );
}

/** Text selected on the page, outside a field: it can be rewritten, not replaced. */
function openOnPage(): Promise<void> {
  const selection = getSelection();
  const text = selection?.toString() ?? '';
  const range = text.trim() && selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
  const anchor = () =>
    range?.getBoundingClientRect() ?? new DOMRect(Math.max(0, (innerWidth - 440) / 2), 40, 0, 0);
  return openPanel(
    null,
    { text: range ? text : '', selection: !!range, canReplace: false },
    anchor,
  );
}

function closePanel(refocus: boolean, endSession = true): void {
  if (!panel) return;
  const { id, target } = panel;
  panel = null;
  overlay.closeFrame();
  if (endSession) void chrome.runtime.sendMessage({ type: 'session:end', id } satisfies Message);
  if (refocus) target?.el.focus();
  scheduleSync();
}

function handleCommand(): void {
  if (!document.hasFocus()) return;
  if (panel) return closePanel(true);
  const active = deepActiveElement();
  // The focus is in a child frame: its own content script answers.
  if (active instanceof HTMLIFrameElement) return;
  const el = findEditable(active, true);
  void (el ? openOnField(el) : openOnPage());
}

document.addEventListener(
  'focusin',
  (event) => setFocused(findEditable(event.composedPath()[0] ?? null, settings.iconInInputs)),
  true,
);

document.addEventListener(
  'focusout',
  () => {
    // Later, so a click on the icon is not a reason to hide it.
    setTimeout(() => {
      const active = deepActiveElement();
      if (focused && active !== focused && !focused.contains(active)) setFocused(null);
    }, 150);
  },
  true,
);

addEventListener(
  'scroll',
  () => {
    if (focused || panel) scheduleSync();
  },
  { capture: true, passive: true },
);
addEventListener('resize', scheduleSync, { passive: true });
addEventListener(
  'pointerdown',
  (event) => {
    if (panel && !overlay.owns(event)) closePanel(false);
  },
  true,
);
addEventListener(
  'keydown',
  (event) => {
    if (panel && event.key === 'Escape') closePanel(true);
  },
  true,
);

chrome.runtime.onMessage.addListener((message: Message) => {
  if (message.type === 'command:open') {
    handleCommand();
    return;
  }
  if (message.type !== 'panel:event' || message.id !== panel?.id) return;
  const { event } = message;
  if (event.kind === 'resize') {
    overlay.setFrameHeight(event.height);
    sync();
  } else if (event.kind === 'close') {
    closePanel(true, false);
  } else {
    const target = panel.target;
    closePanel(false, false);
    target?.replace(event.text);
  }
});

async function applySettings(): Promise<void> {
  settings = await loadSettings();
  setFocused(findEditable(deepActiveElement(), settings.iconInInputs));
  scheduleSync();
}

onSettingsChanged(() => void applySettings());
void applySettings();
