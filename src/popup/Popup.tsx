import { useEffect, useState } from "react";
import type { UserSettings } from "../lib/types";

export function Popup() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    void chrome.runtime
      .sendMessage({ type: "GET_SETTINGS" })
      .then((s: UserSettings) => {
        setSettings(s);
        setLoadError("");
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : "Could not load settings");
      });
  }, []);

  const profileReady = Boolean(settings?.profile);

  function openOptions() {
    chrome.runtime.openOptionsPage();
  }

  return (
    <div>
      <div className="popup-header">
        <span className={`status-dot ${profileReady ? "ready" : ""}`} />
        <h1>HelpMeChat</h1>
      </div>

      {loadError && (
        <div className="card">
          <p className="error" style={{ margin: 0 }}>
            {loadError}
          </p>
        </div>
      )}

      {!profileReady ? (
        <div className="card">
          <p className="muted" style={{ margin: "0 0 12px" }}>
            Upload your WhatsApp chats and enter your name — we&apos;ll learn how you text.
          </p>
          <button className="btn" onClick={openOptions}>
            Get started
          </button>
        </div>
      ) : (
        <div className="card">
          <span className="badge">Ready</span>
          <p className="profile-summary" style={{ marginTop: 8 }}>
            {(settings?.profile?.analysisSummary ?? "Profile ready").slice(0, 120)}…
          </p>
        </div>
      )}

      <div className="popup-links">
        {profileReady && (
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              openOptions();
            }}
          >
            Re-upload chats
          </a>
        )}
        <a href="https://web.whatsapp.com" target="_blank" rel="noreferrer">
          Open WhatsApp Web
        </a>
      </div>

      <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>
        Suggestions appear in the panel when a chat is open.
      </p>
    </div>
  );
}
