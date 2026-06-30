export interface ChatMessage {
  timestamp: string;
  sender: string;
  text: string;
  isMe: boolean;
}

export interface ParsedChatExport {
  chatName: string;
  participants: string[];
  messages: ChatMessage[];
  myName: string;
}

export interface CommunicationProfile {
  id: string;
  createdAt: string;
  sourceFiles: string[];
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
}

export interface ContactContext {
  name: string;
  relationshipHint: string;
  theirStyle: string;
  dynamicSummary: string;
  lastAnalyzedAt: string;
}

export interface LiveMessage {
  text: string;
  isMe: boolean;
  timestamp?: string;
  kind?: "text" | "sticker" | "gif" | "media";
}

export type ReplyMode = "reply_to_them" | "follow_up_mine";
export type InformalityLevel = "very_casual" | "casual" | "neutral" | "formal";

export interface ConversationState {
  replyMode: ReplyMode;
  lastSender: "me" | "them";
  pendingBlock: string;
  informality: InformalityLevel;
  avgWordsInThread: number;
  maxWordsPerReply: number;
  turnLabel: string;
  styleHint: string;
}

export interface ConversationSnapshot {
  contactName: string;
  messages: LiveMessage[];
  state?: ConversationState;
}

export interface CoachItem {
  type: "link" | "fact" | "gif" | "sticker" | "idea" | "excuse";
  label: string;
  content: string;
}

export interface MediaItem {
  type: "gif" | "meme" | "image" | "sticker" | "video";
  label: string;
  url: string;
  previewUrl?: string;
}

export interface SuggestionPick {
  contactName: string;
  pickedIndex: number;
  pickedText: string;
  allSuggestions: string[];
  situation?: string;
  relationship?: string;
  triggerKey: string;
  pickedAt: string;
}

export interface SuggestionResponse {
  replies: string[];
  contextLabel?: string;
  relationship?: string;
  situation?: string;
  coach?: CoachItem[];
  media?: MediaItem[];
}

export interface QuickChatResponse {
  reply: string;
  situation?: string;
}

export interface UserSettings {
  myDisplayName: string;
  profile: CommunicationProfile | null;
  contactContexts: Record<string, ContactContext>;
  /** Past suggestion picks — used for soft per-contact learning */
  suggestionPicks: SuggestionPick[];
}

export type MessageType =
  | "GET_SETTINGS"
  | "SAVE_SETTINGS"
  | "ANALYZE_EXPORT"
  | "GET_SUGGESTIONS"
  | "GET_QUICK_CHAT_REPLY"
  | "ANALYZE_CONTACT"
  | "RECORD_PICK";

export interface ExtensionMessage {
  type: MessageType;
  payload?: unknown;
}

export interface AnalyzeExportPayload {
  files: Array<{ name: string; content: string }>;
  myName: string;
}

export interface GetSuggestionsPayload {
  snapshot: ConversationSnapshot;
}

export interface GetQuickChatPayload {
  snapshot: ConversationSnapshot;
}

export interface AnalyzeContactPayload {
  contactName: string;
  messages: LiveMessage[];
}

export interface RecordPickPayload {
  pick: SuggestionPick;
}
