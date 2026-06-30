import {
  analyzeConversation,
  conversationTriggerKey,
} from "../lib/conversation";
import { debugMessageClassification, extractLiveMessages } from "../lib/message-extract";
import type {
  CoachItem,
  ConversationSnapshot,
  LiveMessage,
  MediaItem,
  SuggestionPick,
  SuggestionResponse,
} from "../lib/types";
import { copyToClipboard, debugComposeSend, insertIntoWhatsAppCompose, openMediaUrl, pasteAndSend, sendWhatsAppMessage } from "./compose";

const PANEL_ID = "helpmechat-panel-root";
const POS_KEY = "helpmechatPanelPos";

let lastTriggerKey = "";
let lastContact = "";
let isLoading = false;
let pendingFetch = false;
let applyingReply = false;
let chatUpdateTimer: ReturnType<typeof setTimeout> | null = null;
let quickChatEnabled = false;
let quickChatBusy = false;
let lastQuickChatKey = "";

/** In-memory reply texts — avoids brittle HTML attribute encoding */
let currentReplies: string[] = [];

/** Current batch — for preference learning when user picks a suggestion */
let currentBatch: {
  contactName: string;
  triggerKey: string;
  replies: string[];
  relationship?: string;
  situation?: string;
} | null = null;

function createPanel(): HTMLElement {
  const existing = document.getElementById(PANEL_ID);
  if (existing) return existing;

  const root = document.createElement("div");
  root.id = PANEL_ID;
  root.innerHTML = `
    <div class="hmc-panel" id="hmc-panel">
      <header class="hmc-header" id="hmc-drag-handle">
        <div class="hmc-brand">
          <div class="hmc-brand-mark" aria-hidden="true">H</div>
          <div class="hmc-brand-text">
            <span class="hmc-brand-name">HelpMeChat</span>
            <span class="hmc-context" id="hmc-context">Waiting for chat…</span>
            <span class="hmc-situation" id="hmc-situation"></span>
          </div>
        </div>
        <div class="hmc-header-actions">
          <button class="hmc-icon-btn hmc-quick-toggle" id="hmc-quick-chat" type="button" title="Quick chat — auto-reply when they message" aria-pressed="false">⚡</button>
          <button class="hmc-icon-btn" id="hmc-minimize" type="button" title="Collapse" aria-expanded="true">—</button>
        </div>
      </header>
      <div class="hmc-body" id="hmc-body">
        <div class="hmc-setup" id="hmc-setup" hidden>
          <p class="hmc-setup-text">Upload WhatsApp chats once — we learn your texting style.</p>
          <button class="hmc-setup-btn" id="hmc-open-setup" type="button">Set up HelpMeChat</button>
        </div>
        <div class="hmc-status" id="hmc-status"></div>
        <div class="hmc-loader" id="hmc-loader" hidden>
          <div class="hmc-loader-bar"></div>
        </div>
        <section class="hmc-section" id="hmc-media-section" hidden>
          <h3 class="hmc-section-title">Media</h3>
          <div class="hmc-media" id="hmc-media"></div>
        </section>
        <section class="hmc-section" id="hmc-coach-section" hidden>
          <h3 class="hmc-section-title">AI Coach</h3>
          <div class="hmc-coach" id="hmc-coach"></div>
        </section>
        <section class="hmc-section">
          <div class="hmc-section-head">
            <h3 class="hmc-section-title">Quick replies</h3>
            <button class="hmc-refresh-btn" id="hmc-refresh" type="button" title="Refresh">↻</button>
          </div>
          <div class="hmc-suggestions" id="hmc-suggestions"></div>
        </section>
        <p class="hmc-hint" id="hmc-hint">Tap Send to paste once · ⚡ Quick chat auto-replies (no follow-ups)</p>
      </div>
    </div>
  `;
  document.body.appendChild(root);

  document.getElementById("hmc-minimize")?.addEventListener("click", (e) => {
    e.stopPropagation();
    const minimized = root.classList.toggle("hmc-minimized");
    const btn = document.getElementById("hmc-minimize");
    btn?.setAttribute("aria-expanded", minimized ? "false" : "true");
  });

  setupDrag(root);
  void loadPanelPosition(root);

  document.getElementById("hmc-refresh")?.addEventListener("click", () => {
    lastTriggerKey = "";
    lastQuickChatKey = "";
    const contactName = getContactName();
    const messages = extractLiveMessages();
    const state = contactName && messages.length ? analyzeConversation(contactName, messages) : null;
    if (quickChatEnabled && state?.replyMode === "reply_to_them" && contactName) {
      const key = conversationTriggerKey(contactName, messages) ?? "";
      if (key) void runQuickChat(contactName, messages, state, key);
      return;
    }
    void fetchSuggestions(true);
  });

  document.getElementById("hmc-open-setup")?.addEventListener("click", () => {
    void chrome.runtime.openOptionsPage();
  });

  document.getElementById("hmc-quick-chat")?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleQuickChat();
  });

  document.getElementById("hmc-suggestions")?.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest(".hmc-suggestion");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const index = Number((btn as HTMLElement).dataset.index ?? 0);
    const text = currentReplies[index] ?? "";
    if (!text) return;
    applyReply(text, index, btn);
  });

  void refreshProfileStatus();

  return root;
}

