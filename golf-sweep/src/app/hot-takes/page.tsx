"use client";

import { useEffect, useState } from "react";

interface Player {
  id: number;
  name: string;
  slug: string;
  avatarEmoji: string | null;
}

interface Tournament {
  id: number;
  name: string;
  status: string;
}

interface HotTake {
  id: number;
  player: { id: number; name: string; avatarEmoji: string | null };
  takeText: string;
  category: string | null;
  outcome: string | null;
  pointsAwarded: number | null;
  submittedAt: string;
  gradingNotes: string | null;
}

interface StandingsEntry {
  player: { id: number; name: string; avatarEmoji: string | null };
  totalPoints: number;
  correct: number;
  wrong: number;
  total: number;
}

const CATEGORIES = [
  { value: "winner", label: "Winner Pick" },
  { value: "miss_cut", label: "Cut Prediction" },
  { value: "score", label: "Score Prediction" },
  { value: "playoff", label: "Playoff" },
  { value: "other", label: "Free-form" },
];

function outcomeBadge(outcome: string | null) {
  switch (outcome) {
    case "correct":
      return (
        <span className="bg-augusta/20 text-augusta-light px-2 py-0.5 rounded text-xs font-bold">
          CORRECT
        </span>
      );
    case "wrong":
      return (
        <span className="bg-red-500/20 text-red-400 px-2 py-0.5 rounded text-xs font-bold">
          WRONG
        </span>
      );
    case "partial":
      return (
        <span className="bg-gold/20 text-gold px-2 py-0.5 rounded text-xs font-bold">
          PARTIAL
        </span>
      );
    default:
      return (
        <span className="bg-cream/10 text-cream/40 px-2 py-0.5 rounded text-xs font-bold">
          UNGRADED
        </span>
      );
  }
}

