import { GEMINI_CONFIG } from "./config";
import {
  analyzeConversation,
  formatFollowUpContext,
  formatThreadForAI,
} from "./conversation";
import {
  buildRelationshipBrief,
  detectLanguageMix,
} from "./relationship";
import type { CoachItem, ConversationState, MediaItem } from "./types";
import type {
  CommunicationProfile,
  ConversationSnapshot,
  ParsedChatExport,
  QuickChatResponse,
  SuggestionResponse,
} from "./types";
import { formatMessagesForPrompt } from "./parser";

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  error?: { code?: number; message?: string; status?: string };
}

import { parseProfileJson, parseQuickChatJson, parseSuggestionJson, normalizeReplyList } from "./json-parse";

function isRetryableError(status: number, message: string): boolean {
  if ([429, 500, 503, 504].includes(status)) return true;
  const m = message.toLowerCase();
  return (
    m.includes("overloaded") ||
    m.includes("unavailable") ||
    m.includes("resource exhausted") ||
    m.includes("capacity") ||
    m.includes("try again") ||
    m.includes("high demand")
  );
}

async function callGeminiOnce(
  systemPrompt: string,
  userPrompt: string,
  model: string,
  maxOutputTokens?: number,
  temperature = 0.92
): Promise<string> {
  const { apiKey, apiBaseUrl } = GEMINI_CONFIG;
  const base = apiBaseUrl.replace(/\/$/, "");
  const url = `${base}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const generationConfig: Record<string, unknown> = {
    temperature,
    responseMimeType: "application/json",
  };
  if (maxOutputTokens) generationConfig.maxOutputTokens = maxOutputTokens;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("AI request timed out — tap refresh to try again");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  const data = (await response.json()) as GeminiResponse;
  if (!response.ok) {
    const msg = data.error?.message ?? `Gemini API error ${response.status}`;
    const err = new Error(msg) as Error & { status?: number };
    err.status = response.status;
    throw err;
  }

  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.[0]?.text?.trim();
  const reason = candidate?.finishReason ?? "";

  if (reason === "SAFETY" || reason === "BLOCKLIST") {
    throw new Error("Response blocked — try a different chat");
  }

  if (!text) throw new Error("Empty response from Gemini");
  return text;
}

async function callGeminiWithFallback(
  systemPrompt: string,
  userPrompt: string,
  models: string[],
  maxOutputTokens?: number,
  temperature = 0.92
): Promise<string> {
  let lastError: Error | null = null;

  for (let i = 0; i < models.length; i++) {
    try {
      return await callGeminiOnce(
        systemPrompt,
        userPrompt,
        models[i],
        maxOutputTokens,
        temperature
      );
    } catch (err) {
      const e = err as Error & { status?: number };
      lastError = e;
      if (!isRetryableError(e.status ?? 0, e.message) || i === models.length - 1) throw e;
    }
  }

  throw lastError ?? new Error("All models failed");
}

const PROFILE_SYSTEM = `You are a communication analyst. Analyze exported chat logs and extract deep, actionable patterns about how the user communicates.

Return JSON with this exact structure:
{
  "myStyle": {
    "tone": "overall tone description",
    "vocabulary": "word choices, slang, formality level",
    "emojiUsage": "how and when they use emojis",
    "messageLength": "short bursts vs paragraphs",
    "humorStyle": "dry, playful, self-deprecating, etc.",
    "formality": "casual/formal spectrum"
  },
  "situationalPatterns": [
    {
      "context": "e.g. flirting, apologizing, making plans, deep talk",
      "toneShift": "how tone changes in this context",
      "examplePhrases": ["2-3 actual phrases they use"]
    }
  ],
  "analysisSummary": "2-3 paragraph deep summary: personality in text, strengths, awkward spots, how they come across romantically/platonically, what feels authentic vs forced",
  "participants": ["list of other people in the chats"]
}

Be specific. Quote actual patterns from the messages. This powers a reply assistant — make it useful.`;

export async function analyzeExports(
  exports: ParsedChatExport[]
): Promise<Omit<CommunicationProfile, "id" | "createdAt" | "sourceFiles">> {
  const combined = exports
    .map(
      (e) =>
        `=== Chat: ${e.chatName} (participants: ${e.participants.join(", ")}, you are: ${e.myName}) ===\n${formatMessagesForPrompt(e.messages, 150)}`
    )
    .join("\n\n");

  const raw = await callGeminiWithFallback(
    PROFILE_SYSTEM,
    `Analyze these WhatsApp exports. The user's name in chats is one of the participants — infer who "ME" is from context.\n\n${combined}`,
    GEMINI_CONFIG.profileModels,
    undefined,
    0.85
  );

  return parseProfileJson(raw);
}

