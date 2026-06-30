import type { SuggestionPick } from "./types";

const MAX_PICKS_PER_CONTACT = 15;

/** Conservative hint from past picks — soft bias only, never overrides context. */
export function buildPreferenceHint(
  contactName: string,
  picks: SuggestionPick[]
): string {
  const recent = picks
    .filter((p) => p.contactName === contactName)
    .slice(-MAX_PICKS_PER_CONTACT);

  if (recent.length < 2) return "";

  const lastN = recent.slice(-6);
  const avgIndex = lastN.reduce((s, p) => s + p.pickedIndex, 0) / lastN.length;
  const avgWords =
    lastN.reduce((s, p) => s + p.pickedText.split(/\s+/).filter(Boolean).length, 0) /
    lastN.length;

  const parts: string[] = [
    `LEARNED (soft hint — adapt, don't copy blindly): In chats with ${contactName}, user picked ${lastN.length} suggestions recently.`,
  ];

  if (avgIndex >= 3) {
    parts.push("They often choose bolder/creative options (4th–5th) — lean creative but stay natural.");
  } else if (avgIndex >= 1.8) {
    parts.push("They mix safe and bold — keep variety with slight lean toward mid/bold options.");
  } else {
    parts.push("They often pick direct/safe early options — keep #1–2 strong and concise.");
  }

  parts.push(`Picked messages run ~${Math.round(avgWords)} words.`);

  const examples = lastN
    .slice(-2)
    .map((p) => p.pickedText.slice(0, 70))
    .filter(Boolean);
  if (examples.length) {
    parts.push(`Tone they actually sent: ${examples.map((e) => `'${e}'`).join(" · ")}`);
  }

  return parts.join(" ");
}

export function appendPick(
  existing: SuggestionPick[],
  pick: SuggestionPick
): SuggestionPick[] {
  const filtered = existing.filter(
    (p) =>
      !(
        p.contactName === pick.contactName &&
        p.triggerKey === pick.triggerKey &&
        p.pickedIndex === pick.pickedIndex
      )
  );
  return [...filtered, pick].slice(-MAX_PICKS_PER_CONTACT * 3);
}

export function picksForContact(
  all: SuggestionPick[],
  contactName: string
): SuggestionPick[] {
  return all.filter((p) => p.contactName === contactName).slice(-MAX_PICKS_PER_CONTACT);
}
