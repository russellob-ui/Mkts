"use client";

import { useEffect, useState } from "react";

interface Player {
  id: number;
  name: string;
  slug: string;
  avatarEmoji: string | null;
}

interface CommissionerAction {
  id: number;
  actionType: string;
  headline: string;
  reason: string | null;
  emoji: string | null;
  pointsDelta: number | null;
  affectedPlayer: { name: string } | null;
  createdAt: string;
}

type ActionType =
  | "bonus"
  | "deduction"
  | "note"
  | "flash_challenge"
  | "rule_amendment"
  | "forfeit_decree";

const ACTION_CONFIG: Record<
  ActionType,
  { label: string; emoji: string; hasPoints: boolean }
> = {
  bonus: { label: "Issue Bonus", emoji: "💰", hasPoints: true },
  deduction: { label: "Issue Deduction", emoji: "⚠️", hasPoints: true },
  note: { label: "Commissioner's Note", emoji: "📝", hasPoints: false },
  flash_challenge: { label: "Flash Challenge", emoji: "⚡", hasPoints: false },
  rule_amendment: { label: "Rule Amendment", emoji: "📜", hasPoints: false },
  forfeit_decree: { label: "Forfeit Decree", emoji: "⚖️", hasPoints: false },
};

export default function CommissionerPage() {
  const [passcode, setPasscode] = useState("");
  const [authed, setAuthed] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [actions, setActions] = useState<CommissionerAction[]>([]);
  const [activeForm, setActiveForm] = useState<ActionType | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form state
  const [formPlayer, setFormPlayer] = useState("");
  const [formPoints, setFormPoints] = useState("");
  const [formHeadline, setFormHeadline] = useState("");
  const [formReason, setFormReason] = useState("");
  const [formEmoji, setFormEmoji] = useState("");

  // Check localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("commissioner_passcode");
    if (saved) {
      setPasscode(saved);
      setAuthed(true);
    }
  }, []);

  // Fetch players and actions once authed
  useEffect(() => {
    if (!authed) return;

    fetch("/api/season")
      .then((r) => r.json())
      .then((d) => {
        if (d.standings) {
          setPlayers(
            d.standings.map((s: { player: Player }) => s.player)
          );
        }
      })
      .catch(() => {});

    fetchActions();
  }, [authed]);

  function fetchActions() {
    fetch("/api/commissioner/actions")
      .then((r) => r.json())
      .then((d) => setActions(d.actions ?? []))
      .catch(() => {});
  }

  function handleAuth() {
    if (!passcodeInput.trim()) return;
    localStorage.setItem("commissioner_passcode", passcodeInput.trim());
    setPasscode(passcodeInput.trim());
    setAuthed(true);
  }

  function resetForm() {
    setFormPlayer("");
    setFormPoints("");
    setFormHeadline("");
    setFormReason("");
    setFormEmoji("");
    setActiveForm(null);
  }

  async function handleSubmit() {
    if (!activeForm || !formHeadline.trim()) return;
    const config = ACTION_CONFIG[activeForm];

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const body: Record<string, unknown> = {
        actionType: activeForm,
        headline: formHeadline.trim(),
        reason: formReason.trim() || null,
        emoji: formEmoji.trim() || config.emoji,
      };

      if (formPlayer) body.affectedPlayerId = Number(formPlayer);
      if (config.hasPoints && formPoints) {
        const pts = parseFloat(formPoints);
        body.pointsDelta =
          activeForm === "deduction" ? -Math.abs(pts) : Math.abs(pts);
      }

      const res = await fetch("/api/commissioner/action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-commissioner-passcode": passcode,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed (${res.status})`);
      }

      setSuccess("Action issued successfully!");
      resetForm();
      fetchActions();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  // Passcode entry screen
  if (!authed) {
    return (
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <span className="text-5xl">🎩</span>
          <h1 className="font-serif text-3xl font-bold mt-4 text-gold">
            Commissioner Mode
          </h1>
          <p className="text-cream/50 mt-2 text-sm">
            Enter the Commissioner passcode to proceed.
          </p>
        </div>

        <div className="bg-dark-card border-2 border-gold/30 rounded-xl p-6">
          <input
            type="password"
            value={passcodeInput}
            onChange={(e) => setPasscodeInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAuth()}
            placeholder="Passcode"
            className="w-full bg-dark border border-dark-border rounded-lg px-4 py-3 text-cream placeholder:text-cream/30 focus:outline-none focus:border-gold/50 text-center text-lg tracking-widest"
          />
          <button
            onClick={handleAuth}
            className="w-full mt-4 bg-gold/20 border border-gold/40 text-gold font-bold py-3 rounded-lg hover:bg-gold/30 transition-colors"
          >
            Enter
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="text-center mb-6">
        <span className="text-4xl">🎩</span>
        <h1 className="font-serif text-2xl md:text-3xl font-bold text-gold mt-2">
          Commissioner Mode
        </h1>
        <p className="text-cream/40 text-sm mt-1">
          Issue rulings, bonuses, and decrees.
        </p>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {(Object.entries(ACTION_CONFIG) as [ActionType, typeof ACTION_CONFIG[ActionType]][]).map(
          ([type, config]) => (
            <button
              key={type}
              onClick={() =>
                setActiveForm(activeForm === type ? null : type)
              }
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                activeForm === type
                  ? "border-gold bg-gold/10"
                  : "border-dark-border bg-dark-card hover:border-gold/30"
              }`}
            >
              <span className="text-2xl">{config.emoji}</span>
              <div className="font-bold text-sm mt-1">{config.label}</div>
            </button>
          )
        )}
      </div>

      {/* Inline form */}
      {activeForm && (
        <div className="bg-dark-card border-2 border-gold/30 rounded-xl p-5 mb-6">
          <h2 className="font-serif text-lg font-bold text-gold mb-4">
            {ACTION_CONFIG[activeForm].emoji}{" "}
            {ACTION_CONFIG[activeForm].label}
          </h2>

          <div className="space-y-4">
            {/* Player dropdown */}
            <div>
              <label className="block text-xs text-cream/50 mb-1">
                Player (optional for notes)
              </label>
              <select
                value={formPlayer}
                onChange={(e) => setFormPlayer(e.target.value)}
                className="w-full bg-dark border border-dark-border rounded-lg px-4 py-2.5 text-cream focus:outline-none focus:border-gold/50"
              >
                <option value="">Select player...</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.avatarEmoji ?? ""} {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Points input (for bonus/deduction) */}
            {ACTION_CONFIG[activeForm].hasPoints && (
              <div>
                <label className="block text-xs text-cream/50 mb-1">
                  Points
                </label>
                <input
                  type="number"
                  value={formPoints}
                  onChange={(e) => setFormPoints(e.target.value)}
                  placeholder={
                    activeForm === "deduction"
                      ? "Points to deduct"
                      : "Points to award"
                  }
                  className="w-full bg-dark border border-dark-border rounded-lg px-4 py-2.5 text-cream placeholder:text-cream/30 focus:outline-none focus:border-gold/50"
                />
              </div>
            )}

            {/* Headline */}
            <div>
              <label className="block text-xs text-cream/50 mb-1">
                Headline
              </label>
              <textarea
                value={formHeadline}
                onChange={(e) => setFormHeadline(e.target.value)}
                placeholder="The Commissioner decrees..."
                rows={2}
                className="w-full bg-dark border border-dark-border rounded-lg px-4 py-2.5 text-cream placeholder:text-cream/30 focus:outline-none focus:border-gold/50 resize-none"
              />
            </div>

            {/* Reason */}
            <div>
              <label className="block text-xs text-cream/50 mb-1">
                Reason
              </label>
              <textarea
                value={formReason}
                onChange={(e) => setFormReason(e.target.value)}
                placeholder="Justification for this action..."
                rows={2}
                className="w-full bg-dark border border-dark-border rounded-lg px-4 py-2.5 text-cream placeholder:text-cream/30 focus:outline-none focus:border-gold/50 resize-none"
              />
            </div>

            {/* Emoji override */}
            <div>
              <label className="block text-xs text-cream/50 mb-1">
                Emoji (optional)
              </label>
              <input
                type="text"
                value={formEmoji}
                onChange={(e) => setFormEmoji(e.target.value)}
                placeholder={ACTION_CONFIG[activeForm].emoji}
                className="w-24 bg-dark border border-dark-border rounded-lg px-4 py-2.5 text-cream text-center text-xl focus:outline-none focus:border-gold/50"
              />
            </div>

            {/* Submit */}
            <div className="flex gap-3">
              <button
                onClick={handleSubmit}
                disabled={submitting || !formHeadline.trim()}
                className="flex-1 bg-gold/20 border border-gold/40 text-gold font-bold py-3 rounded-lg hover:bg-gold/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? "Issuing..." : "Issue Action"}
              </button>
              <button
                onClick={resetForm}
                className="px-6 py-3 bg-dark border border-dark-border rounded-lg text-cream/60 hover:text-cream transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-3 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2 text-red-400 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="mt-3 bg-augusta/10 border border-augusta/30 rounded-lg px-4 py-2 text-augusta-light text-sm">
              {success}
            </div>
          )}
        </div>
      )}

      {/* Recent actions */}
      <div className="mt-8">
        <h2 className="font-serif text-lg font-bold text-gold mb-4">
          🎩 Recent Commissioner Actions
        </h2>

        {actions.length === 0 ? (
          <div className="bg-dark-card border border-dark-border rounded-xl p-8 text-center text-cream/40">
            No commissioner actions yet. The Commissioner&apos;s pen awaits.
          </div>
        ) : (
          <div className="space-y-3">
            {actions.map((action) => (
              <div
                key={action.id}
                className="bg-dark-card border-2 border-gold/20 rounded-xl p-4"
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">
                    {action.emoji ?? "🎩"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs bg-gold/20 text-gold px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">
                        {action.actionType.replace("_", " ")}
                      </span>
                      {action.affectedPlayer && (
                        <span className="text-xs text-cream/50">
                          → {action.affectedPlayer.name}
                        </span>
                      )}
                      {action.pointsDelta != null &&
                        action.pointsDelta !== 0 && (
                          <span
                            className={`text-xs font-bold ${
                              action.pointsDelta > 0
                                ? "text-augusta-light"
                                : "text-red-400"
                            }`}
                          >
                            {action.pointsDelta > 0 ? "+" : ""}
                            {action.pointsDelta} pts
                          </span>
                        )}
                    </div>
                    <p className="font-bold text-sm mt-1">
                      {action.headline}
                    </p>
                    {action.reason && (
                      <p className="text-xs text-cream/50 mt-1">
                        {action.reason}
                      </p>
                    )}
                    <span className="text-[10px] text-cream/30 mt-1 block">
                      {action.createdAt
                        ? new Date(action.createdAt).toLocaleDateString(
                            "en-GB",
                            {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )
                        : ""}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
