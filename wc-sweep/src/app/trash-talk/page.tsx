"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface TrashTalkMessage {
  id: number;
  senderName: string;
  senderAvatar: string | null;
  senderId: number | null;
  targetName: string;
  targetSlug: string;
  message: string;
  createdAt: string;
}

interface PlayerOption {
  id: number;
  name: string;
  slug: string;
  color: string | null;
}

const QUICK_EMOJIS = ["🏠", "💀", "😂", "🔥", "💩", "👑", "🗑️", "🐐"];
const LS_PLAYER_ID = "wc_sweep_player_id";
const LS_PASSCODE = "wc_sweep_passcode";

export default function TrashTalkPage() {
  const [messages, setMessages] = useState<TrashTalkMessage[]>([]);
  const [players, setPlayers] = useState<PlayerOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [senderId, setSenderId] = useState<number | null>(null);
  const [targetSlug, setTargetSlug] = useState("");
  const [messageText, setMessageText] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState("");
  const [passcode, setPasscode] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    try {
      const savedId = localStorage.getItem(LS_PLAYER_ID);
      const savedPass = localStorage.getItem(LS_PASSCODE);
      if (savedId) setSenderId(Number(savedId));
      if (savedPass) setPasscode(savedPass);
    } catch {
      // localStorage unavailable
    }
  }, []);

  useEffect(() => {
    try {
      if (senderId !== null) localStorage.setItem(LS_PLAYER_ID, String(senderId));
      if (passcode) localStorage.setItem(LS_PASSCODE, passcode);
    } catch {
      // localStorage unavailable
    }
  }, [senderId, passcode]);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/trash-talk");
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages ?? []);
        setPlayers(data.players ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15_000);
    return () => clearInterval(interval);
  }, [loadData]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!senderId || !targetSlug || !messageText.trim() || !passcode) return;

    setSending(true);
    setError("");

    try {
      const res = await fetch("/api/trash-talk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderId,
          targetPlayerSlug: targetSlug,
          message: messageText.trim(),
          emoji: selectedEmoji,
          passcode,
        }),
      });

      if (res.ok) {
        setMessageText("");
        setSelectedEmoji("");
        loadData();
      } else {
        const data = await res.json();
        setError(data.error ?? "Failed to send");
      }
    } catch {
      setError("Network error");
    } finally {
      setSending(false);
    }
  }

  function getPlayerColor(name: string): string {
    const match = players.find((p) => p.name.toLowerCase() === name.toLowerCase());
    return match?.color ?? "#d4a843";
  }

  function formatTime(iso: string): string {
    try {
      const d = new Date(iso);
      const day = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
      const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
      return `${day} ${time}`;
    } catch {
      return "";
    }
  }

  const sortedMessages = [...messages].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const otherPlayers = players.filter((p) => p.id !== senderId);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="font-serif text-3xl font-bold">
          <span className="text-red-400">Trash</span>{" "}
          <span className="text-wc-gold">Talk</span>
        </h1>
        <p className="text-cream/50 text-sm">
          Talk smack. Take names. No mercy.
        </p>
      </div>

      {/* Compose Form */}
      <div className="bg-dark-card border border-red-900/40 rounded-lg p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="block text-xs text-cream/40 mb-1">You</label>
            <select
              value={senderId ?? ""}
              onChange={(e) => setSenderId(e.target.value ? Number(e.target.value) : null)}
              className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-cream text-sm"
            >
              <option value="">Who are you?</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs text-cream/40 mb-1">Target</label>
            <select
              value={targetSlug}
              onChange={(e) => setTargetSlug(e.target.value)}
              className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-cream text-sm"
            >
              <option value="">Pick your victim...</option>
              {otherPlayers.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:w-28">
            <label className="block text-xs text-cream/40 mb-1">Passcode</label>
            <input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="****"
              className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-cream text-sm placeholder:text-cream/20"
            />
          </div>
        </div>

        {/* Emoji picker */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-cream/40 mr-1">Emoji:</span>
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => setSelectedEmoji(selectedEmoji === emoji ? "" : emoji)}
              className={`text-lg px-1.5 py-0.5 rounded cursor-pointer transition-all ${
                selectedEmoji === emoji
                  ? "bg-red-900/50 ring-2 ring-red-500 scale-110"
                  : "hover:bg-dark-border/60"
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>

        <form onSubmit={handleSend} className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Talk your trash... (280 chars max)"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value.slice(0, 280))}
              maxLength={280}
              className="w-full bg-dark border border-dark-border rounded-lg px-3 py-2.5 text-sm text-cream placeholder:text-cream/30 focus:outline-none focus:border-red-500"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-cream/30">
              {messageText.length}/280
            </span>
          </div>
          <button
            type="submit"
            disabled={sending || !senderId || !targetSlug || !messageText.trim()}
            className="bg-red-700 hover:bg-red-600 text-cream font-semibold text-sm px-5 py-2.5 rounded-lg disabled:opacity-40 transition-colors cursor-pointer shrink-0"
          >
            {sending ? "..." : "Send"}
          </button>
        </form>

        {error && <div className="text-red-400 text-xs">{error}</div>}
      </div>

      {/* Feed */}
      <div className="space-y-2">
        {loading ? (
          <div className="text-center py-12 text-cream/40">Loading trash talk...</div>
        ) : sortedMessages.length === 0 ? (
          <div className="text-center py-12 text-cream/40">
            No trash talk yet. Someone be brave...
          </div>
        ) : (
          sortedMessages.map((msg) => (
            <div
              key={msg.id}
              className="bg-dark-card border border-dark-border rounded-lg p-3 hover:border-red-900/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap text-sm">
                    <span
                      className="font-bold"
                      style={{ color: getPlayerColor(msg.senderName) }}
                    >
                      {msg.senderName}
                    </span>
                    <span className="text-cream/30">&#8594;</span>
                    <span
                      className="font-bold"
                      style={{ color: getPlayerColor(msg.targetName) }}
                    >
                      {msg.targetName}
                    </span>
                  </div>
                  <p className="text-cream/90 text-sm mt-1 break-words">
                    {msg.message}
                  </p>
                </div>
                <span className="text-[10px] text-cream/30 whitespace-nowrap shrink-0">
                  {formatTime(msg.createdAt)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
