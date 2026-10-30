// ============================================================================
// compose.ts - putting text INTO WhatsApp Web. The compose box is not a plain
// <input>: it's a Lexical rich-text editor, so setting .value does nothing -
// text must be inserted through the editor's own events (Lexical-aware, single
// insert, reliable send). Also rate-limits inserts and can auto-send.
// ============================================================================


let lastInsertAt = 0;
let lastInsertText = "";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function findMain(): HTMLElement | null {
  const main = document.querySelector("#main");
  return main instanceof HTMLElement ? main : null;
}

function findComposeEditor(): HTMLElement | null {
  const main = findMain();
  const root = main ?? document;

  const el =
    root.querySelector('[data-testid="conversation-compose-box-input"]') ??
    root.querySelector('footer [data-lexical-editor="true"]') ??
    root.querySelector('footer div[contenteditable="true"][role="textbox"]') ??
    root.querySelector('footer div[contenteditable="true"]') ??
    root.querySelector('[data-lexical-editor="true"]');

  return el instanceof HTMLElement ? el : null;
}

function readComposeText(editor: HTMLElement): string {
  return (editor.textContent ?? "").replace(/\u200b/g, "").trim();
}

function clearCompose(editor: HTMLElement): void {
  editor.focus();
  document.execCommand("selectAll", false);
  document.execCommand("delete", false);
  if (readComposeText(editor)) {
    const sel = window.getSelection();
    if (sel) {
      sel.selectAllChildren(editor);
      sel.collapseToEnd();
    }
    document.execCommand("delete", false);
  }
}

/** Tell Lexical/React the compose content changed so Send enables. */
function notifyEditorChanged(editor: HTMLElement, text?: string): void {
  const data = text ?? readComposeText(editor);
  try {
    editor.dispatchEvent(
      new InputEvent("beforeinput", {
        bubbles: true,
        cancelable: true,
        inputType: "insertText",
        data,
      })
    );
  } catch {
    /* older browsers */
  }

  editor.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      cancelable: true,
      inputType: "insertText",
      data,
    })
  );
  editor.dispatchEvent(new Event("input", { bubbles: true }));
  editor.dispatchEvent(new Event("change", { bubbles: true }));
}

function looksDuplicated(result: string, trimmed: string): boolean {
  if (!result || !trimmed) return false;
  if (result === trimmed + trimmed) return true;
  if (result.length > trimmed.length * 1.6 && result.split(trimmed).length > 2) return true;
  return false;
}

function insertOnce(editor: HTMLElement, trimmed: string): string {
  clearCompose(editor);
  document.execCommand("insertText", false, trimmed);
  let result = readComposeText(editor);

  if (looksDuplicated(result, trimmed)) {
    clearCompose(editor);
    document.execCommand("insertText", false, trimmed);
    result = readComposeText(editor);
  }

  if (result) notifyEditorChanged(editor, result);
  return result;
}

export function insertIntoWhatsAppCompose(text: string, forSend = false): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;

  const now = Date.now();
  if (!forSend && trimmed === lastInsertText && now - lastInsertAt < 2000) {
    return true;
  }

  const editor = findComposeEditor();
  if (!editor) return false;

  if (readComposeText(editor) === trimmed) {
    notifyEditorChanged(editor, trimmed);
    lastInsertAt = now;
    lastInsertText = trimmed;
    return true;
  }

  editor.focus();
  let result = insertOnce(editor, trimmed);

  if (!result) {
    try {
      clearCompose(editor);
      const data = new DataTransfer();
      data.setData("text/plain", trimmed);
      editor.dispatchEvent(
        new ClipboardEvent("paste", {
          bubbles: true,
          cancelable: true,
          clipboardData: data,
        })
      );
      result = readComposeText(editor);
      if (looksDuplicated(result, trimmed)) {
        clearCompose(editor);
        document.execCommand("insertText", false, trimmed);
        result = readComposeText(editor);
      }
      if (result) notifyEditorChanged(editor, result);
    } catch {
      return false;
    }
  }

  const ok =
    result === trimmed ||
    (result.startsWith(trimmed) && result.length <= trimmed.length + 2);

  if (ok) {
    lastInsertAt = now;
    lastInsertText = trimmed;
    return true;
  }

  return Boolean(result);
}

function isClickable(el: Element): boolean {
  if (el instanceof HTMLButtonElement) {
    return !el.disabled && el.getAttribute("aria-disabled") !== "true";
  }
  const btn = el.closest("button");
  if (btn) return !btn.disabled && btn.getAttribute("aria-disabled") !== "true";
  const roleBtn = el.closest('[role="button"]');
  if (roleBtn instanceof HTMLElement) {
    return roleBtn.getAttribute("aria-disabled") !== "true";
  }
  return true;
}

