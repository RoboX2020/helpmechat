// ============================================================================
// json-parse.ts - tolerant parsing for LLM JSON. AI models frequently return
// almost-JSON: truncated output, smart quotes, trailing commas, extra prose
// around the object. This file salvages what it can (handles broken strings,
// wrong shapes, truncation) so a sloppy model response still yields usable
// suggestions instead of an error screen.
// ============================================================================


export interface ParsedSuggestionJson {
  relationship?: string;
  situation?: string;
  replies?: string[];
  coach?: Array<{ type?: string; label?: string; content?: string }>;
  media?: Array<{ type?: string; label?: string; url?: string; previewUrl?: string }>;
}

function stripFences(raw: string): string {
  let trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  if (fenced) trimmed = fenced[1].trim();
  // Smart / curly quotes → straight quotes
  return trimmed
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'");
}

function basicRepair(json: string): string {
  return json.replace(/,\s*([}\]])/g, "$1");
}

/** Close truncated JSON objects/arrays so JSON.parse has a chance. */
function closeTruncatedJson(json: string): string {
  let s = json.trim();
  if (s.startsWith("{") && !s.endsWith("}")) {
    // Close open string if odd number of unescaped quotes from last [
    const openBrackets = (s.match(/\[/g) ?? []).length - (s.match(/\]/g) ?? []).length;
    const openBraces = (s.match(/\{/g) ?? []).length - (s.match(/\}/g) ?? []).length;
    if (s.endsWith('"')) s += '"';
    else if (/[^\\]"[^"]*$/.test(s)) s += '"';
    for (let i = 0; i < openBrackets; i++) s += "]";
    for (let i = 0; i < openBraces; i++) s += "}";
  }
  return s;
}

export function normalizeReplyList(value: unknown): string[] {
  if (!value) return [];
  if (typeof value === "string" && value.trim()) return [value.trim()];
  if (!Array.isArray(value)) return [];

  const out: string[] = [];
  for (const item of value) {
    if (typeof item === "string" && item.trim()) {
      out.push(item.trim());
      continue;
    }
    if (item && typeof item === "object") {
      const o = item as Record<string, unknown>;
      for (const key of ["text", "reply", "message", "content", "suggestion"]) {
        if (typeof o[key] === "string" && (o[key] as string).trim()) {
          out.push((o[key] as string).trim());
          break;
        }
      }
    }
  }
  return out;
}

function pickRepliesFromObject(obj: Record<string, unknown>): string[] {
  for (const key of ["replies", "suggestions", "messages", "options", "responses"]) {
    const list = normalizeReplyList(obj[key]);
    if (list.length > 0) return list;
  }
  return [];
}

/** Walk a JSON string array after `"key": [` and collect string values leniently. */
function extractStringArray(source: string, key: string): string[] {
  const keyPattern = new RegExp(`"${key}"\\s*:\\s*\\[`, "i");
  const match = keyPattern.exec(source);
  if (!match) return [];

  let i = match.index + match[0].length;
  const results: string[] = [];
  let buf = "";
  let inString = false;
  let escaped = false;

  while (i < source.length) {
    const ch = source[i];

    if (!inString) {
      if (ch === "]") break;
      if (ch === '"') {
        inString = true;
        buf = "";
      }
      i++;
      continue;
    }

    if (escaped) {
      if (ch === "n") buf += "\n";
      else if (ch === "t") buf += "\t";
      else if (ch === "r") buf += "\r";
      else if (ch === '"') buf += '"';
      else buf += ch;
      escaped = false;
      i++;
      continue;
    }

    if (ch === "\\") {
      escaped = true;
      i++;
      continue;
    }

    if (ch === '"') {
      if (buf.trim()) results.push(buf.trim());
      inString = false;
      buf = "";
      i++;
      continue;
    }

    if (ch === "\n" || ch === "\r") {
      buf += " ";
      i++;
      continue;
    }

    buf += ch;
    i++;
  }

  if (inString && buf.trim()) results.push(buf.trim());
  return results;
}

