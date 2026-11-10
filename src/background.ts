import {
  HOST_NAME,
  HostStatus,
  Message,
  ModelList,
  RUN_PORT,
  RunRequest,
  RunResponse,
  Session,
} from './shared/messages';
import { loadSettings } from './shared/settings';

/** A session, and the frame whose content script opened it. */
interface StoredSession extends Session {
  tabId: number;
  frameId: number;
}

const sessionKey = (id: string) => `session:${id}`;
const extensionOrigin = chrome.runtime.getURL('');

function isExtensionPage(sender: chrome.runtime.MessageSender): boolean {
  return sender.id === chrome.runtime.id && (sender.url ?? '').startsWith(extensionOrigin);
}

async function readSession(id: string): Promise<StoredSession | null> {
  const key = sessionKey(id);
  const stored = await chrome.storage.session.get(key);
  return (stored[key] as StoredSession | undefined) ?? null;
}

async function pingHost(): Promise<HostStatus> {
  try {
    return (await chrome.runtime.sendNativeMessage(HOST_NAME, { type: 'ping' })) as HostStatus;
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

async function listModels(agent: string): Promise<ModelList> {
  try {
    return (await chrome.runtime.sendNativeMessage(HOST_NAME, { type: 'models', agent })) as ModelList;
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

async function handleMessage(
  message: Message,
  sender: chrome.runtime.MessageSender,
): Promise<unknown> {
  switch (message.type) {
    case 'session:create': {
      if (sender.tab?.id === undefined) return null;
      const id = crypto.randomUUID();
      const stored: StoredSession = {
        ...message.session,
        tabId: sender.tab.id,
        frameId: sender.frameId ?? 0,
      };
      await chrome.storage.session.set({ [sessionKey(id)]: stored });
      return { id };
    }
    case 'session:get': {
      if (!isExtensionPage(sender)) return null;
      const stored = await readSession(message.id);
      if (!stored) return null;
      const { text, selection, canReplace } = stored;
      return { text, selection, canReplace } satisfies Session;
    }
    case 'session:end': {
      const stored = await readSession(message.id);
      if (stored && stored.tabId === sender.tab?.id) {
        await chrome.storage.session.remove(sessionKey(message.id));
      }
      return null;
    }
    case 'panel:event': {
      if (!isExtensionPage(sender)) return null;
      const stored = await readSession(message.id);
      if (!stored) return null;
      if (message.event.kind !== 'resize') {
        await chrome.storage.session.remove(sessionKey(message.id));
      }
      await chrome.tabs
        .sendMessage(stored.tabId, message, { frameId: stored.frameId })
        .catch(() => undefined);
      return null;
    }
    case 'host:ping':
      return isExtensionPage(sender) ? pingHost() : null;
    case 'host:models':
      return isExtensionPage(sender) ? listModels(message.agent) : null;
    case 'options:open':
      await chrome.runtime.openOptionsPage();
      return null;
    default:
      return null;
  }
}

chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse, () => sendResponse(null));
  return true;
});

// One port is one rewrite. The panel closes the port to cancel: the host then
// loses its stdin and stops the agent.
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== RUN_PORT || !port.sender || !isExtensionPage(port.sender)) return;
  let native: chrome.runtime.Port | null = null;
  let answered = false;

  const answer = (response: RunResponse) => {
    if (answered) return;
    answered = true;
    try {
      port.postMessage(response);
    } catch {
      // The panel is gone.
    }
    native?.disconnect();
    native = null;
  };

  port.onMessage.addListener(async (request: RunRequest) => {
    const { agent, model } = await loadSettings();
    native = chrome.runtime.connectNative(HOST_NAME);
    native.onMessage.addListener((response: RunResponse) => answer(response));
    native.onDisconnect.addListener(() => {
      const reason = chrome.runtime.lastError?.message ?? 'The host stopped with no answer.';
      answer({ ok: false, error: reason, hostMissing: true });
    });
    native.postMessage({ type: 'run', agent, model, ...request });
  });

  port.onDisconnect.addListener(() => {
    answered = true;
    native?.disconnect();
    native = null;
  });
});

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== 'open-panel' || tab?.id === undefined) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'command:open' } satisfies Message);
  } catch {
    // No content script on this page (a browser page, the web store): use the popup.
    await chrome.action.openPopup().catch(() => undefined);
  }
});