const CORE_SYSTEM = `You are HelpMeChat — an elite ghostwriter for Indian WhatsApp. You write AS ME (the user), never as the other person.

WORKFLOW (do this mentally before writing):
1) Read contact name + full thread
2) Decide who they likely are: brother/friend/crush/girlfriend/relative/colleague — from name + how we talk
3) Read the situation: angry? flirting? planning? need excuse? cold reply?
4) Write 5 replies ME would actually send — bold, human, Hinglish if the chat is Hinglish

- NEVER use double-quote characters inside reply text (use single quotes or rephrase)
- If a reply needs a line break, keep it on one line — no literal newlines inside JSON strings

Return JSON ONLY:
{
  "relationship": "1 line: who they likely are to ME and confidence",
  "situation": "1 line: what's happening right now emotionally",
  "replies": ["5 copy-paste WhatsApp messages from ME"],
  "coach": [0-1 items for links/facts only],
  "media": [1-3 items — GIFs, memes, images; see below]
}

REPLY MIX (always 5, all must be full sendable messages):
1) Safe/direct — fits the vibe
2) Creative EXCUSE woven into actual text if needed ("arre yaar kal itna busy tha", "rishtedaar aaye hue the ghar pe", "phone off tha bhai")
3) Bold MOVE — made-up plan, surprise, smooth recovery ("acha sun shaam ko mil, surprise hai tere liye", "kal pakka, scene set kar raha hoon")
4) Playful/flirty OR bro-energy OR family-warm — match relationship
5) Short punchy option — minimal words if thread is short

RULES:
- Match language: Hinglish chat → Hinglish replies. Never stiff English in desi banter.
- Match length: short thread = short replies. NO essays in quick back-and-forth.
- Invent believable details (plans, excuses, stories) — sound real, not AI
- If they're angry/upset: de-escalate + charm + concrete plan in the message itself
- If crush/flirty: confident, not creepy, not pick-up-artist
- If brother/friend: yaar/bhai energy, roasts OK
- If relative: respectful but still natural WhatsApp tone
- Stickers show as [sticker: ...] — match energy; suggest media when a GIF/meme fits better than words
- NEVER write as the other person responding to ME
- Push creativity — be the friend who always knows what to text

MEDIA array (1-3 when visual fits — funny, flirty, apology, celebration, angry meme):
{"type":"gif|meme|image|sticker|video","label":"3-5 word title","url":"HTTPS link — prefer giphy.com/search/TERM, tenor.com/search/TERM-gifs, or direct media.giphy.com/... URL","previewUrl":"optional thumbnail URL if known"}
Examples: giphy search for awkward smile, tenor for happy dance, meme for roast banter. Real working URLs only.`;

const FALLBACK_SYSTEM = `You write WhatsApp replies for ME (the user). Return ONLY valid JSON, nothing else:
{"replies":["message1","message2","message3","message4","message5"]}

Rules: exactly 5 strings, copy-paste ready, match the chat language (Hinglish if desi). No double-quote characters inside messages. No newlines inside strings.`;

function parseRepliesFromRaw(raw: string): string[] {
  return normalizeReplyList(parseSuggestionJson(raw).replies);
}

