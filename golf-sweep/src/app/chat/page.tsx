"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import LeaderboardStrip from "@/components/LeaderboardStrip";

interface Player {
  id: number;
  name: string;
  slug: string;
  avatarEmoji: string | null;
  color: string | null;
  passcode: string | null;
}

interface ChatMessage {
  id: number;
  playerId: number | null;
  playerName: string;
  playerAvatar: string | null;
  playerColor: string | null;
  body: string;
  contextType: string | null;
  replyToMessageId: number | null;
  reactions: Record<string, number[]> | null;
  createdAt: string;
}

const QUICK_REACTIONS = ["\u{1f602}", "\u{1f525}", "\u{1f480}", "\u{1f44f}", "\u{1f624}", "\u{1f389}"];

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  // Auth
  const [authedPlayerId, setAuthedPlayerId] = useState<number | null>(null);
  const [authedPlayerName, setAuthedPlayerName] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState("");
  const [playerPasscode, setPlayerPasscode] = useState("");
  const [authError, setAuthError] = useState("");
  const [isCommissioner, setIsCommissioner] = useState(false);

  // Input
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);

  // UI
  const [longPressId, setLongPressId] = useState<number | null>(null);
  const [reactionPickerId, setReactionPickerId] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load players
  useEffect(() => {
    fetch("/api/season")
      .then((r) => r.json())
      .then((d) => {
        if (d.standings) {
          setPlayers(d.standings.map((s: { player: Player }) => s.player));
        }
      })
      .catch(() => {});

    // Check localStorage for saved auth
    const savedId = localStorage.getItem("chat_player_id");
    const savedName = localStorage.getItem("chat_player_name");
    const savedCommish = localStorage.getItem("chat_is_commissioner");
    if (savedId && savedName) {
      setAuthedPlayerId(Number(savedId));
      setAuthedPlayerName(savedName);
      setIsCommissioner(savedCommish === "true");
    }
  }, []);

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/history");
      const data = await res.json();
      setMessages(data.messages ?? []);
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }, []);

  // Initial load + polling every 3 seconds
  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleAuth() {
    if (!selectedPlayer || !playerPasscode) {
      setAuthError("Select a player and enter your passcode.");
      return;
    }

    const player = players.find((p) => p.id === Number(selectedPlayer));
    if (!player) {
      setAuthError("Player not found.");
      return;
    }

    // Store in localStorage — server validates passcode on send
    localStorage.setItem("chat_player_id", String(player.id));
    localStorage.setItem("chat_player_name", player.name);
    localStorage.setItem("chat_passcode", playerPasscode);
    setAuthedPlayerId(player.id);
    setAuthedPlayerName(player.name);
    setAuthError("");
  }

  async function handleSend() {
    if (!inputText.trim() || !authedPlayerId) return;
    setSending(true);

    try {
      const passcode = localStorage.getItem("chat_passcode") ?? "";
      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: authedPlayerId,
          passcode,
          body: inputText.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.error?.includes("passcode") || res.status === 401) {
          setAuthError("Invalid passcode. Please re-authenticate.");
          setAuthedPlayerId(null);
          localStorage.removeItem("chat_player_id");
          localStorage.removeItem("chat_player_name");
          localStorage.removeItem("chat_passcode");
        }
        throw new Error(data.error || "Send failed");
      }

      setInputText("");
      await fetchMessages();
    } catch {
      // Error handled above for auth issues
    } finally {
      setSending(false);
    }
  }

  async function handleReaction(messageId: number, emoji: string) {
    if (!authedPlayerId) return;
    setReactionPickerId(null);

    try {
      const passcode = localStorage.getItem("chat_passcode") ?? "";
      await fetch("/api/chat/react", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId,
          playerId: authedPlayerId,
          passcode,
          emoji,
        }),
      });
      await fetchMessages();
    } catch {
      // Non-fatal
    }
  }

  async function handleDelete(messageId: number) {
    if (!authedPlayerId) return;
    setLongPressId(null);

    try {
      const passcode = localStorage.getItem("chat_passcode") ?? "";
      const commissionerPasscode = localStorage.getItem(
        "commissioner_passcode"
      );
      await fetch("/api/chat/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(commissionerPasscode
            ? { "x-commissioner-passcode": commissionerPasscode }
            : {}),
        },
        body: JSON.stringify({
          messageId,
          playerId: authedPlayerId,
          passcode,
        }),
      });
      await fetchMessages();
    } catch {
      // Non-fatal
    }
  }

  function handleTouchStart(messageId: number) {
    longPressTimer.current = setTimeout(() => {
      setLongPressId(messageId);
    }, 500);
  }

  function handleTouchEnd() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function formatTime(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return "Today";
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  }

  // Auth screen
  if (!authedPlayerId) {
    return (
      <div className="flex flex-col h-[calc(100dvh-8rem)] max-w-2xl mx-auto px-4">
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-sm">
            <div className="text-center mb-6">
              <span className="text-4xl">{"\u{1f4ac}"}</span>
              <h1 className="font-serif text-2xl font-bold mt-2">
                Group Chat
              </h1>
              <p className="text-cream/50 text-sm mt-1">Who are you?</p>
            </div>

            <div className="bg-dark-card border border-dark-border rounded-xl p-5 space-y-4">
              <select
                value={selectedPlayer}
                onChange={(e) => setSelectedPlayer(e.target.value)}
                className="w-full bg-dark border border-dark-border rounded-lg px-4 py-2.5 text-cream focus:outline-none focus:border-augusta"
              >
                <option value="">Select yourself</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.avatarEmoji ?? ""} {p.name}
                  </option>
                ))}
              </select>

              <input
                type="password"
                value={playerPasscode}
                onChange={(e) => setPlayerPasscode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAuth()}
                placeholder="Your passcode"
                className="w-full bg-dark border border-dark-border rounded-lg px-4 py-2.5 text-cream placeholder:text-cream/30 focus:outline-none focus:border-augusta text-center"
              />

              <button
                onClick={handleAuth}
                className="w-full bg-augusta hover:bg-augusta-light text-cream font-bold py-3 rounded-lg transition-colors"
              >
                Enter Chat
              </button>

              {authError && (
                <div className="text-red-400 text-sm text-center">
                  {authError}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Group messages by date
  const groupedMessages: Array<{ date: string; msgs: ChatMessage[] }> = [];
  let lastDate = "";
  for (const msg of messages) {
    const d = formatDate(msg.createdAt);
    if (d !== lastDate) {
      groupedMessages.push({ date: d, msgs: [] });
      lastDate = d;
    }
    groupedMessages[groupedMessages.length - 1].msgs.push(msg);
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-8rem)] max-w-2xl mx-auto">
      {/* Leaderboard strip at top — stays fixed, doesn't scroll */}
      <div className="px-4 pt-3 pb-2 shrink-0">
        <LeaderboardStrip />
      </div>

      {/* Header */}
      <div className="px-4 py-2 border-b border-dark-border flex items-center justify-between shrink-0">
        <div>
          <h1 className="font-serif text-base font-bold">Group Chat</h1>
          <span className="text-[10px] text-cream/40">
            Logged in as {authedPlayerName}
          </span>
        </div>
        <button
          onClick={() => {
            setAuthedPlayerId(null);
            setAuthedPlayerName("");
            localStorage.removeItem("chat_player_id");
            localStorage.removeItem("chat_player_name");
            localStorage.removeItem("chat_passcode");
          }}
          className="text-xs text-cream/40 hover:text-cream transition-colors"
        >
          Log out
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
        {loading && messages.length === 0 && (
          <div className="text-center text-cream/40 py-8">
            Loading chat...
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="text-center text-cream/40 py-8">
            No messages yet. Start the conversation!
          </div>
        )}

        {groupedMessages.map((group) => (
          <div key={group.date}>
            {/* Date divider */}
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-dark-border" />
              <span className="text-[10px] text-cream/30 uppercase tracking-wider">
                {group.date}
              </span>
              <div className="flex-1 h-px bg-dark-border" />
            </div>

            {group.msgs.map((msg) => {
              const isOwn = msg.playerId === authedPlayerId;
              const canDelete = isOwn || isCommissioner;

              return (
                <div
                  key={msg.id}
                  className="group py-1.5"
                  onTouchStart={() => handleTouchStart(msg.id)}
                  onTouchEnd={handleTouchEnd}
                  onContextMenu={(e) => {
                    if (canDelete) {
                      e.preventDefault();
                      setLongPressId(msg.id);
                    }
                  }}
                >
                  <div className="flex items-start gap-2">
                    {/* Avatar */}
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                      style={{
                        backgroundColor: `${msg.playerColor ?? "#006747"}30`,
                      }}
                    >
                      {msg.playerAvatar ?? "\u26f3"}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Name + time */}
                      <div className="flex items-baseline gap-2">
                        <span
                          className="font-bold text-sm"
                          style={{
                            color: msg.playerColor ?? "#f5f1e8",
                          }}
                        >
                          {msg.playerName}
                        </span>
                        <span className="text-[10px] text-cream/25">
                          {formatTime(msg.createdAt)}
                        </span>
                      </div>

                      {/* Body */}
                      <p className="text-sm text-cream/80 break-words">
                        {msg.body}
                      </p>

                      {/* Reactions */}
                      {msg.reactions &&
                        Object.keys(msg.reactions).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {Object.entries(msg.reactions).map(
                              ([emoji, userIds]) => (
                                <button
                                  key={emoji}
                                  onClick={() =>
                                    handleReaction(msg.id, emoji)
                                  }
                                  className={`px-2 py-0.5 rounded-full text-xs border transition-colors ${
                                    (userIds as number[]).includes(
                                      authedPlayerId ?? 0
                                    )
                                      ? "border-augusta bg-augusta/20"
                                      : "border-dark-border bg-dark hover:border-dark-border/80"
                                  }`}
                                >
                                  {emoji} {(userIds as number[]).length}
                                </button>
                              )
                            )}
                          </div>
                        )}

                      {/* Reaction picker on tap */}
                      {reactionPickerId === msg.id && (
                        <div className="flex gap-1 mt-1 bg-dark-card border border-dark-border rounded-lg p-1.5">
                          {QUICK_REACTIONS.map((emoji) => (
                            <button
                              key={emoji}
                              onClick={() =>
                                handleReaction(msg.id, emoji)
                              }
                              className="w-8 h-8 rounded hover:bg-dark-border transition-colors text-lg flex items-center justify-center"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Long press delete */}
                      {longPressId === msg.id && canDelete && (
                        <div className="mt-1 flex gap-2">
                          <button
                            onClick={() => handleDelete(msg.id)}
                            className="bg-red-500/20 border border-red-500/40 text-red-400 px-3 py-1 rounded text-xs font-bold"
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => setLongPressId(null)}
                            className="bg-dark border border-dark-border text-cream/50 px-3 py-1 rounded text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Reaction button */}
                    <button
                      onClick={() =>
                        setReactionPickerId(
                          reactionPickerId === msg.id ? null : msg.id
                        )
                      }
                      className="opacity-0 group-hover:opacity-100 text-cream/30 hover:text-cream transition-all text-xs mt-1 flex-shrink-0"
                    >
                      +{"\u{1f600}"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-dark-border px-4 py-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type a message..."
            className="flex-1 bg-dark-card border border-dark-border rounded-lg px-4 py-2.5 text-cream placeholder:text-cream/30 focus:outline-none focus:border-augusta"
          />
          <button
            onClick={handleSend}
            disabled={sending || !inputText.trim()}
            className="bg-augusta hover:bg-augusta-light text-cream font-bold px-5 py-2.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {sending ? "..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
