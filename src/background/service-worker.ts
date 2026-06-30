import type {
  AnalyzeExportPayload,
  CommunicationProfile,
  ExtensionMessage,
  GetQuickChatPayload,
  GetSuggestionsPayload,
  RecordPickPayload,
} from "../lib/types";
import { analyzeExports, getQuickChatReply, getReplySuggestions } from "../lib/ai";
import { parseWhatsAppExport } from "../lib/parser";
import {
  getPreferenceHintForContact,
  getSettings,
  recordSuggestionPick,
  saveProfile,
  saveSettings,
} from "../lib/storage";

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  handleMessage(message)
    .then(sendResponse)
    .catch((err: Error) => sendResponse({ error: err.message }));
  return true;
});

async function handleMessage(message: ExtensionMessage): Promise<unknown> {
  switch (message.type) {
    case "GET_SETTINGS":
      return getSettings();

    case "SAVE_SETTINGS":
      return saveSettings(message.payload as Parameters<typeof saveSettings>[0]);

    case "ANALYZE_EXPORT": {
      const { files, myName } = message.payload as AnalyzeExportPayload;
      if (!myName?.trim()) throw new Error("Enter your name as it appears in WhatsApp exports.");

      await saveSettings({ myDisplayName: myName.trim() });

      const parsed = files.map((f) =>
        parseWhatsAppExport(f.content, f.name, myName.trim())
      );
      const messageCount = parsed.reduce((n, p) => n + p.messages.length, 0);
      if (messageCount === 0) {
        throw new Error(
          "No messages found in exports. Check your name matches WhatsApp exactly and files are .txt exports."
        );
      }

      const analysis = await analyzeExports(parsed);

      const profile: CommunicationProfile = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        sourceFiles: files.map((f) => f.name),
        ...analysis,
      };

      await saveProfile(profile);
      return {
        profile,
        parsedCount: parsed.length,
        messageCount: parsed.reduce((n, p) => n + p.messages.length, 0),
      };
    }

    case "GET_SUGGESTIONS": {
      const { snapshot } = message.payload as GetSuggestionsPayload;
      const settings = await getSettings();
      if (!settings.profile) {
        throw new Error("Build your profile first — extension icon → Get started");
      }
      const preferenceHint = getPreferenceHintForContact(settings, snapshot.contactName);
      return getReplySuggestions(snapshot, settings.profile, preferenceHint);
    }

    case "GET_QUICK_CHAT_REPLY": {
      const { snapshot } = message.payload as GetQuickChatPayload;
      const settings = await getSettings();
      if (!settings.profile) {
        throw new Error("Build your profile first — extension icon → Get started");
      }
      const preferenceHint = getPreferenceHintForContact(settings, snapshot.contactName);
      return getQuickChatReply(snapshot, settings.profile, preferenceHint);
    }

    case "RECORD_PICK": {
      const { pick } = message.payload as RecordPickPayload;
      await recordSuggestionPick(pick);
      return { ok: true };
    }

    default:
      throw new Error(`Unknown message type: ${message.type}`);
  }
}