function buildSharedContext(
  snapshot: ConversationSnapshot,
  state: ConversationState,
  profile: CommunicationProfile | null,
  preferenceHint?: string
): string {
  const thread = formatThreadForAI(snapshot.contactName, snapshot.messages);
  const relationshipBrief = buildRelationshipBrief(snapshot.contactName, snapshot.messages);
  const lang = detectLanguageMix(snapshot.messages);

  let profileBlock = "";
  if (profile?.myStyle) {
    profileBlock = `ME's real voice (from past chats): ${profile.myStyle.tone}. Vocab: ${profile.myStyle.vocabulary}. Humor: ${profile.myStyle.humorStyle}. Formality: ${profile.myStyle.formality}. Typical length: ${profile.myStyle.messageLength}.\n`;
  }

  const prefBlock = preferenceHint?.trim()
    ? `\n=== USER PICK HISTORY (soft hint only) ===\n${preferenceHint}\n`
    : "";

  return `${profileBlock}${prefBlock}
=== WHO AM I TEXTING ===
${relationshipBrief}

Language of thread: ${lang}
Informality: ${state.informality}. ${state.styleHint}
Hard max ~${state.maxWordsPerReply} words per reply unless situation needs one slightly longer smooth line.

=== FULL THREAD (numbered, oldest→newest) ===
${thread}`;
}

function buildReplyToThemPrompt(
  snapshot: ConversationSnapshot,
  state: ConversationState,
  profile: CommunicationProfile | null,
  preferenceHint?: string
): string {
  return `${buildSharedContext(snapshot, state, profile, preferenceHint)}

=== MY TASK ===
MODE: REPLY TO THEM
${snapshot.contactName}'s latest message(s) — ME must respond TO this:
"""
${state.pendingBlock}
"""

Write 5 replies AS ME addressing ${snapshot.contactName}. Include at least one creative excuse AND one bold plan/surprise/smooth line IN the reply text when the situation allows.`;
}

function buildFollowUpPrompt(
  snapshot: ConversationSnapshot,
  state: ConversationState,
  profile: CommunicationProfile | null,
  preferenceHint?: string
): string {
  const { earlier, myLastMessages } = formatFollowUpContext(
    snapshot.contactName,
    snapshot.messages
  );

  return `${buildSharedContext(snapshot, state, profile, preferenceHint)}

=== MY TASK ===
MODE: FOLLOW-UP / DOUBLE-TEXT (ME spoke last)
ME already sent:
"""
${myLastMessages}
"""

${earlier ? `Earlier context:\n${earlier}\n` : ""}
Write 5 MORE messages from ME — continuing, clarifying, adding a plan, or dropping a smooth follow-up. NOT ${snapshot.contactName} replying to ME.
Examples of good follow-ups: "wait sun", "acha ek baat bata", "kal pakka milte hai", "btw rishtedaar the isliye reply nahi kar paya".
Include creative excuses or made-up plans IN the message text when useful.`;
}

function normalizeCoach(
  items: Array<{ type?: string; label?: string; content?: string }> | undefined
): CoachItem[] {
  if (!items?.length) return [];
  const valid = new Set(["link", "fact", "gif", "sticker", "idea", "excuse"]);
  return items
    .filter((c) => c.content?.trim() && c.label?.trim())
    .map((c) => ({
      type: (valid.has(c.type ?? "") ? c.type : "idea") as CoachItem["type"],
      label: c.label!.trim(),
      content: c.content!.trim(),
    }))
    .slice(0, 2);
}