export default function HotTakesPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<number | null>(
    null
  );
  const [players, setPlayers] = useState<Player[]>([]);
  const [takes, setTakes] = useState<HotTake[]>([]);
  const [standings, setStandings] = useState<StandingsEntry[]>([]);
  const [submissionsOpen, setSubmissionsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form
  const [selectedPlayer, setSelectedPlayer] = useState("");
  const [playerPasscode, setPlayerPasscode] = useState("");
  const [category, setCategory] = useState("other");
  const [takeText, setTakeText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");

  useEffect(() => {
    fetch("/api/season")
      .then((r) => r.json())
      .then((d) => {
        const tourns = d.tournaments ?? [];
        setTournaments(tourns);
        if (d.standings) {
          setPlayers(d.standings.map((s: { player: Player }) => s.player));
        }
        const live = tourns.find((t: Tournament) => t.status === "live");
        if (live) setSelectedTournament(live.id);
        else if (tourns.length > 0) setSelectedTournament(tourns[0].id);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedTournament) return;

    fetch(`/api/hot-takes?tournamentId=${selectedTournament}`)
      .then((r) => r.json())
      .then((d) => {
        setTakes(d.takes ?? []);
        setSubmissionsOpen(d.submissionsOpen ?? false);
      })
      .catch(() => {});

    fetch(`/api/hot-takes/standings?tournamentId=${selectedTournament}`)
      .then((r) => r.json())
      .then((d) => setStandings(d.standings ?? []))
      .catch(() => {});
  }, [selectedTournament]);

  async function handleSubmit() {
    if (!selectedPlayer || !playerPasscode || !takeText.trim()) {
      setSubmitError("Fill in all fields.");
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    setSubmitSuccess("");

    try {
      const res = await fetch("/api/hot-takes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: Number(selectedPlayer),
          passcode: playerPasscode,
          tournamentId: selectedTournament,
          category,
          takeText: takeText.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed (${res.status})`);
      }

      setSubmitSuccess("Hot take submitted! Let's see if you're right.");
      setTakeText("");
      setTimeout(() => setSubmitSuccess(""), 3000);

      // Refresh takes
      const refreshRes = await fetch(
        `/api/hot-takes?tournamentId=${selectedTournament}`
      );
      const refreshData = await refreshRes.json();
      setTakes(refreshData.takes ?? []);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center text-cream/40">
        Loading hot takes...
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="font-serif text-2xl md:text-3xl font-bold mb-2">
        🌶️ Hot Takes
      </h1>
      <p className="text-cream/50 text-sm mb-6">
        Bold predictions. Bragging rights on the line.
      </p>

      {/* Tournament selector */}
      <select
        value={selectedTournament ?? ""}
        onChange={(e) => setSelectedTournament(Number(e.target.value))}
        className="w-full bg-dark-card border border-dark-border rounded-lg px-4 py-2.5 text-cream focus:outline-none focus:border-augusta mb-6"
      >
        {tournaments.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name} {t.status === "live" ? "(Live)" : ""}
          </option>
        ))}
      </select>

      {/* Submission form */}
      {submissionsOpen && (
        <div className="bg-dark-card border border-dark-border rounded-xl p-5 mb-6">
          <h2 className="font-serif text-lg font-bold mb-4">
            Drop Your Hot Take
          </h2>

          {/* Player + passcode */}
          <div className="flex gap-3 mb-4">
            <select
              value={selectedPlayer}
              onChange={(e) => setSelectedPlayer(e.target.value)}
              className="flex-1 bg-dark border border-dark-border rounded-lg px-4 py-2.5 text-cream focus:outline-none focus:border-augusta"
            >
              <option value="">Who are you?</option>
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
              placeholder="Passcode"
              className="w-28 bg-dark border border-dark-border rounded-lg px-3 py-2.5 text-cream placeholder:text-cream/30 focus:outline-none focus:border-augusta text-center"
            />
          </div>

          {/* Category */}
          <div className="mb-4">
            <label className="block text-xs text-cream/50 mb-1">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-dark border border-dark-border rounded-lg px-4 py-2.5 text-cream focus:outline-none focus:border-augusta"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Take text */}
          <div className="mb-4">
            <label className="block text-xs text-cream/50 mb-1">
              Your take
            </label>
            <textarea
              value={takeText}
              onChange={(e) => setTakeText(e.target.value)}
              placeholder="Scheffler shoots 63 in Round 1..."
              rows={3}
              className="w-full bg-dark border border-dark-border rounded-lg px-4 py-2.5 text-cream placeholder:text-cream/30 focus:outline-none focus:border-augusta resize-none"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting || !takeText.trim()}
            className="w-full bg-augusta hover:bg-augusta-light text-cream font-bold py-3 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? "Submitting..." : "Submit Hot Take 🌶️"}
          </button>

          {submitError && (
            <div className="mt-3 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2 text-red-400 text-sm">
              {submitError}
            </div>
          )}
          {submitSuccess && (
            <div className="mt-3 bg-augusta/10 border border-augusta/30 rounded-lg px-4 py-2 text-augusta-light text-sm">
              {submitSuccess}
            </div>
          )}
        </div>
      )}

      {!submissionsOpen && (
        <div className="bg-dark-card border border-dark-border rounded-xl p-6 text-center mb-6">
          <span className="text-3xl">🔒</span>
          <p className="text-cream/50 mt-2 text-sm">
            Hot take submissions are currently closed for this tournament.
          </p>
        </div>
      )}

      {/* All takes */}
      <div className="mb-8">
        <h2 className="font-serif text-lg font-bold mb-4">All Takes</h2>

        {takes.length === 0 ? (
          <div className="bg-dark-card border border-dark-border rounded-xl p-8 text-center text-cream/40">
            No hot takes yet. Be the first to put your neck on the line.
          </div>
        ) : (
          <div className="space-y-3">
            {takes.map((take) => (
              <div
                key={take.id}
                className="bg-dark-card border border-dark-border rounded-xl p-4"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">
                      {take.player.avatarEmoji ?? ""} {take.player.name}
                    </span>
                    {take.category && (
                      <span className="text-xs bg-dark-border px-2 py-0.5 rounded text-cream/50">
                        {
                          CATEGORIES.find((c) => c.value === take.category)
                            ?.label ?? take.category
                        }
                      </span>
                    )}
                  </div>
                  {outcomeBadge(take.outcome)}
                </div>

                <p className="text-sm text-cream/80">{take.takeText}</p>

                {take.gradingNotes && (
                  <p className="text-xs text-cream/40 mt-2 italic">
                    {take.gradingNotes}
                  </p>
                )}

                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] text-cream/30">
                    {new Date(take.submittedAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {take.pointsAwarded != null && take.pointsAwarded > 0 && (
                    <span className="text-gold font-bold text-sm">
                      +{take.pointsAwarded} pts
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hot Take Standings */}
      <div>
        <h2 className="font-serif text-lg font-bold mb-4">
          🌶️ Hot Take Standings
        </h2>

        {standings.length === 0 ? (
          <div className="bg-dark-card border border-dark-border rounded-xl p-8 text-center text-cream/40">
            No graded takes yet.
          </div>
        ) : (
          <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-border text-xs text-cream/40 uppercase tracking-wider">
                  <th className="text-left px-4 py-3">#</th>
                  <th className="text-left px-4 py-3">Player</th>
                  <th className="text-right px-3 py-3">Correct</th>
                  <th className="text-right px-3 py-3">Wrong</th>
                  <th className="text-right px-3 py-3">Total</th>
                  <th className="text-right px-4 py-3 text-gold">Points</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((s, i) => (
                  <tr
                    key={s.player.id}
                    className="border-b border-dark-border/40 last:border-0"
                  >
                    <td className="px-4 py-3 text-cream/40">{i + 1}</td>
                    <td className="px-4 py-3 font-bold">
                      {s.player.avatarEmoji ?? ""} {s.player.name}
                    </td>
                    <td className="text-right px-3 py-3 text-augusta-light">
                      {s.correct}
                    </td>
                    <td className="text-right px-3 py-3 text-red-400">
                      {s.wrong}
                    </td>
                    <td className="text-right px-3 py-3 text-cream/50">
                      {s.total}
                    </td>
                    <td className="text-right px-4 py-3 font-bold text-gold">
                      {s.totalPoints}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