async function loadPanelPosition(root: HTMLElement): Promise<void> {
  try {
    const data = await chrome.storage.local.get(POS_KEY);
    const pos = data[POS_KEY] as { x: number; y: number } | undefined;
    if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
      root.style.left = `${pos.x}px`;
      root.style.top = `${pos.y}px`;
      root.style.right = "auto";
    }
  } catch {
    /* default */
  }
}

async function savePanelPosition(x: number, y: number): Promise<void> {
  try {
    await chrome.storage.local.set({ [POS_KEY]: { x, y } });
  } catch {
    /* ignore */
  }
}

function setupDrag(root: HTMLElement): void {
  const handle = document.getElementById("hmc-drag-handle");
  if (!handle) return;

  let dragging = false;
  let startX = 0;
  let startY = 0;
  let origX = 0;
  let origY = 0;

  handle.addEventListener("mousedown", (e) => {
    if ((e.target as HTMLElement).closest("button")) return;
    dragging = true;
    handle.classList.add("hmc-dragging");
    const rect = root.getBoundingClientRect();
    origX = rect.left;
    origY = rect.top;
    startX = e.clientX;
    startY = e.clientY;
    root.style.right = "auto";
    e.preventDefault();
  });

  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const x = Math.max(8, Math.min(window.innerWidth - 80, origX + e.clientX - startX));
    const y = Math.max(8, Math.min(window.innerHeight - 48, origY + e.clientY - startY));
    root.style.left = `${x}px`;
    root.style.top = `${y}px`;
  });

  window.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false;
    handle.classList.remove("hmc-dragging");
    const rect = root.getBoundingClientRect();
    void savePanelPosition(rect.left, rect.top);
  });
}

function getContactName(): string | null {
  const selectors = [
    '[data-testid="conversation-header"] span[title]',
    '[data-testid="conversation-info-header"] span[title]',
    "#main header span[title]",
    "#main header span[dir='auto']",
  ];

  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el instanceof HTMLElement && el.title?.trim()) return el.title.trim();
    const text = el?.textContent?.trim();
    if (text && text.length < 80) return text;
  }
  return null;
}

function setContext(label: string, situation?: string): void {
  const ctx = document.getElementById("hmc-context");
  const sit = document.getElementById("hmc-situation");
  if (ctx) ctx.textContent = label;
  if (sit) {
    sit.textContent = situation ?? "";
    sit.hidden = !situation;
  }
}

function setStatus(text: string, isError = false): void {
  const el = document.getElementById("hmc-status");
  if (!el) return;
  el.textContent = text;
  el.classList.toggle("hmc-error", isError);
  el.hidden = !text;
}

function setLoading(on: boolean): void {
  const loader = document.getElementById("hmc-loader");
  if (loader) loader.hidden = !on;
}

