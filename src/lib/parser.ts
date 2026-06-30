import type { ChatMessage, ParsedChatExport } from "./types";

/** WhatsApp export line: [DD/MM/YYYY, HH:MM:SS] Name: Message */
const LINE_REGEX =
  /^\[(\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[APMapm]{2})?)\]\s([^:]+):\s(.*)$/;

/** iOS format sometimes uses different date separators */
const LINE_REGEX_ALT =
  /^\[(\d{1,2}\/\d{1,2}\/\d{2,4},\s+\d{1,2}:\d{2}:\d{2})\]\s([^:]+):\s(.*)$/;

function parseLine(line: string): ChatMessage | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  let match = trimmed.match(LINE_REGEX) ?? trimmed.match(LINE_REGEX_ALT);
  if (!match) return null;

  const [, timestamp, sender, text] = match;
  return {
    timestamp,
    sender: sender.trim(),
    text: text.trim(),
    isMe: false,
  };
}

function inferMyName(participants: string[], hint?: string): string {
  if (hint && participants.includes(hint)) return hint;
  // Heuristic: "You" isn't in exports; user is often the most frequent sender in personal chats
  return participants[0] ?? "Me";
}

function chatNameFromFilename(filename: string): string {
  return filename.replace(/\.txt$/i, "").replace(/WhatsApp Chat with /i, "").trim();
}

export function parseWhatsAppExport(
  content: string,
  filename: string,
  myNameHint?: string
): ParsedChatExport {
  const lines = content.split(/\r?\n/);
  const messages: ChatMessage[] = [];
  let current: ChatMessage | null = null;

  for (const line of lines) {
    const parsed = parseLine(line);
    if (parsed) {
      if (current) messages.push(current);
      current = parsed;
    } else if (current && line.trim()) {
      // Multi-line message continuation
      current.text += "\n" + line.trim();
    }
  }
  if (current) messages.push(current);

  const senderCounts = new Map<string, number>();
  for (const m of messages) {
    senderCounts.set(m.sender, (senderCounts.get(m.sender) ?? 0) + 1);
  }

  const participants = [...senderCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);

  const myName = inferMyName(participants, myNameHint);

  for (const m of messages) {
    m.isMe = m.sender === myName;
  }

  return {
    chatName: chatNameFromFilename(filename),
    participants,
    messages,
    myName,
  };
}

/** Sample recent messages for contact-specific analysis */
export function sampleMessagesForAnalysis(
  messages: ChatMessage[],
  limit = 80
): ChatMessage[] {
  if (messages.length <= limit) return messages;
  const recent = messages.slice(-Math.floor(limit * 0.6));
  const older = messages.slice(0, Math.floor(limit * 0.4));
  return [...older, ...recent];
}

/** Format export for AI prompt (token-efficient) */
export function formatMessagesForPrompt(
  messages: ChatMessage[],
  maxMessages = 120
): string {
  const slice = messages.slice(-maxMessages);
  return slice
    .map((m) => {
      const role = m.isMe ? "ME" : m.sender.toUpperCase();
      return `[${role}]: ${m.text}`;
    })
    .join("\n");
}