function normalizeMedia(
  items: Array<{ type?: string; label?: string; url?: string; previewUrl?: string }> | undefined
): MediaItem[] {
  if (!items?.length) return [];
  const valid = new Set(["gif", "meme", "image", "sticker", "video"]);
  return items
    .filter((m) => m.url?.trim() && m.label?.trim() && /^https?:\/\//i.test(m.url.trim()))
    .map((m) => ({
      type: (valid.has(m.type ?? "") ? m.type : "gif") as MediaItem["type"],
      label: m.label!.trim(),
      url: m.url!.trim(),
      previewUrl: m.previewUrl?.trim().startsWith("http") ? m.previewUrl.trim() : undefined,
    }))
    .slice(0, 3);
}

export async function getReplySuggestions(
  snapshot: ConversationSnapshot,
  profile: CommunicationProfile | null,
  preferenceHint?: string
): Promise<SuggestionResponse> {
  const state =
    snapshot.state ?? analyzeConversation(snapshot.contactName, snapshot.messages);
  if (!state) return { replies: [], contextLabel: "", coach: [] };

  const isFollowUp = state.replyMode === "follow_up_mine";
  const userPrompt = isFollowUp
    ? buildFollowUpPrompt(snapshot, state, profile, preferenceHint)
    : buildReplyToThemPrompt(snapshot, state, profile, preferenceHint);

  let raw = await callGeminiWithFallback(
    CORE_SYSTEM,
    userPrompt,
    GEMINI_CONFIG.replyModels,
    2048,
    0.94
  );

  let parsed = parseSuggestionJson(raw);
  let replies = parseRepliesFromRaw(raw);

  if (replies.length === 0) {
    const shortPrompt = `${isFollowUp ? "FOLLOW-UP: ME spoke last, write 5 more messages from ME." : `REPLY TO ${snapshot.contactName}:`}\nTheir/latest context:\n${state.pendingBlock}\n\nThread tail:\n${formatThreadForAI(snapshot.contactName, snapshot.messages.slice(-8))}`;

    raw = await callGeminiWithFallback(
      FALLBACK_SYSTEM,
      shortPrompt,
      GEMINI_CONFIG.replyModels,
      1024,
      0.85
    );
    parsed = parseSuggestionJson(raw);
    replies = parseRepliesFromRaw(raw);
  }

  if (replies.length === 0) {
    throw new Error("AI returned no replies — tap refresh or send another message");
  }

  const relationship = parsed.relationship?.trim() ?? "";
  const situation = parsed.situation?.trim() ?? "";
  const contextLabel = relationship
    ? `${state.turnLabel} · ${relationship}`
    : state.turnLabel;

  return {
    replies: replies.slice(0, 5),
    contextLabel,
    relationship,
    situation,
    coach: normalizeCoach(parsed.coach),
    media: normalizeMedia(parsed.media),
  };
}

const QUICK_CHAT_SYSTEM = `You are HelpMeChat Quick Chat — auto-reply ghostwriter for WhatsApp. Write ONE message AS ME (the user).

QUICK CHAT RULES (strict):
- Reply ONLY to their latest message — they spoke last
- Safe, warm, natural — match thread language (Hinglish if desi)
- Creative excuses OK when needed ("phone dead tha", "busy day", "network issue")
- NO COMMITMENTS: never promise meetings, dates, money, gifts, definite plans
- Avoid: pakka, 100%, definitely, "kal milte hain", "I'll pay", "I promise", concrete times/places
- Soft deflection OK: "dekhte hain", "shayad", "try karunga" — not binding promises
- Match message length — short thread = short reply
- No double-quote characters inside the reply text
- One copy-paste ready message only

Return JSON ONLY:
{"reply":"your single message here","situation":"1 line what's happening"}`;

function buildQuickChatPrompt(
  snapshot: ConversationSnapshot,
  state: ConversationState,
  profile: CommunicationProfile | null,
  preferenceHint?: string
): string {
  return `${buildSharedContext(snapshot, state, profile, preferenceHint)}

=== QUICK CHAT TASK ===
They sent:
"""
${state.pendingBlock}
"""

Write ONE safe reply AS ME to ${snapshot.contactName}. Excuses fine. No commitments or definite plans.`;
}

export async function getQuickChatReply(
  snapshot: ConversationSnapshot,
  profile: CommunicationProfile | null,
  preferenceHint?: string
): Promise<QuickChatResponse> {
  const state =
    snapshot.state ?? analyzeConversation(snapshot.contactName, snapshot.messages);
  if (!state) throw new Error("No conversation to reply to");
  if (state.replyMode !== "reply_to_them") {
    throw new Error("Quick chat only replies when they message you");
  }

  const userPrompt = buildQuickChatPrompt(snapshot, state, profile, preferenceHint);

  let raw = await callGeminiWithFallback(
    QUICK_CHAT_SYSTEM,
    userPrompt,
    GEMINI_CONFIG.replyModels,
    512,
    0.75
  );

  let parsed: { reply: string; situation?: string };
  try {
    parsed = parseQuickChatJson(raw);
  } catch {
    raw = await callGeminiWithFallback(
      `Return ONLY: {"reply":"one safe WhatsApp message from ME"}`,
      `Reply to ${snapshot.contactName}: ${state.pendingBlock}\nNo commitments. Excuses OK.`,
      GEMINI_CONFIG.replyModels,
      256,
      0.7
    );
    parsed = parseQuickChatJson(raw);
  }

  if (!parsed.reply?.trim()) {
    throw new Error("AI returned no quick chat reply");
  }

  return {
    reply: parsed.reply.trim(),
    situation: parsed.situation?.trim(),
  };
}