function recordPick(index: number, text: string): void {
  if (!currentBatch || currentBatch.contactName !== getContactName()) return;

  const pick: SuggestionPick = {
    contactName: currentBatch.contactName,
    pickedIndex: index,
    pickedText: text,
    allSuggestions: currentBatch.replies,
    situation: currentBatch.situation,
    relationship: currentBatch.relationship,
    triggerKey: currentBatch.triggerKey,
    pickedAt: new Date().toISOString(),
  };

  void chrome.runtime.sendMessage({ type: "RECORD_PICK", payload: { pick } });
}

function setSetupVisible(visible: boolean): void {
  const setup = document.getElementById("hmc-setup");
  if (setup) setup.hidden = !visible;
}

async function refreshProfileStatus(): Promise<boolean> {
  try {
    const settings = (await chrome.runtime.sendMessage({ type: "GET_SETTINGS" })) as {
      profile?: unknown;
    };
    const ready = Boolean(settings?.profile);
    setSetupVisible(!ready);
    return ready;
  } catch {
    setSetupVisible(true);
    return false;
  }
}

function toggleQuickChat(): void {
  quickChatEnabled = !quickChatEnabled;
  lastQuickChatKey = "";
  lastTriggerKey = "";

  const btn = document.getElementById("hmc-quick-chat");
  btn?.classList.toggle("hmc-quick-active", quickChatEnabled);
  btn?.setAttribute("aria-pressed", quickChatEnabled ? "true" : "false");

  const hint = document.getElementById("hmc-hint");
  if (hint) {
    hint.textContent = quickChatEnabled
      ? "Quick chat ON — auto-sends when they message · no follow-ups"
      : "Tap Send to paste once · ⚡ Quick chat auto-replies (no follow-ups)";
  }

  if (quickChatEnabled) {
    setStatus("Quick chat ON · waiting for their message");
    scheduleChatUpdate();
  } else {
    setStatus("");
    scheduleChatUpdate();
  }
}

function applyReply(text: string, index: number, btn: Element): void {
  if (applyingReply) return;
  applyingReply = true;

  const pasted = insertIntoWhatsAppCompose(text);
  recordPick(index, text);

  btn.classList.add("hmc-copied");
  const action = btn.querySelector(".hmc-suggestion-action");

  void (async () => {
    let label = "In chat";
    if (!pasted) {
      const copied = await copyToClipboard(text);
      label = copied ? "Copied" : "Failed";
    }
    if (action) action.textContent = label;

    setTimeout(() => {
      btn.classList.remove("hmc-copied");
      if (action) action.textContent = "Send";
      applyingReply = false;
    }, 1400);
  })();
}

const COACH_ICONS: Record<string, string> = {
  link: "🔗",
  fact: "💡",
  gif: "🎬",
  sticker: "🎭",
  idea: "✨",
  excuse: "🃏",
};

const MEDIA_ICONS: Record<string, string> = {
  gif: "GIF",
  meme: "MEME",
  image: "IMG",
  sticker: "STK",
  video: "VID",
};

function renderMedia(items: MediaItem[]): void {
  const section = document.getElementById("hmc-media-section");
  const listEl = document.getElementById("hmc-media");
  if (!section || !listEl) return;

  if (!items.length) {
    section.hidden = true;
    listEl.innerHTML = "";
    return;
  }

  section.hidden = false;
  listEl.innerHTML = items
    .map(
      (item) => `
      <button class="hmc-media-item" type="button" data-url="${escapeAttr(item.url)}" title="${escapeAttr(item.label)}">
        ${item.previewUrl ? `<img class="hmc-media-preview" src="${escapeAttr(item.previewUrl)}" alt="" loading="lazy" />` : `<span class="hmc-media-badge">${MEDIA_ICONS[item.type] ?? "MEDIA"}</span>`}
        <span class="hmc-media-label">${escapeHtml(item.label)}</span>
      </button>
    `
    )
    .join("");

  listEl.querySelectorAll(".hmc-media-item").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openMediaUrl((btn as HTMLElement).dataset.url ?? "");
      btn.classList.add("hmc-copied");
      setTimeout(() => btn.classList.remove("hmc-copied"), 600);
    });
  });
}

