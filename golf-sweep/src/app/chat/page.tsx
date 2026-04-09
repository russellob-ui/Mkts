"use client";
import { useEffect, useState, useRef } from "react";

interface ChatMessage {
  id: number;
  playerId: number | null;
  playerName: string;
  playerAvatar: string | null;
  playerColor: string | null;
  body: string;
  contextType: string | null;
  replyToMessageId: number | null;
  reactions: Record<string, number[]>;
  createdAt: string;
}

const REACTION_EMOJIS = ["🔥", "💀", "🤯", "😂", "👍"];

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [passcode, setPasscode] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [authed, setAuthed] = useState(false);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showReactions, setShowReactions] = useState<number | null>(null);

  // Auth from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("lbw_chat_passcode");
    const savedName = localStorage.getItem("lbw_chat_name");
    if (saved && savedName) {
      setPasscode(saved);
      setPlayerName(savedName);
      setAuthed(true);
    }
  }, []);

  // Poll for messages
  useEffect(() => {
    if (!authed) return;
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [authed]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function fetchMessages() {
    const res = await fetch("/api/chat/history?limit=100");
    const json = await res.json();
    setMessages((json.messages ?? []).reverse());
  }

  async function login(code: string) {
    // Validate by trying to send a test (we'll check against the API)
    const res = await fetch("/api/chat/history?limit=1");
    if (res.ok) {
      // Check if passcode is valid by trying to find a player
      const playerRes = await fetch("/api/season");
      const data = await playerRes.json();
      const players = data.standings?.map((s: { player: { name: string } }) => s.player) ?? [];
      // For now, accept any 4-char passcode — the send endpoint validates
      setPasscode(code);
      setAuthed(true);
      localStorage.setItem("lbw_chat_passcode", code);
      localStorage.setItem("lbw_chat_name", "Player");
    }
  }

  async function send() {
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerPasscode: passcode, body: input.trim() }),
      });
      const json = await res.json();
      if (json.error) {
        alert(json.error);
      } else {
        setInput("");
        if (json.message?.playerNameSnapshot) {
          setPlayerName(json.message.playerNameSnapshot);
          localStorage.setItem("lbw_chat_name", json.message.playerNameSnapshot);
        }
        fetchMessages();
      }
    } catch {}
    setSending(false);
  }

  async function react(messageId: number, emoji: string) {
    await fetch("/api/chat/react", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerPasscode: passcode, messageId, emoji }),
    });
    setShowReactions(null);
    fetchMessages();
  }

  if (!authed) {
    return (
      <div className="max-w-md mx-auto px-4 py-20">
        <h1 className="font-serif text-2xl font-bold mb-4 text-center">Chat</h1>
        <div className="bg-dark-card border border-dark-border rounded-xl p-6">
          <p className="text-cream/50 text-sm mb-3">Enter your player passcode to join the chat</p>
          <input type="password" placeholder="Passcode" value={passcode}
            onChange={e => setPasscode(e.target.value)}
            onKeyDown={e => e.key === "Enter" && login(passcode)}
            className="w-full bg-dark border border-dark-border rounded-lg px-4 py-2 mb-3 text-cream" />
          <button onClick={() => login(passcode)}
            className="w-full bg-augusta hover:bg-augusta-light text-cream py-2 rounded-lg font-bold transition-colors">
            Join Chat
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-120px)]">
      <div className="px-4 py-2 border-b border-dark-border">
        <h1 className="font-serif text-lg font-bold">Chat</h1>
        <span className="text-xs text-cream/40">As {playerName || "Player"}</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map(msg => (
          <div key={msg.id} className="flex gap-2" onClick={() => setShowReactions(showReactions === msg.id ? null : msg.id)}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0"
              style={{ backgroundColor: `${msg.playerColor ?? "#006747"}30` }}>
              {msg.playerAvatar ?? "🏌️"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="font-bold text-sm" style={{ color: msg.playerColor ?? "#006747" }}>{msg.playerName}</span>
                <span className="text-[10px] text-cream/20">{new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              <p className={`text-sm text-cream/90 ${msg.body.length <= 4 && /^\p{Emoji}+$/u.test(msg.body) ? "text-3xl" : ""}`}>
                {msg.body}
              </p>
              {/* Reactions */}
              {Object.entries(msg.reactions ?? {}).length > 0 && (
                <div className="flex gap-1 mt-1">
                  {Object.entries(msg.reactions).map(([emoji, userIds]) => (
                    <span key={emoji} className="bg-dark-border/50 rounded-full px-1.5 py-0.5 text-xs cursor-pointer hover:bg-dark-border"
                      onClick={(e) => { e.stopPropagation(); react(msg.id, emoji); }}>
                      {emoji} {(userIds as number[]).length}
                    </span>
                  ))}
                </div>
              )}
              {/* Reaction picker */}
              {showReactions === msg.id && (
                <div className="flex gap-1 mt-1 bg-dark-card border border-dark-border rounded-lg p-1">
                  {REACTION_EMOJIS.map(emoji => (
                    <button key={emoji} onClick={(e) => { e.stopPropagation(); react(msg.id, emoji); }}
                      className="text-lg hover:bg-dark-border rounded p-1">{emoji}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-dark-border px-4 py-3 flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send()}
          placeholder="Type a message..."
          maxLength={Number(process.env.NEXT_PUBLIC_CHAT_MAX_LENGTH ?? 2000)}
          className="flex-1 bg-dark border border-dark-border rounded-lg px-3 py-2 text-cream text-sm" />
        <button onClick={send} disabled={sending || !input.trim()}
          className="bg-augusta hover:bg-augusta-light disabled:opacity-50 text-cream px-4 py-2 rounded-lg font-bold text-sm transition-colors">
          Send
        </button>
      </div>
    </div>
  );
}
