"use client";
import { useEffect, useState, useRef, useCallback } from "react";

interface Player {
  id: number;
  name: string;
  slug: string;
  color: string | null;
}

interface ChatMessage {
  id: number;
  playerId: number | null;
  playerName: string;
  playerAvatar: string | null;
  playerColor: string | null;
  body: string;
  reactions: Record<string, number[]> | null;
  createdAt: string;
}

export default function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [authedPlayerId, setAuthedPlayerId] = useState<number | null>(null);
  const [authedPlayerName, setAuthedPlayerName] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState("");
  const [passcodeInput, setPasscodeInput] = useState("");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [authError, setAuthError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load players + saved auth
  useEffect(() => {
    fetch("/api/season")
      .then((r) => r.json())
      .then((d) => {
        if (d.standings) {
          setPlayers(d.standings.map((s: { player: Player }) => s.player));
        }
      })
      .catch(() => {});

    const savedId = localStorage.getItem("chat_player_id");
    const savedName = localStorage.getItem("chat_player_name");
    if (savedId && savedName) {
      setAuthedPlayerId(Number(savedId));
      setAuthedPlayerName(savedName);
    }
  }, []);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/history?limit=50");
      const data = await res.json();
      const msgs = (data.messages ?? []) as ChatMessage[];
      // API returns newest first; we want oldest first for chat display
      setMessages([...msgs].reverse());
    } catch {}
  }, []);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function handleAuth() {
    if (!selectedPlayer || !passcodeInput) {
      setAuthError("Pick a player and enter passcode");
      return;
    }
    const player = players.find((p) => p.id === Number(selectedPlayer));
    if (!player) return;
    localStorage.setItem("chat_player_id", String(player.id));
    localStorage.setItem("chat_player_name", player.name);
    localStorage.setItem("chat_passcode", passcodeInput);
    setAuthedPlayerId(player.id);
    setAuthedPlayerName(player.name);
    setAuthError("");
  }

  async function handleSend() {
    if (!input.trim() || !authedPlayerId || sending) return;
    setSending(true);
    try {
      const passcode = localStorage.getItem("chat_passcode") ?? "";
      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: authedPlayerId,
          passcode,
          body: input.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
          setAuthError("Invalid passcode. Please re-auth.");
          setAuthedPlayerId(null);
          localStorage.removeItem("chat_player_id");
          localStorage.removeItem("chat_player_name");
          localStorage.removeItem("chat_passcode");
        }
        throw new Error(data.error || "Send failed");
      }
      setInput("");
      await fetchMessages();
    } catch {}
    setSending(false);
  }

  function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }

  if (!authedPlayerId) {
    return (
      <div className="flex flex-col h-full bg-dark-card border border-dark-border rounded-xl">
        <div className="px-3 py-2 border-b border-dark-border text-xs font-bold text-cream/60 uppercase tracking-wider">
          Live Chat
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full">
            <p className="text-xs text-cream/50 mb-2 text-center">Who are you?</p>
            <select
              value={selectedPlayer}
              onChange={(e) => setSelectedPlayer(e.target.value)}
              className="w-full bg-dark border border-dark-border rounded-lg px-3 py-2 text-cream text-sm mb-2"
            >
              <option value="">Select player...</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              placeholder="4-digit passcode"
              value={passcodeInput}
              onChange={(e) => setPasscodeInput(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && handleAuth()}
              className="w-full bg-dark border border-dark-border rounded-lg px-3 py-2 text-cream text-sm mb-2 text-center font-mono"
            />
            <button
              onClick={handleAuth}
              className="w-full bg-augusta hover:bg-augusta-light text-cream py-2 rounded-lg font-bold text-sm transition-colors"
            >
              Join Chat
            </button>
            {authError && (
              <p className="text-xs text-red-400 mt-2 text-center">{authError}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-dark-card border border-dark-border rounded-xl overflow-hidden">
      <div className="px-3 py-2 border-b border-dark-border flex items-center justify-between shrink-0">
        <span className="text-xs font-bold text-cream/60 uppercase tracking-wider">
          Live Chat
        </span>
        <span className="text-[10px] text-cream/40">as {authedPlayerName}</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-0">
        {messages.length === 0 && (
          <div className="text-center text-cream/30 text-xs py-4">No messages yet</div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className="flex gap-2">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0"
              style={{ backgroundColor: `${msg.playerColor ?? "#006747"}40` }}
            >
              {msg.playerAvatar ?? "🏌️"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span
                  className="font-bold text-xs"
                  style={{ color: msg.playerColor ?? "#006747" }}
                >
                  {msg.playerName}
                </span>
                <span className="text-[9px] text-cream/20">
                  {formatTime(msg.createdAt)}
                </span>
              </div>
              <p className="text-xs text-cream/90 break-words">{msg.body}</p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-dark-border px-2 py-2 flex gap-1 shrink-0">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Type a message..."
          maxLength={2000}
          className="flex-1 bg-dark border border-dark-border rounded-lg px-2 py-1.5 text-cream text-xs"
        />
        <button
          onClick={handleSend}
          disabled={sending || !input.trim()}
          className="bg-augusta hover:bg-augusta-light disabled:opacity-40 text-cream px-3 py-1.5 rounded-lg font-bold text-xs transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  );
}
