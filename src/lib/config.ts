/** Gemini credentials and model fallback chains. */
export const GEMINI_CONFIG = {
  apiKey: import.meta.env.VITE_GEMINI_API_KEY ?? "",
  apiBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
  /** Best quality first, then faster fallbacks */
  replyModels: [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash",
  ],
  profileModels: ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-2.0-flash"],
};
