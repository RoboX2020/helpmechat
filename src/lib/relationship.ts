// ============================================================================
// relationship.ts - guesses the human context: the likely relationship vibe
// (friend, crush, family...), the current situation (angry, flirty, planning,
// apology needed...), and language mix (English/Hinglish) - all used to brief
// the AI so replies sound right for THIS person, not generic.
// ============================================================================
import type { LiveMessage } from "./types";

export type NameGenderHint = "likely_male" | "likely_female" | "unknown";
export type SituationSignal =
  | "angry_or_upset"
  | "flirty"
  | "planning"
  | "apology_needed"
  | "casual_banter"
  | "deep_talk"
  | "ghosted_or_late_reply"
  | "unknown";

const FEMALE_SUFFIXES = /(a|i|ya|ika|een|vi|ni|sha|ita|priya|devi|bai|ben)$/i;
const MALE_HINTS =
  /\b(bhai|bro|yaar|bhaiya|dada|tau|chacha|mama|fufa|jija|devr|bhanja|beta|putter)\b/i;
const FEMALE_HINTS =
  /\b(didi|behen|ben|aunty|mummy|maa|nani|dadi|bhabhi|nanad|beti|gudiya|jaan|jaanu)\b/i;
const FAMILY_HINTS =
  /\b(mummy|papa|maa|dad|mom|bhai|behen|didi|bhabhi|chacha|mama|nani|dadi|family|ghar|gharpe|rishtedaar|relative|beta|beti)\b/i;

const ANGRY_HINTS =
  /\b(gussa|angry|annoyed|naraz|khafa|uthao mat|chup|bakwas|stupid|hate|block|ignore)\b|mat kar|mat bol|seriously\?|\?{2,}|!{2,}/i;
const FLIRTY_HINTS =
  /\b(jaan|jaanu|baby|babe|miss you|cute|handsome|beautiful|date|milte|single|crush|love you|pyaar|❤|😘|🥰|😍)\b/i;

export function guessNameGender(name: string): NameGenderHint {
  const first = name.trim().split(/\s+/)[0].toLowerCase();
  if (!first) return "unknown";

  const commonFemale =
    /^(priya|pooja|neha|anjali|kavya|shreya|aisha|sana|riya|diya|nisha|simran|kiran|meera|tanya|ishita|aditi|pari|muskan|sakshi|divya|ananya|radha|sita|geeta|lakshmi|swati|palak|ishani|navya|aarti|kajal|sonam|deepika|kareena|aliya|fatima|zara|heena|ruhi|suhana|myra|anvi|aadhya|kiara|naina|rhea|siya|trisha|vani|yamini|zoya)/;
  const commonMale =
    /^(rahul|rohan|amit|arjun|vikram|raj|karan|aditya|nikhil|varun|siddharth|rohit|manish|suresh|ramesh|ajay|vijay|sanjay|deepak|anil|vinod|prakash|akash|dev|kunal|harsh|yash|aarav|vihaan|advait|ishaan|krishna|shiv|om|aryan|devesh|gautam|hardik|jatin|lokesh|mohit|naveen|pankaj|ravi|sachin|tarun|uday|vivek)/;

  if (commonFemale.test(first)) return "likely_female";
  if (commonMale.test(first)) return "likely_male";
  if (FEMALE_SUFFIXES.test(first) && first.length > 2) return "likely_female";
  return "unknown";
}

export function detectSituationSignals(messages: LiveMessage[]): SituationSignal[] {
  const recent = messages.slice(-12);
  const theirs = recent.filter((m) => !m.isMe).map((m) => m.text).join(" ").toLowerCase();
  const all = recent.map((m) => m.text).join(" ").toLowerCase();
  const signals: SituationSignal[] = [];

  if (ANGRY_HINTS.test(theirs)) signals.push("angry_or_upset");
  if (FLIRTY_HINTS.test(all)) signals.push("flirty");
  if (/\b(kal|aaj|shaam|subah|mil|plan|movie|coffee|dinner|kab|time|free|available|pick|drop)\b/i.test(all))
    signals.push("planning");
  if (/\b(sorry|maaf|galti|my bad|didn't mean|won't happen|forgive)\b/i.test(all))
    signals.push("apology_needed");
  if (/\b(kahan|kya kar|reply|seen|online|itna time|late|busy|phone)\b/i.test(theirs))
    signals.push("ghosted_or_late_reply");
  if (/\b(feel|sad|stress|anxious|problem|help|advice|life|family issue)\b/i.test(all))
    signals.push("deep_talk");
  if (signals.length === 0) signals.push("casual_banter");

  return [...new Set(signals)];
}

export function buildRelationshipBrief(
  contactName: string,
  messages: LiveMessage[]
): string {
  const gender = guessNameGender(contactName);
  const recent = messages.slice(-20);
  const allText = recent.map((m) => m.text).join(" ").toLowerCase();
  const signals = detectSituationSignals(messages);

  const lines: string[] = [
    `Contact name (from chat header): "${contactName}"`,
    `Name gender hint: ${gender}`,
  ];

  if (gender === "likely_male") {
    lines.push(
      "If tone is bro-y/casual → likely friend or brother/cousin. If formal/respectful → elder relative or colleague."
    );
  } else if (gender === "likely_female") {
    lines.push(
      "If family words (mummy, didi, rishtedaar vibe, very normal/platonic) → relative. If casual/flirty/late-night banter → friend or crush. Read the chat — don't assume crush unless vibe supports it."
    );
  }

  if (FAMILY_HINTS.test(allText)) lines.push("Chat mentions family/home — lean relative/family dynamic.");
  if (MALE_HINTS.test(allText) && gender === "likely_male") lines.push("Uses bhai/yaar — close male friend or brother energy.");
  if (FEMALE_HINTS.test(allText)) lines.push("Uses didi/behen/jaan — check if familial or romantic from context.");

  lines.push(`Situation signals: ${signals.join(", ")}`);
  return lines.join("\n");
}

export function detectLanguageMix(messages: LiveMessage[]): "hinglish" | "english" | "hindi" | "mixed" {
  const text = messages
    .slice(-15)
    .map((m) => m.text)
    .join(" ")
    .toLowerCase();
  const hindi =
    /\b(haan|nahi|na|acha|accha|arre|yaar|bhai|mat|kya|hai|hoon|tha|thi|nhi|kyu|kyun|sun|bol|mil|kab|kal|aaj|shaam|subah|bohot|bahut|thik|theek|gussa|maaf|rishtedaar|ghar|yaad|sach|jhoot|pakka|scene|mast|badiya|chill|bas|dekh|sunna|bata|samjha|samajh|liye|tere|mera|meri|tera|teri|tu|tum|aap|ji)\b/i;
  const hinglish = hindi.test(text);
  const english = /\b(the|you|what|how|why|sorry|please|thanks|love|hate|busy|meeting)\b/i.test(text);

  if (hinglish && english) return "hinglish";
  if (hinglish) return "hindi";
  if (english) return "english";
  return "mixed";
}
