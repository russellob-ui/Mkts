"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

const EMOJI_OPTIONS = [
  "⚽", "🏆", "🎯", "🔥", "💪",
  "🦁", "🐐", "🎪", "🌟", "💎",
  "🎩", "🏅", "🎲", "🍀", "🦅",
  "🐻", "🦈", "🏄",
];

const COLOR_OPTIONS = [
  "#d4a843", "#e74c3c", "#3498db", "#2ecc71", "#9b59b6",
  "#e67e22", "#1abc9c", "#f39c12", "#e91e63", "#00bcd4",
  "#8bc34a", "#ff5722",
];

export default function JoinPage() {
  const searchParams = useSearchParams();
  const codeFromUrl = searchParams.get("code") ?? "";

  const [inviteCode, setInviteCode] = useState(codeFromUrl);
  const [name, setName] = useState("");
  const [passcode, setPasscode] = useState("");
  const [color, setColor] = useState("#d4a843");
  const [avatarEmoji, setAvatarEmoji] = useState("⚽");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (codeFromUrl) {
      setInviteCode(codeFromUrl);
    }
  }, [codeFromUrl]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          passcode: passcode.trim(),
          color,
          avatarEmoji,
          inviteCode: inviteCode.trim().toUpperCase(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
      } else {
        setSuccess(data.player?.name ?? name);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 text-center space-y-6">
        <div className="text-6xl">{avatarEmoji}</div>
        <h1 className="font-serif text-3xl font-bold">
          <span className="text-wc-gold">Welcome,</span>{" "}
          <span className="text-cream">{success}!</span>
        </h1>
        <p className="text-cream/60">
          You&apos;re in the World Cup Sweep 2026. Share the app with friends and get ready for the draw.
        </p>
        <Link
          href="/"
          className="inline-block bg-wc-gold text-dark font-semibold px-6 py-3 rounded-lg hover:bg-wc-gold/90 transition-colors"
        >
          Go to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-8 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="font-serif text-2xl font-bold">
          <span className="text-wc-gold">World Cup Sweep 2026</span>
        </h1>
        <p className="text-cream/60 text-sm">Join the Game</p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-dark-card border border-dark-border rounded-lg p-6 space-y-5"
      >
        {/* Invite Code */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-cream/60 uppercase tracking-wider">
            Invite Code
          </label>
          <input
            type="text"
            placeholder="Enter your invite code"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            required
            maxLength={6}
            className="w-full bg-dark border border-dark-border rounded-lg px-3 py-2.5 text-sm text-cream placeholder:text-cream/30 focus:outline-none focus:border-wc-gold font-mono text-center text-lg tracking-widest uppercase"
          />
        </div>

        {/* Name */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-cream/60 uppercase tracking-wider">
            Your Name
          </label>
          <input
            type="text"
            placeholder="e.g. Russell"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full bg-dark border border-dark-border rounded-lg px-3 py-2.5 text-sm text-cream placeholder:text-cream/30 focus:outline-none focus:border-wc-gold"
          />
        </div>

        {/* Passcode */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-cream/60 uppercase tracking-wider">
            Passcode
          </label>
          <p className="text-xs text-cream/40">Used for chat and predictions. Remember it!</p>
          <input
            type="text"
            placeholder="Choose a passcode"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            required
            className="w-full bg-dark border border-dark-border rounded-lg px-3 py-2.5 text-sm text-cream placeholder:text-cream/30 focus:outline-none focus:border-wc-gold"
          />
        </div>

        {/* Avatar Emoji */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-cream/60 uppercase tracking-wider">
            Avatar
          </label>
          <div className="grid grid-cols-9 gap-1.5">
            {EMOJI_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setAvatarEmoji(emoji)}
                className={`text-2xl p-1.5 rounded-lg transition-all cursor-pointer ${
                  avatarEmoji === emoji
                    ? "bg-wc-gold/20 border-2 border-wc-gold scale-110"
                    : "hover:bg-dark-border border-2 border-transparent"
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Color */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-cream/60 uppercase tracking-wider">
            Your Color
          </label>
          <div className="grid grid-cols-6 gap-2">
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-full aspect-square rounded-full transition-all cursor-pointer ${
                  color === c
                    ? "ring-2 ring-wc-gold ring-offset-2 ring-offset-dark-card scale-110"
                    : "hover:scale-105"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        {error && (
          <div className="text-red-400 text-sm text-center bg-red-400/10 border border-red-400/20 rounded-lg p-3">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-wc-gold text-dark font-semibold text-sm px-4 py-3 rounded-lg hover:bg-wc-gold/90 disabled:opacity-50 transition-colors cursor-pointer"
        >
          {submitting ? "Joining..." : "Join the Sweep"}
        </button>
      </form>
    </div>
  );
}
