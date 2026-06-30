import type { LiveMessage } from "./types";

/**
 * WhatsApp Web tags each message row:
 * - data-id="true_..."  → sent by you
 * - data-id="false_..." → received from contact
 * - .message-out / .message-in on the row
 * - tick marks only on sent messages
 */
function readDataIdFromMe(dataId: string | null): boolean | null {
  if (!dataId) return null;
  if (dataId.startsWith("true_")) return true;
  if (dataId.startsWith("false_")) return false;
  return null;
}

function findMessageRow(node: Element): Element {
  const withId = node.closest("[data-id]");
  if (withId?.getAttribute("data-id")?.match(/^(true|false)_/)) {
    return withId;
  }
  const withClass = node.closest(".message-out, .message-in");
  if (withClass) return withClass;
  return node.closest('[data-testid="msg-container"]') ?? node;
}

function hasSentCheckmarks(row: Element): boolean {
  return Boolean(
    row.querySelector(
      '[data-testid="msg-check"], [data-testid="msg-dblcheck"], [data-testid="msg-dblcheck-ack"], [data-testid="msg-time-check"], [data-icon="msg-check"], [data-icon="msg-dblcheck"], [data-icon="msg-dblcheck-ack"]'
    )
  );
}

export function classifyMessageSender(node: Element): "me" | "them" {
  const row = findMessageRow(node);

  const fromDataId = readDataIdFromMe(row.getAttribute("data-id"));
  if (fromDataId !== null) return fromDataId ? "me" : "them";

  const parentId = row.parentElement?.closest("[data-id]")?.getAttribute("data-id") ?? null;
  const fromParentId = readDataIdFromMe(parentId);
  if (fromParentId !== null) return fromParentId ? "me" : "them";

  if (row.classList.contains("message-out") || row.closest(".message-out")) return "me";
  if (row.classList.contains("message-in") || row.closest(".message-in")) return "them";

  if (hasSentCheckmarks(row)) return "me";

  // Newer layouts: row aligned right = sent
  const bubble = row.querySelector('[data-testid="msg-container"]') ?? row;
  const style = window.getComputedStyle(bubble);
  const parentStyle = bubble.parentElement
    ? window.getComputedStyle(bubble.parentElement)
    : null;
  if (
    style.marginLeft === "auto" ||
    style.alignSelf === "flex-end" ||
    parentStyle?.justifyContent === "flex-end"
  ) {
    return "me";
  }

  return "them";
}

function messageIsMe(node: Element): boolean {
  return classifyMessageSender(node) === "me";
}

function readStickerOrGif(root: Element): string | null {
  const sticker =
    root.querySelector('[data-testid="sticker"]') ??
    root.querySelector('[data-testid="sticker-img"]') ??
    root.querySelector('img[src*="sticker"]');

  if (sticker) {
    const img = sticker.querySelector("img") ?? (sticker instanceof HTMLImageElement ? sticker : null);
    const alt = img?.alt?.trim() || img?.getAttribute("data-plain-text")?.trim();
    const title = sticker.getAttribute("aria-label")?.trim();
    return `[sticker: ${alt || title || "sticker"}]`;
  }

  const gif =
    root.querySelector('[data-testid="gif"]') ??
    root.querySelector('[data-testid="video-msg"]') ??
    root.querySelector("video");

  if (gif) {
    const label =
      gif.getAttribute("aria-label")?.trim() ||
      gif.querySelector("img")?.alt?.trim() ||
      "animated GIF";
    return `[gif: ${label}]`;
  }

  return null;
}

function readText(root: Element): string | null {
  const textEl =
    root.querySelector('[data-testid="msg-text"] span.selectable-text') ??
    root.querySelector(".copyable-text span.selectable-text") ??
    root.querySelector('[data-testid="conversation-text"]') ??
    root.querySelector('[data-testid="msg-text"]') ??
    root.querySelector("span.selectable-text.copyable-text");

  const text = textEl?.textContent?.trim();
  if (text) return text;

  // Emoji-only / fragmented spans
  const copyable = root.querySelector(".copyable-text");
  const fallback = copyable?.textContent?.trim();
  return fallback || null;
}

function rowKey(row: Element, text: string): string {
  const id = row.getAttribute("data-id");
  if (id) return id;
  return `${messageIsMe(row) ? "M" : "T"}::${text.slice(0, 80)}`;
}

function extractFromRow(row: Element): LiveMessage | null {
  const isMe = messageIsMe(row);
  const media = readStickerOrGif(row);
  if (media) {
    return {
      text: media,
      isMe,
      kind: media.startsWith("[gif") ? "gif" : "sticker",
    };
  }

  const text = readText(row);
  if (!text) return null;

  return { text, isMe, kind: "text" };
}

function collectRows(): Element[] {
  const main = document.querySelector("#main") ?? document.body;

  const candidates = main.querySelectorAll(
    'div.focusable-list-item[data-id^="true_"], div.focusable-list-item[data-id^="false_"], .message-in, .message-out'
  );

  const rows: Element[] = [];
  const seenIds = new Set<string>();

  candidates.forEach((el) => {
    const row = el.classList.contains("message-in") || el.classList.contains("message-out") || el.hasAttribute("data-id")
      ? el
      : el.closest('.message-in, .message-out, [data-id^="true_"], [data-id^="false_"]');

    if (!row || !(row instanceof Element)) return;

    const id = row.getAttribute("data-id");
    if (id) {
      if (seenIds.has(id)) return;
      seenIds.add(id);
    }

    // Skip nested duplicates: prefer outermost row per data-id
    rows.push(row);
  });

  if (rows.length > 0) {
    return rows.sort((a, b) => {
      const pos = a.compareDocumentPosition(b);
      if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
      if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
      return 0;
    });
  }

  return Array.from(main.querySelectorAll('[data-testid="msg-container"]'));
}

export function extractLiveMessages(): LiveMessage[] {
  const rows = collectRows();
  const messages: LiveMessage[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const msg = extractFromRow(row);
    if (!msg) continue;

    const key = rowKey(row, msg.text);
    if (seen.has(key)) continue;
    seen.add(key);

    messages.push(msg);
  }

  return messages;
}

/** For debugging in console: log last N messages with sender tags */
export function debugMessageClassification(limit = 10): void {
  const msgs = extractLiveMessages().slice(-limit);
  console.table(
    msgs.map((m) => ({
      sender: m.isMe ? "ME (sent)" : "THEM (received)",
      text: m.text.slice(0, 60),
      kind: m.kind ?? "text",
    }))
  );
}