function resolveClickTarget(el: Element): HTMLElement | null {
  if (el instanceof HTMLButtonElement) return el;
  const btn = el.closest("button");
  if (btn instanceof HTMLElement) return btn;
  const roleBtn = el.closest('[role="button"]');
  if (roleBtn instanceof HTMLElement) return roleBtn;
  if (el instanceof HTMLElement) return el;
  return null;
}

/** Find WhatsApp send control — mic icon swaps to send when compose has text. */
export function findSendButton(): HTMLElement | null {
  const main = findMain();
  if (!main) return null;

  const selectors = [
    'button[aria-label="Send"]',
    'button[aria-label="Send message"]',
    'span[data-testid="send"]',
    '[data-testid="send"]',
    'span[data-icon="send"]',
    '[data-icon="send"]',
    '[data-testid="compose-btn-send"]',
  ];

  for (const sel of selectors) {
    for (const el of main.querySelectorAll(sel)) {
      if (!isClickable(el)) continue;
      const target = resolveClickTarget(el);
      if (target) return target;
    }
  }

  const footer = main.querySelector("footer");
  if (footer) {
    for (const btn of footer.querySelectorAll("button")) {
      if (!isClickable(btn)) continue;
      if (
        btn.querySelector('[data-icon="send"], [data-testid="send"], span[data-icon="send"]')
      ) {
        return btn;
      }
      const label = btn.getAttribute("aria-label")?.toLowerCase() ?? "";
      if (label.includes("send") && !label.includes("voice")) return btn;
    }
  }

  return null;
}

async function waitForSendButton(maxMs = 3000): Promise<HTMLElement | null> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const btn = findSendButton();
    if (btn) return btn;
    await sleep(80);
  }
  return findSendButton();
}

function clickElement(el: HTMLElement): void {
  el.focus();
  el.dispatchEvent(
    new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window })
  );
  el.dispatchEvent(
    new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window })
  );
  el.dispatchEvent(
    new MouseEvent("click", { bubbles: true, cancelable: true, view: window })
  );
  el.click();
}

function sendViaEnterKey(editor: HTMLElement): void {
  editor.focus();
  const opts: KeyboardEventInit = {
    key: "Enter",
    code: "Enter",
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true,
  };
  editor.dispatchEvent(new KeyboardEvent("keydown", opts));
  editor.dispatchEvent(new KeyboardEvent("keypress", opts));
  editor.dispatchEvent(new KeyboardEvent("keyup", opts));
}

function composeWasCleared(editor: HTMLElement | null, sentText: string): boolean {
  if (!editor) return false;
  const remaining = readComposeText(editor);
  return !remaining || remaining !== sentText;
}

/** Click send or Enter — returns true if compose box cleared after. */
export async function sendWhatsAppMessage(expectedText?: string): Promise<boolean> {
  const editor = findComposeEditor();

  if (editor) {
    notifyEditorChanged(editor);
    await sleep(60);
  }

  const sendBtn = await waitForSendButton(2500);
  if (sendBtn) {
    clickElement(sendBtn);
    await sleep(350);
    if (composeWasCleared(editor, expectedText ?? "")) {
      lastInsertText = "";
      lastInsertAt = 0;
      return true;
    }
  }

  if (editor) {
    notifyEditorChanged(editor);
    sendViaEnterKey(editor);
    await sleep(350);
    if (composeWasCleared(editor, expectedText ?? "")) {
      lastInsertText = "";
      lastInsertAt = 0;
      return true;
    }
  }

  const retryBtn = findSendButton();
  if (retryBtn) {
    clickElement(retryBtn);
    await sleep(400);
    if (composeWasCleared(editor, expectedText ?? "")) {
      lastInsertText = "";
      lastInsertAt = 0;
      return true;
    }
  }

  return false;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  const trimmed = text.trim();
  if (!trimmed) return false;

  try {
    await navigator.clipboard.writeText(trimmed);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = trimmed;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export function openMediaUrl(url: string): void {
  if (/^https?:\/\//i.test(url)) {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

/** Insert into compose and send — Quick Chat mode. */
export async function pasteAndSend(text: string): Promise<"sent" | "pasted" | "failed"> {
  lastInsertText = "";
  lastInsertAt = 0;

  const trimmed = text.trim();
  if (!trimmed) return "failed";

  const inserted = insertIntoWhatsAppCompose(trimmed, true);
  if (!inserted) return "failed";

  const editor = findComposeEditor();
  if (editor) {
    notifyEditorChanged(editor, trimmed);
    await sleep(150);
    notifyEditorChanged(editor, trimmed);
  }

  const sent = await sendWhatsAppMessage(trimmed);
  return sent ? "sent" : "pasted";
}

/** Debug helper — run in console on WhatsApp tab */
export function debugComposeSend(): void {
  const editor = findComposeEditor();
  const send = findSendButton();
  console.table({
    editor: Boolean(editor),
    editorText: editor ? readComposeText(editor) : "",
    sendButton: Boolean(send),
    sendLabel: send?.getAttribute("aria-label") ?? send?.tagName ?? "",
  });
}
