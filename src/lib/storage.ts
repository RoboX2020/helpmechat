import type { UserSettings, CommunicationProfile, ContactContext, SuggestionPick } from "./types";
import { appendPick, picksForContact, buildPreferenceHint } from "./preferences";

const DEFAULT_SETTINGS: UserSettings = {
  myDisplayName: "",
  profile: null,
  contactContexts: {},
  suggestionPicks: [],
};

export async function getSettings(): Promise<UserSettings> {
  const result = await chrome.storage.local.get("settings");
  const saved = result.settings as Partial<UserSettings> | undefined;
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    suggestionPicks: saved?.suggestionPicks ?? [],
  };
}

export async function saveSettings(partial: Partial<UserSettings>): Promise<UserSettings> {
  const current = await getSettings();
  const updated = { ...current, ...partial };
  await chrome.storage.local.set({ settings: updated });
  return updated;
}

export async function saveProfile(profile: CommunicationProfile): Promise<void> {
  await saveSettings({ profile });
}

export async function saveContactContext(
  name: string,
  context: ContactContext
): Promise<void> {
  const settings = await getSettings();
  await saveSettings({
    contactContexts: { ...settings.contactContexts, [name]: context },
  });
}

export async function getContactContext(name: string): Promise<ContactContext | null> {
  const settings = await getSettings();
  return settings.contactContexts[name] ?? null;
}

export async function recordSuggestionPick(pick: SuggestionPick): Promise<void> {
  const settings = await getSettings();
  await saveSettings({
    suggestionPicks: appendPick(settings.suggestionPicks, pick),
  });
}

export function getPreferenceHintForContact(
  settings: UserSettings,
  contactName: string
): string {
  return buildPreferenceHint(contactName, picksForContact(settings.suggestionPicks, contactName));
}
