"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface ChatMessage {
  id: number;
  playerId: number | null;
  playerNameSnapshot: string;
  playerAvatarSnapshot: string | null;
  body: string;
  reactions: Record<string, string[]>;
  createdAt: string;
}

interface PlayerOption {
  id: number;
  name: string;
  color: string | null;
}

const REACTION_OPTIONS = ["👍", "😂", "🔥", "⚽", "🏆", "😢"];

const LS_PLAYER_ID_KEY = "wc_sweep_chat_player_id";
const LS_PASSCODE_KEY = "wc_sweep_chat_passcode";

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [players, setPlayers] = useState<PlayerOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [passcode, setPasscode] = useState("");
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  // Load saved player/passcode from localStorage
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    try {
      const savedId = localStorage.getItem(LS_PLAYER_ID_KEY);
      const savedPass = localStorage.getItem(LS_PASSCODE_KEY);
      if (savedId) setSelectedPlayerId(Number(savedId));
      if (savedPass) setPasscode(savedPass);
    } catch {
      // localStorage unavailable
    }
  }, []);

  // Persist selection to localStorage
  useEffect(() => {
    try {
      if (selectedPlayerId !== null) {
        localStorage.setItem(LS_PLAYER_ID_KEY, String(selectedPlayerId));
      }
      if (passcode) {
        localStorage.setItem(LS_PASSCODE_KEY, passcode);
      }
    } catch {
      // localStorage unavailable
    }
  }, [selectedPlayerId, passcode]);

  const loadMessages = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/history");
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPlayers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/players");
      if (res.ok) {
        const data = await res.json();
        setPlayers(
          (data.players ?? []).map(
            (p: { id: number; name: string; color: string | null }) => ({
              id: p.id,
              name: p.name,
              color: p.color,
            })
          )
        );
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadMessages();
    loadPlayers();
    const interval = setInterval(loadMessages, 10_000);
    return () => clearInterval(interval);
  }, [loadMessages, loadPlayers]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPlayerId || !messageText.trim() || !passcode.trim()) return;
    setSending(true);
    setSendError("");
    try {
      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: selectedPlayerId,
          passcode,
          body: messageText.trim(),
        }),
      });
      if (res.ok) {
        setMessageText("");
        loadMessages();
      } else {
        const data = await res.json();
        setSendError(data.error ?? "Failed to send");
      }
    } catch {
      setSendError("Network error");
    } finally {
      setSending(false);
    }
  }

  async function toggleReaction(messageId: number, emoji: string) {
    if (!selectedPlayerId || !passcode.trim()) return;
    try {
      await fetch("/api/chat/react", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId,
          playerId: selectedPlayerId,
          passcode,
          emoji,
        }),
      });
      loadMessages();
    } catch {
      // ignore
    }
  }

  function getPlayerColor(name: string): string {
    const match = players.find(
      (p) => p.name.toLowerCase() === name.toLowerCase()
    );
    return match?.color ?? "#d4a843";
  }

  function formatTime(iso: string): string {
    try {
      return new Date(iso).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  }

  function formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
      });
    } catch {
      return "";
    }
  }

  // Group messages by date
  const sortedMessages = [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  return (
    <div className="max-w-2xl mx-auto flex flex-col h-[calc(100dvh-120px)]">
      <div className="px-4 py-3 border-b border-dark-border">
        <h1 className="font-serif text-xl font-bold">
          <span className="text-wc-gold">Chat</span>
        </h1>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {loading ? (
          <div className="text-center py-12 text-cream/40">
            Loading messages...
          </div>
        ) : sortedMessages.length === 0 ? (
          <div className="text-center py-12 text-cream/40">
            No messages yet. Be the first to say something!
          </div>
        ) : (
          <>
            {sortedMessages.map((msg, i) => {
              const showDate =
                i === 0 ||
                formatDate(msg.createdAt) !==
                  formatDate(sortedMessages[i - 1].createdAt);
              return (
                <div key={msg.id}>
                  {showDate && (
                    <div className="text-center text-xs text-cream/30 my-3">
                      {formatDate(msg.createdAt)}
                    </div>
                  )}
                  <div className="bg-dark-card border border-dark-border rounded-lg p-3">
                    <div className="flex items-baseline gap-2 mb-1">
                      {msg.playerAvatarSnapshot && (
                        <span className="text-sm">
                          {msg.playerAvatarSnapshot}
                        </span>
                      )}
                      <span
                        className="font-semibold text-sm"
                        style={{ color: getPlayerColor(msg.playerNameSnapshot) }}
                      >
                        {msg.playerNameSnapshot}
                      </span>
                      <span className="text-xs text-cream/30">
                        {formatTime(msg.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-cream/90 whitespace-pre-wrap break-words">
                      {msg.body}
                    </p>

                    {/* Existing reactions */}
                    {msg.reactions &&
                      Object.keys(msg.reactions).length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {Object.entries(msg.reactions).map(
                            ([emoji, reactors]) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => toggleReaction(msg.id, emoji)}
                                className={`text-xs px-1.5 py-0.5 rounded-full border cursor-pointer transition-colors ${
                                  Array.isArray(reactors) &&
                                  reactors.includes(String(selectedPlayerId))
                                    ? "border-wc-gold bg-wc-gold/20"
                                    : "border-dark-border hover:border-cream/30"
                                }`}
                                title={
                                  Array.isArray(reactors)
                                    ? reactors.join(", ")
                                    : ""
                                }
                              >
                                {emoji}{" "}
                                {Array.isArray(reactors) ? reactors.length : 0}
                              </button>
                            )
                          )}
                        </div>
                      )}

                    {/* Reaction picker */}
                    <div className="flex gap-1 mt-2">
                      {REACTION_OPTIONS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => toggleReaction(msg.id, emoji)}
                          className="text-xs px-1 py-0.5 rounded hover:bg-dark-border/60 cursor-pointer transition-colors text-cream/30 hover:text-cream/70"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input form */}
      <div className="border-t border-dark-border px-4 py-3 bg-dark">
        <form onSubmit={sendMessage} className="space-y-2">
          <div className="flex gap-2">
            <select
              value={selectedPlayerId ?? ""}
              onChange={(e) =>
                setSelectedPlayerId(
                  e.target.value ? Number(e.target.value) : null
                )
              }
              className="bg-dark-card border border-dark-border rounded-lg px-2 py-1.5 text-sm text-cream focus:outline-none focus:border-wc-gold flex-shrink-0"
            >
              <option value="">Who are you?</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <input
              type="password"
              placeholder="Passcode"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              className="bg-dark-card border border-dark-border rounded-lg px-2 py-1.5 text-sm text-cream placeholder:text-cream/30 focus:outline-none focus:border-wc-gold w-24 flex-shrink-0"
            />
          </div>
          <div className="flex gap-2">
            <textarea
              placeholder="Type a message..."
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(e);
                }
              }}
              rows={1}
              className="bg-dark-card border border-dark-border rounded-lg px-3 py-2 text-sm text-cream placeholder:text-cream/30 focus:outline-none focus:border-wc-gold flex-1 resize-none"
            />
            <button
              type="submit"
              disabled={sending || !selectedPlayerId || !messageText.trim()}
              className="bg-wc-gold text-dark font-semibold text-sm px-4 py-2 rounded-lg hover:bg-wc-gold/90 disabled:opacity-50 transition-colors cursor-pointer shrink-0"
            >
              {sending ? "..." : "Send"}
            </button>
          </div>
          {sendError && (
            <div className="text-red-400 text-xs">{sendError}</div>
          )}
        </form>
      </div>
    </div>
  );
}