/** Last resort: grab any quoted strings after "replies": */
function extractRepliesLoose(source: string): string[] {
  const idx = source.search(/"replies"\s*:/i);
  if (idx === -1) return [];
  const slice = source.slice(idx, idx + 4000);
  const results: string[] = [];
  const re = /"((?:\\.|[^"\\]){2,})"/g;
  let m: RegExpExecArray | null;
  let skippedFirst = false;
  while ((m = re.exec(slice)) !== null && results.length < 8) {
    const val = m[1].replace(/\\n/g, " ").replace(/\\"/g, '"').trim();
    if (!skippedFirst) {
      skippedFirst = true;
      continue;
    }
    if (val.length > 1 && !/^(relationship|situation|coach|link|fact|gif|sticker|idea|excuse)$/i.test(val)) {
      results.push(val);
    }
  }
  return results;
}

function extractStringField(source: string, key: string): string | undefined {
  const re = new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`, "i");
  const m = source.match(re);
  if (m) {
    return m[1].replace(/\\n/g, "\n").replace(/\\"/g, '"').trim();
  }
  return undefined;
}

function extractCoach(source: string): ParsedSuggestionJson["coach"] {
  const items: NonNullable<ParsedSuggestionJson["coach"]> = [];
  const coachStart = source.search(/"coach"\s*:/i);
  if (coachStart === -1) return items;

  const block = source.slice(coachStart, coachStart + 2500);
  const objRe =
    /\{\s*"type"\s*:\s*"([^"]+)"\s*,\s*"label"\s*:\s*"((?:\\.|[^"\\])*)"\s*,\s*"content"\s*:\s*"((?:\\.|[^"\\])*)"\s*\}/g;

  let m: RegExpExecArray | null;
  while ((m = objRe.exec(block)) !== null && items.length < 3) {
    items.push({
      type: m[1],
      label: m[2].replace(/\\n/g, "\n"),
      content: m[3].replace(/\\n/g, "\n"),
    });
  }
  return items;
}

function tryParseObject(text: string): ParsedSuggestionJson | null {
  const attempts = [text, basicRepair(text), closeTruncatedJson(text), closeTruncatedJson(basicRepair(text))];

  for (const attempt of attempts) {
    try {
      const parsed = JSON.parse(attempt) as unknown;
      if (Array.isArray(parsed)) {
        const replies = normalizeReplyList(parsed);
        if (replies.length) return { replies };
      }
      if (parsed && typeof parsed === "object") {
        const obj = parsed as Record<string, unknown>;
        const replies = pickRepliesFromObject(obj);
        if (replies.length) {
          return {
            relationship: typeof obj.relationship === "string" ? obj.relationship : undefined,
            situation: typeof obj.situation === "string" ? obj.situation : undefined,
            replies,
            coach: Array.isArray(obj.coach) ? (obj.coach as ParsedSuggestionJson["coach"]) : undefined,
            media: Array.isArray(obj.media) ? (obj.media as ParsedSuggestionJson["media"]) : undefined,
          };
        }
      }
    } catch {
      /* next */
    }
  }
  return null;
}

export function parseSuggestionJson(raw: string): ParsedSuggestionJson {
  const text = stripFences(raw);

  const fromObject = tryParseObject(text);
  if (fromObject?.replies?.length) return fromObject;

  const extracted =
    extractStringArray(text, "replies").length > 0
      ? extractStringArray(text, "replies")
      : extractRepliesLoose(text);

  return {
    relationship: extractStringField(text, "relationship"),
    situation: extractStringField(text, "situation"),
    replies: extracted,
    coach: extractCoach(text),
    media: extractMedia(text),
  };
}

function extractMedia(source: string): ParsedSuggestionJson["media"] {
  const items: NonNullable<ParsedSuggestionJson["media"]> = [];
  const start = source.search(/"media"\s*:/i);
  if (start === -1) return items;

  const block = source.slice(start, start + 3000);
  const objRe =
    /\{\s*"type"\s*:\s*"([^"]+)"\s*,\s*"label"\s*:\s*"((?:\\.|[^"\\])*)"\s*,\s*"url"\s*:\s*"((?:\\.|[^"\\])*)"(?:\s*,\s*"previewUrl"\s*:\s*"((?:\\.|[^"\\])*)")?\s*\}/g;

  let m: RegExpExecArray | null;
  while ((m = objRe.exec(block)) !== null && items.length < 4) {
    items.push({
      type: m[1],
      label: m[2].replace(/\\n/g, " "),
      url: m[3].replace(/\\n/g, " "),
      previewUrl: m[4]?.replace(/\\n/g, " "),
    });
  }
  return items;
}

const DEFAULT_MY_STYLE = {
  tone: "casual and friendly",
  vocabulary: "everyday language",
  emojiUsage: "moderate",
  messageLength: "short to medium",
  humorStyle: "playful",
  formality: "casual",
};

export function normalizeProfileShape(parsed: unknown): {
  myStyle: {
    tone: string;
    vocabulary: string;
    emojiUsage: string;
    messageLength: string;
    humorStyle: string;
    formality: string;
  };
  situationalPatterns: Array<{
    context: string;
    toneShift: string;
    examplePhrases: string[];
  }>;
  analysisSummary: string;
  participants: string[];
} {
  const p = (parsed && typeof parsed === "object" ? parsed : {}) as Record<string, unknown>;
  const rawStyle = (p.myStyle && typeof p.myStyle === "object" ? p.myStyle : {}) as Record<
    string,
    unknown
  >;

  const myStyle = {
    tone: String(rawStyle.tone || DEFAULT_MY_STYLE.tone),
    vocabulary: String(rawStyle.vocabulary || DEFAULT_MY_STYLE.vocabulary),
    emojiUsage: String(rawStyle.emojiUsage || DEFAULT_MY_STYLE.emojiUsage),
    messageLength: String(rawStyle.messageLength || DEFAULT_MY_STYLE.messageLength),
    humorStyle: String(rawStyle.humorStyle || DEFAULT_MY_STYLE.humorStyle),
    formality: String(rawStyle.formality || DEFAULT_MY_STYLE.formality),
  };

  const situationalPatterns = Array.isArray(p.situationalPatterns)
    ? p.situationalPatterns
        .filter((item) => item && typeof item === "object")
        .map((item) => {
          const row = item as Record<string, unknown>;
          return {
            context: String(row.context || "general"),
            toneShift: String(row.toneShift || ""),
            examplePhrases: Array.isArray(row.examplePhrases)
              ? row.examplePhrases.map(String).filter(Boolean).slice(0, 5)
              : [],
          };
        })
        .slice(0, 12)
    : [];

  const analysisSummary =
    typeof p.analysisSummary === "string" && p.analysisSummary.trim()
      ? p.analysisSummary.trim()
      : "Your communication profile was built from uploaded WhatsApp exports.";

  const participants = Array.isArray(p.participants)
    ? p.participants.map(String).filter(Boolean).slice(0, 50)
    : [];

  return { myStyle, situationalPatterns, analysisSummary, participants };
}

export function parseProfileJson(raw: string): ReturnType<typeof normalizeProfileShape> {
  const text = stripFences(raw);
  for (const attempt of [text, basicRepair(text), closeTruncatedJson(text)]) {
    try {
      return normalizeProfileShape(JSON.parse(attempt));
    } catch {
      /* next */
    }
  }
  throw new Error("Could not parse profile JSON");
}

export function parseQuickChatJson(raw: string): { reply: string; situation?: string } {
  const text = stripFences(raw);

  for (const attempt of [text, basicRepair(text), closeTruncatedJson(text)]) {
    try {
      const parsed = JSON.parse(attempt) as Record<string, unknown>;
      const direct =
        typeof parsed.reply === "string"
          ? parsed.reply.trim()
          : typeof parsed.replies === "object" && Array.isArray(parsed.replies)
            ? String(parsed.replies[0] ?? "").trim()
            : "";
      if (direct) {
        return {
          reply: direct,
          situation:
            typeof parsed.situation === "string" ? parsed.situation.trim() : undefined,
        };
      }
    } catch {
      /* next */
    }
  }

  const loose = extractStringField(text, "reply") || extractRepliesLoose(text)[0];
  if (loose?.trim()) {
    return {
      reply: loose.trim(),
      situation: extractStringField(text, "situation") || undefined,
    };
  }

  throw new Error("Could not parse quick chat reply");
}
