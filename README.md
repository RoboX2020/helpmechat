# HelpMeChat

AI-powered browser extension that learns **your** texting style from exported WhatsApp chats, then sits beside WhatsApp Web and suggests original replies based on the live conversation — tone, relationship context, and situation.

Built for moments when you know what you feel but not how to say it (personal chats, flirting, apologies, planning, awkward silences).

## How it works

1. **Export & learn** — Upload 1–2 WhatsApp `.txt` exports and enter your name. Gemini builds a communication profile: tone, emoji habits, humor, and how you shift in different situations.
2. **Live assist** — On [WhatsApp Web](https://web.whatsapp.com), a floating panel reads the open chat from the page DOM and sends context to Gemini when generating suggestions.
3. **Smart suggestions** — When the conversation updates, you get 5 copy-ready replies plus optional media links and AI Coach tips. Tap **Send** to paste into the compose box.
4. **Quick Chat (⚡)** — Toggle auto-reply mode: when *they* message you, AI sends one safe reply automatically (excuses OK, no commitments). Never sends follow-ups when you spoke last.

## Quick start

```bash
git clone https://github.com/RoboX2020/helpmechat.git
cd helpmechat
npm install
cp .env.example .env
# Edit .env and add your Gemini API key from https://aistudio.google.com/apikey
npm run build
```

Load in Chrome/Edge:

1. Open `chrome://extensions` → **Developer mode** → **Load unpacked** → select `dist`
2. Click the extension → **Get started**
3. Enter **your name** (as in WhatsApp exports) and upload 1–2 `.txt` chat exports
4. Click **Build my profile**
5. Open [WhatsApp Web](https://web.whatsapp.com) — the HelpMeChat panel appears when a chat is open

## Features

- **Sent vs received detection** — Reads WhatsApp message rows (`data-id`, `.message-out`/`.message-in`) so the AI knows who said what
- **Reply vs follow-up mode** — Suggests responses to them, or double-texts when you spoke last
- **Quick Chat mode** — Auto-send safe replies when they message you (no auto follow-ups)
- **Hinglish-aware** — Matches desi banter when the thread is Hinglish
- **Media & coach** — GIF/meme search links and extra context when useful
- **Preference learning** — Remembers which suggestions you pick per contact (soft bias after 2+ picks)
- **Draggable panel** — Move it anywhere on screen; position is saved

## Exporting WhatsApp chats

On phone: open chat → ⋮ → **More** → **Export chat** → **Without media**.

You get a `.txt` file like:

```
[26/06/2025, 10:30:15] You: hey
[26/06/2025, 10:31:02] Sarah: hi!
```

Your name in the export must match what you enter in setup (e.g. `You`, `Rahul`, or your display name).

## Debug

On WhatsApp Web, open DevTools console:

```javascript
helpmechatDebug()      // message sender tags
helpmechatDebugSend()  // compose + send button detection
```

## Privacy

- Chat exports and profiles are stored locally in `chrome.storage.local`.
- Live messages are sent to Google Gemini only when generating suggestions.
- No HelpMeChat backend — you provide your own Gemini API key via `.env`.

## Project structure

```
src/
  lib/           # Shared: parser, AI, storage, message extraction, types
  background/    # Service worker (API orchestration)
  content/       # WhatsApp Web panel + compose injection
  popup/         # Quick status + link to setup
  options/       # Name + chat import + profile view
```

## License

MIT — see [LICENSE](LICENSE).
