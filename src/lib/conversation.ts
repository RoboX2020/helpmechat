import type { ConversationState, InformalityLevel, LiveMessage, ReplyMode } from "./types";

export type { ConversationState, InformalityLevel, ReplyMode };

function wordCount(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

function detectInformality(recent: LiveMessage[]): {
  level: InformalityLevel;
  avgWords: number;
  maxWords: number;
  hint: string;
} {
  const texts = recent.map((m) => m.text);
  const joined = texts.join(" ").toLowerCase();
  const avgWords =
    recent.length > 0
      ? recent.reduce((s, m) => s + wordCount(m.text), 0) / recent.length
      : 8;

  let score = 0;
  if (/\b(lol|lmao|haha|hehe|bro|ya|yeah|yep|nah|nvm|omg|idk|tbh|ngl|wbu|wyd)\b/.test(joined))
    score += 2;
  if (/\b(arre|yaar|bhai|mat|kya|hai|nahi|na|accha|acha|sun|bol|dekh|mast|bas|thik|theek|bohot|bahut)\b/.test(joined))
    score += 2;
  if (/\b(u|ur|r|pls|thx|tmrw|gonna|wanna|kinda|sorta|tu|tum|teri|tera|meri|mera)\b/.test(joined))
    score += 2;
  if (/[!?]{2,}|\.{3}|:\)|:D|😂|🙂|❤|💀|🔥/.test(joined)) score += 1;
  if (avgWords <= 5) score += 3;
  else if (avgWords <= 10) score += 2;
  else if (avgWords <= 18) score += 1;
  if (/\b(dear|regards|sincerely|please find|kindly|would you mind)\b/.test(joined)) score -= 2;

  let level: InformalityLevel = "neutral";
  if (score >= 5 || avgWords <= 6) level = "very_casual";
  else if (score >= 2 || avgWords <= 12) level = "casual";
  else if (avgWords >= 28 || score <= -1) level = "formal";

  const maxWords =
    level === "very_casual"
      ? Math.max(3, Math.min(Math.ceil(avgWords * 1.4), 10))
      : level === "casual"
        ? Math.max(5, Math.min(Math.ceil(avgWords * 1.35), 18))
        : level === "formal"
          ? Math.max(12, Math.min(Math.ceil(avgWords * 1.25), 45))
          : Math.max(8, Math.min(Math.ceil(avgWords * 1.3), 28));

  const hint =
    level === "very_casual"
      ? `Ultra-informal thread (~${Math.round(avgWords)} words/msg). Replies MUST be tiny — same length as theirs. No paragraphs. No formal phrasing.`
      : level === "casual"
        ? `Casual thread (~${Math.round(avgWords)} words/msg). Keep replies short and loose. Never write an essay.`
        : level === "formal"
          ? `More formal/longer thread (~${Math.round(avgWords)} words/msg). Complete sentences OK but stay concise.`
          : `Neutral tone (~${Math.round(avgWords)} words/msg). Match their message length closely.`;

  return { level, avgWords, maxWords, hint };
}

function trailingBlock(messages: LiveMessage[]): string {
  if (messages.length === 0) return "";
  const last = messages[messages.length - 1];
  const parts = [last.text];
  for (let i = messages.length - 2; i >= 0; i--) {
    if (messages[i].isMe !== last.isMe) break;
    parts.unshift(messages[i].text);
  }
  return parts.join("\n");
}

export function analyzeConversation(
  contactName: string,
  messages: LiveMessage[]
): ConversationState | null {
  if (messages.length === 0) return null;

  const last = messages[messages.length - 1];
  const replyMode: ReplyMode = last.isMe ? "follow_up_mine" : "reply_to_them";
  const recent = messages.slice(-14);
  const { level, avgWords, maxWords, hint } = detectInformality(recent);
  const pendingBlock = trailingBlock(messages);

  const turnLabel =
    replyMode === "reply_to_them"
      ? `Reply to ${contactName}`
      : "Follow-up (you spoke last)";

  return {
    replyMode,
    lastSender: last.isMe ? "me" : "them",
    pendingBlock,
    informality: level,
    avgWordsInThread: avgWords,
    maxWordsPerReply: maxWords,
    turnLabel,
    styleHint: hint,
  };
}

export function conversationTriggerKey(
  contactName: string,
  messages: LiveMessage[]
): string | null {
  if (messages.length === 0) return null;
  const i = messages.length - 1;
  const m = messages[i];
  return `${contactName}::${i}::${m.isMe ? "M" : "T"}::${m.text}`;
}

export function formatThreadForAI(
  contactName: string,
  messages: LiveMessage[]
): string {
  return messages
    .slice(-20)
    .map((m, idx) => {
      const tag = m.isMe ? "ME (I sent)" : `${contactName} (they sent)`;
      return `${idx + 1}. [${tag}]: ${m.text}`;
    })
    .join("\n");
}

/** Context before ME's last block + ME's block — for follow-up mode only */
export function formatFollowUpContext(
  contactName: string,
  messages: LiveMessage[]
): { earlier: string; myLastMessages: string } {
  const recent = messages.slice(-20);
  if (recent.length === 0) return { earlier: "", myLastMessages: "" };

  let blockStart = recent.length - 1;
  while (blockStart > 0 && recent[blockStart - 1].isMe) blockStart--;

  const earlier = recent
    .slice(0, blockStart)
    .map((m) => `${m.isMe ? "ME" : contactName}: ${m.text}`)
    .join("\n");

  const myLastMessages = recent
    .slice(blockStart)
    .map((m) => m.text)
    .join("\n");

  return { earlier, myLastMessages };
}