function renderCoach(items: CoachItem[]): void {
  const section = document.getElementById("hmc-coach-section");
  const listEl = document.getElementById("hmc-coach");
  if (!section || !listEl) return;

  if (!items.length) {
    section.hidden = true;
    listEl.innerHTML = "";
    return;
  }

  section.hidden = false;
  listEl.innerHTML = items
    .map(
      (item) => `
      <button class="hmc-coach-item hmc-coach-${item.type}" type="button"
        data-content="${escapeAttr(item.content)}"
        data-is-link="${/^https?:\/\//i.test(item.content) ? "1" : "0"}">
        <span class="hmc-coach-icon">${COACH_ICONS[item.type] ?? "💬"}</span>
        <span class="hmc-coach-body">
          <span class="hmc-coach-label">${escapeHtml(item.label)}</span>
          <span class="hmc-coach-content">${escapeHtml(item.content)}</span>
        </span>
      </button>
    `
    )
    .join("");

  listEl.querySelectorAll(".hmc-coach-item").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const content = (btn as HTMLElement).dataset.content ?? "";
      const isLink = (btn as HTMLElement).dataset.isLink === "1";
      if (isLink) openMediaUrl(content);
      else insertIntoWhatsAppCompose(content);
    });
  });
}

function renderSuggestions(replies: string[]): void {
  const listEl = document.getElementById("hmc-suggestions");
  if (!listEl) return;

  currentReplies = replies;

  if (replies.length === 0) {
    listEl.innerHTML = `<p class="hmc-empty">No suggestions yet</p>`;
    return;
  }

  listEl.innerHTML = replies
    .map(
      (text, i) => `
      <button class="hmc-suggestion" type="button" data-index="${i}" aria-label="Suggestion ${i + 1}">
        <span class="hmc-suggestion-index">${i + 1}</span>
        <span class="hmc-suggestion-text">${escapeHtml(text)}</span>
        <span class="hmc-suggestion-action">Send</span>
      </button>
    `
    )
    .join("");

  setStatus("");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

async function runQuickChat(
  contactName: string,
  messages: LiveMessage[],
  state: NonNullable<ReturnType<typeof analyzeConversation>>,
  triggerKey: string
): Promise<void> {
  if (quickChatBusy || isLoading) return;
  if (triggerKey === lastQuickChatKey) return;

  quickChatBusy = true;
  isLoading = true;
  setLoading(true);
  setContext(`Quick chat · ${contactName}`, state.turnLabel);
  setStatus("Composing safe reply…");

  const snapshot: ConversationSnapshot = { contactName, messages, state };

  try {
    const data = (await chrome.runtime.sendMessage({
      type: "GET_QUICK_CHAT_REPLY",
      payload: { snapshot },
    })) as { reply?: string; situation?: string; error?: string };

    if (data.error) throw new Error(data.error);
    const reply = data.reply?.trim();
    if (!reply) throw new Error("No reply generated");

    lastQuickChatKey = triggerKey;
    lastTriggerKey = triggerKey;

    let outcome = await pasteAndSend(reply);
    if (outcome === "pasted") {
      const sent = await sendWhatsAppMessage(reply);
      outcome = sent ? "sent" : "pasted";
    }
    if (outcome === "failed") throw new Error("Could not paste into chat");

    setContext(`Quick chat · sent to ${contactName}`, data.situation);
    setStatus(
      outcome === "sent"
        ? "Reply sent"
        : "Message pasted — WhatsApp send blocked; tap send manually"
    );
    renderSuggestions([reply]);
    renderMedia([]);
    renderCoach([]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Quick chat failed";
    setStatus(msg, true);
  } finally {
    quickChatBusy = false;
    isLoading = false;
    setLoading(false);
  }
}

async function fetchSuggestions(force = false): Promise<void> {
  const contactName = getContactName();
  if (!contactName) {
    setContext("Open a conversation");
    setStatus("Open a chat on WhatsApp Web");
    renderSuggestions([]);
    return;
  }

  const hasProfile = await refreshProfileStatus();
  if (!hasProfile) {
    setContext(contactName);
    setStatus("Complete setup to get AI suggestions");
    renderSuggestions([]);
    renderMedia([]);
    renderCoach([]);
    return;
  }

  const messages = extractLiveMessages();
  if (messages.length === 0) {
    setContext(contactName);
    setStatus("Scroll the chat to load messages");
    return;
  }

  const state = analyzeConversation(contactName, messages);
  if (!state) {
    setContext(contactName);
    setStatus("Couldn't read this conversation yet");
    return;
  }

  setContext(state.turnLabel);

  const triggerKey = conversationTriggerKey(contactName, messages) ?? "";
  if (!force && triggerKey === lastTriggerKey) return;

  lastTriggerKey = triggerKey;
  const snapshot: ConversationSnapshot = { contactName, messages, state };

  isLoading = true;
  setLoading(true);
  setStatus("");

  try {
    const data = (await chrome.runtime.sendMessage({
      type: "GET_SUGGESTIONS",
      payload: { snapshot },
    })) as SuggestionResponse & { error?: string };

    if (data.error) throw new Error(data.error);

    const label = data.contextLabel ?? state.turnLabel;
    setContext(label, data.situation);

    currentBatch = {
      contactName,
      triggerKey,
      replies: data.replies ?? [],
      relationship: data.relationship,
      situation: data.situation,
    };

    renderMedia(data.media ?? []);
    renderCoach(data.coach ?? []);
    renderSuggestions(data.replies ?? []);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Something went wrong";
    setStatus(msg, true);
  } finally {
    isLoading = false;
    setLoading(false);
    if (pendingFetch) {
      pendingFetch = false;
      void fetchSuggestions(true);
    }
  }
}

function scheduleChatUpdate(): void {
  if (chatUpdateTimer) clearTimeout(chatUpdateTimer);
  chatUpdateTimer = setTimeout(() => {
    chatUpdateTimer = null;
    onChatUpdate();
  }, 350);
}

function onChatUpdate(): void {
  const contactName = getContactName();
  if (!contactName) return;

  if (contactName !== lastContact) {
    lastContact = contactName;
    lastTriggerKey = "";
    lastQuickChatKey = "";
  }

  const messages = extractLiveMessages();
  const key = conversationTriggerKey(contactName, messages);
  if (!key || key === lastTriggerKey) return;

  const state = analyzeConversation(contactName, messages);

  if (quickChatEnabled && state) {
    if (state.replyMode === "follow_up_mine") {
      lastTriggerKey = key;
      setContext("Quick chat · waiting", "You spoke last — no auto follow-ups");
      setStatus("Quick chat pauses until they reply");
      return;
    }

    if (state.replyMode === "reply_to_them" && key !== lastQuickChatKey) {
      void runQuickChat(contactName, messages, state, key);
      return;
    }
  }

  if (isLoading || quickChatBusy) {
    pendingFetch = true;
    return;
  }

  void fetchSuggestions();
}

function observeChat(): void {
  const main = document.querySelector("#main") ?? document.body;
  new MutationObserver(() => scheduleChatUpdate()).observe(main, {
    childList: true,
    subtree: true,
  });

  const app = document.querySelector("#app") ?? document.body;
  new MutationObserver(() => {
    const contactName = getContactName();
    if (contactName && contactName !== lastContact) {
      lastContact = contactName;
      lastTriggerKey = "";
      scheduleChatUpdate();
    }
  }).observe(app, { childList: true, subtree: true });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.settings) {
      void refreshProfileStatus();
      lastTriggerKey = "";
      scheduleChatUpdate();
    }
  });
}

function init(): void {
  createPanel();
  observeChat();
  (window as unknown as { helpmechatDebug?: () => void; helpmechatDebugSend?: () => void }).helpmechatDebug =
    () => debugMessageClassification(15);
  (window as unknown as { helpmechatDebugSend?: () => void }).helpmechatDebugSend =
    () => debugComposeSend();
  setTimeout(onChatUpdate, 800);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
