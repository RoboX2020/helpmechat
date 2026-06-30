import { useCallback, useEffect, useState } from "react";
import { parseWhatsAppExport } from "../lib/parser";
import type { UserSettings, CommunicationProfile } from "../lib/types";

interface FileEntry {
  name: string;
  content: string;
}

const MAX_EXPORT_FILES = 2;

export function Options() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [myName, setMyName] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    try {
      const s = (await chrome.runtime.sendMessage({ type: "GET_SETTINGS" })) as UserSettings;
      setSettings(s);
      setMyName(s.myDisplayName);
      setLoadError("");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load settings");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function handleFiles(fileList: FileList | null) {
    if (!fileList) return;

    const txtFiles = Array.from(fileList).filter((file) => file.name.endsWith(".txt"));
    if (txtFiles.length === 0) {
      setError("Only WhatsApp .txt export files are supported.");
      return;
    }

    txtFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        setFiles((prev) => {
          const filtered = prev.filter((f) => f.name !== file.name);
          return [...filtered, { name: file.name, content: reader.result as string }].slice(
            -MAX_EXPORT_FILES
          );
        });
        setError("");
      };
      reader.onerror = () => {
        setError(`Could not read ${file.name}`);
      };
      reader.readAsText(file);
    });
  }

  async function analyze() {
    if (!myName.trim()) {
      setError("Enter your name — exactly as it shows in WhatsApp exports.");
      return;
    }
    if (files.length === 0) {
      setError("Upload at least one WhatsApp .txt export.");
      return;
    }

    const parsed = files.map((f) => parseWhatsAppExport(f.content, f.name, myName.trim()));
    const messageCount = parsed.reduce((n, p) => n + p.messages.length, 0);
    if (messageCount === 0) {
      setError(
        "No messages found. Make sure your name matches WhatsApp exports exactly (e.g. Rahul vs You)."
      );
      return;
    }

    setAnalyzing(true);
    setError("");
    setSuccess("");

    try {
      const result = (await chrome.runtime.sendMessage({
        type: "ANALYZE_EXPORT",
        payload: { files, myName: myName.trim() },
      })) as { profile: CommunicationProfile; messageCount: number; error?: string };

      if (result.error) throw new Error(result.error);
      setSuccess(`Done! Analyzed ${result.messageCount} messages. Open WhatsApp Web to use it.`);
      setFiles([]);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    e.currentTarget.classList.remove("dragover");
    handleFiles(e.dataTransfer.files);
  }

  return (
    <div className="options-page">
      <h1>HelpMeChat</h1>
      <h2>Tell us who you are, then upload your chats</h2>

      {loadError && <p className="error">{loadError}</p>}

      <section className="section card">
        <div className="field">
          <label>Your name in WhatsApp</label>
          <input
            type="text"
            value={myName}
            onChange={(e) => setMyName(e.target.value)}
            placeholder="e.g. Rahul, Dr. Arora, You"
          />
          <p className="muted" style={{ marginTop: 6, marginBottom: 0 }}>
            Must match exactly how your name appears in exported chats.
          </p>
        </div>

        <p className="muted" style={{ marginTop: 16 }}>
          Export from WhatsApp: open a chat → ⋮ → More → Export chat → Without media.
          Upload 1–2 chats that show how you actually text.
        </p>

        <div
          className="dropzone"
          onDragOver={(e) => {
            e.preventDefault();
            e.currentTarget.classList.add("dragover");
          }}
          onDragLeave={(e) => e.currentTarget.classList.remove("dragover")}
          onDrop={onDrop}
          onClick={() => document.getElementById("file-input")?.click()}
        >
          <p>Drop WhatsApp .txt files here or click to browse (max {MAX_EXPORT_FILES})</p>
          <input
            id="file-input"
            type="file"
            accept=".txt"
            multiple
            hidden
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>

        {files.length > 0 && (
          <ul className="file-list">
            {files.map((f) => (
              <li key={f.name}>{f.name}</li>
            ))}
          </ul>
        )}

        <div className="actions">
          <button
            className="btn"
            onClick={() => void analyze()}
            disabled={analyzing || files.length === 0 || !myName.trim()}
          >
            {analyzing ? "Learning your style…" : "Build my profile"}
          </button>
        </div>
        {error && <p className="error">{error}</p>}
        {success && <p className="success">{success}</p>}
      </section>

      {settings?.profile && (
        <section className="section card">
          <span className="badge">Profile ready</span>
          <p className="muted" style={{ marginTop: 8 }}>
            Built from: {settings.profile.sourceFiles.join(", ")}
          </p>
          <div className="profile-block">{settings.profile.analysisSummary}</div>
        </section>
      )}
    </div>
  );
}
