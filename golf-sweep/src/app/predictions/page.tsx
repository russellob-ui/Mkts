"use client";

import { useEffect, useState } from "react";

interface Player {
  id: number;
  name: string;
  slug: string;
  avatarEmoji: string | null;
  passcode: string | null;
}

interface Tournament {
  id: number;
  name: string;
  status: string;
}

interface PredictionRow {
  subjectPlayer: { id: number; name: string; avatarEmoji: string | null };
  golferName: string;
  predictedScoreToPar: number | null;
  predictedOutcome: string | null;
  actualScoreToPar: number | null;
  actualOutcome: string | null;
  outcomeCorrect: boolean | null;
  exactCorrect: boolean | null;
  pointsAwarded: number | null;
}

interface RoundResult {
  predictions: PredictionRow[];
  totalPoints: number;
}

interface StandingsEntry {
  player: { id: number; name: string; avatarEmoji: string | null };
  totalPoints: number;
  correctOutcomes: number;
  exactPredictions: number;
}

export default function PredictionsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<number | null>(null);
  const [selectedRound, setSelectedRound] = useState(1);
  const [players, setPlayers] = useState<Player[]>([]);
  const [standings, setStandings] = useState<StandingsEntry[]>([]);
  const [results, setResults] = useState<RoundResult | null>(null);
  const [windowOpen, setWindowOpen] = useState(false);
  const [roundComplete, setRoundComplete] = useState(false);
  const [loading, setLoading] = useState(true);

  // Auth
  const [selectedPlayer, setSelectedPlayer] = useState("");
  const [playerPasscode, setPlayerPasscode] = useState("");

  // Prediction form
  const [predictions, setPredictions] = useState<
    Record<number, { score: number; outcome: string }>
  >({});
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
        // Default to live or first tournament
        const live = tourns.find((t: Tournament) => t.status === "live");
        if (live) setSelectedTournament(live.id);
        else if (tourns.length > 0) setSelectedTournament(tourns[0].id);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Fetch predictions data when tournament/round changes
  useEffect(() => {
    if (!selectedTournament) return;

    fetch(
      `/api/predictions?tournamentId=${selectedTournament}&round=${selectedRound}`
    )
      .then((r) => r.json())
      .then((d) => {
        setWindowOpen(d.windowOpen ?? false);
        setRoundComplete(d.roundComplete ?? false);
        if (d.results) setResults(d.results);
        else setResults(null);
        // Auto-jump to the tournament's live round the first time
        // we land on a tournament (only if we're still on the default R1)
        const live = d.currentTournamentRound;
        if (live && live >= 1 && live <= 4) {
          setSelectedRound((prev) => (prev === 1 && live !== 1 ? live : prev));
        }
      })
      .catch(() => {});

    fetch(`/api/predictions/standings?tournamentId=${selectedTournament}`)
      .then((r) => r.json())
      .then((d) => setStandings(d.standings ?? []))
      .catch(() => {});
  }, [selectedTournament, selectedRound]);

  // Initialize prediction form when players change
  useEffect(() => {
    if (players.length === 0) return;
    const init: Record<number, { score: number; outcome: string }> = {};
    players.forEach((p) => {
      init[p.id] = { score: 0, outcome: "even" };
    });
    setPredictions(init);
  }, [players]);

  function adjustScore(playerId: number, delta: number) {
    setPredictions((prev) => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        score: (prev[playerId]?.score ?? 0) + delta,
      },
    }));
  }

  function setOutcome(playerId: number, outcome: string) {
    setPredictions((prev) => ({
      ...prev,
      [playerId]: { ...prev[playerId], outcome },
    }));
  }

  async function handleSubmit() {
    if (!selectedPlayer || !playerPasscode) {
      setSubmitError("Select yourself and enter your passcode.");
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    setSubmitSuccess("");

    const predictorId = Number(selectedPlayer);
    const items = Object.entries(predictions)
      .filter(([id]) => Number(id) !== predictorId)
      .map(([id, pred]) => ({
        subjectPlayerId: Number(id),
        predictedScoreToPar: pred.score,
        predictedOutcome: pred.outcome,
      }));

    try {
      const res = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          predictorPlayerId: predictorId,
          passcode: playerPasscode,
          tournamentId: selectedTournament,
          roundNumber: selectedRound,
          predictions: items,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed (${res.status})`);
      }

      setSubmitSuccess("Predictions submitted!");
      setTimeout(() => setSubmitSuccess(""), 3000);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  function formatScore(s: number): string {
    if (s === 0) return "E";
    return s > 0 ? `+${s}` : String(s);
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center text-cream/40">
        Loading predictions...
      </div>
    );
  }

  const predictorId = selectedPlayer ? Number(selectedPlayer) : null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="font-serif text-2xl md:text-3xl font-bold mb-2">
        Predictions Market
      </h1>
      <p className="text-cream/50 text-sm mb-6">
        Predict each player&apos;s golfer score for each round. Points for correct outcomes and exact scores.
      </p>

      {/* Tournament + Round selector */}
      <div className="flex gap-3 mb-6">
        <select
          value={selectedTournament ?? ""}
          onChange={(e) => setSelectedTournament(Number(e.target.value))}
          className="flex-1 bg-dark-card border border-dark-border rounded-lg px-4 py-2.5 text-cream focus:outline-none focus:border-augusta"
        >
          {tournaments.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} {t.status === "live" ? "(Live)" : ""}
            </option>
          ))}
        </select>

        <div className="flex bg-dark-card border border-dark-border rounded-lg overflow-hidden">
          {[1, 2, 3, 4].map((r) => (
            <button
              key={r}
              onClick={() => setSelectedRound(r)}
              className={`px-4 py-2.5 text-sm font-bold transition-colors ${
                selectedRound === r
                  ? "bg-augusta text-cream"
                  : "text-cream/50 hover:text-cream"
              }`}
            >
              R{r}
            </button>
          ))}
        </div>
      </div>

      {/* Submission form (if window open) */}
      {windowOpen && !roundComplete && (
        <div className="bg-dark-card border border-dark-border rounded-xl p-5 mb-6">
          <h2 className="font-serif text-lg font-bold mb-4">
            Submit Your Predictions
          </h2>

          {/* Player identity */}
          <div className="flex gap-3 mb-5">
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

          {/* Per-player predictions */}
          <div className="space-y-3">
            {players
              .filter((p) => !predictorId || p.id !== predictorId)
              .map((p) => {
                const pred = predictions[p.id] ?? { score: 0, outcome: "even" };
                return (
                  <div
                    key={p.id}
                    className="bg-dark rounded-xl p-4 border border-dark-border/50"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-bold text-sm">
                        {p.avatarEmoji ?? ""} {p.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Score stepper */}
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-cream/40 mr-1">Score:</span>
                        <button
                          onClick={() => adjustScore(p.id, -1)}
                          className="w-8 h-8 rounded-lg bg-dark-card border border-dark-border text-cream font-bold text-lg flex items-center justify-center hover:border-augusta transition-colors"
                        >
                          -
                        </button>
                        <span className="w-10 text-center font-mono font-bold">
                          {formatScore(pred.score)}
                        </span>
                        <button
                          onClick={() => adjustScore(p.id, 1)}
                          className="w-8 h-8 rounded-lg bg-dark-card border border-dark-border text-cream font-bold text-lg flex items-center justify-center hover:border-augusta transition-colors"
                        >
                          +
                        </button>
                      </div>

                      {/* Outcome radio */}
                      <div className="flex gap-1 ml-auto">
                        {[
                          {
                            value: "red",
                            label: "Red",
                            bg: "bg-red-500/20 border-red-500/40 text-red-400",
                            activeBg: "bg-red-500/40 border-red-500",
                          },
                          {
                            value: "even",
                            label: "Even",
                            bg: "bg-gray-500/20 border-gray-500/40 text-gray-400",
                            activeBg: "bg-gray-500/40 border-gray-500",
                          },
                          {
                            value: "over",
                            label: "Over",
                            bg: "bg-blue-500/20 border-blue-500/40 text-blue-400",
                            activeBg: "bg-blue-500/40 border-blue-500",
                          },
                        ].map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => setOutcome(p.id, opt.value)}
                            className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                              pred.outcome === opt.value ? opt.activeBg : opt.bg
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting || !selectedPlayer || !playerPasscode}
            className="w-full mt-5 bg-augusta hover:bg-augusta-light text-cream font-bold py-3 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? "Submitting..." : "Submit All Predictions"}
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

      {/* Window closed message */}
      {!windowOpen && !roundComplete && (
        <div className="bg-dark-card border border-dark-border rounded-xl p-8 text-center mb-6">
          <span className="text-3xl">🔒</span>
          <p className="text-cream/50 mt-2">
            Prediction window is closed for Round {selectedRound}.
          </p>
        </div>
      )}

      {/* Results (if round complete) */}
      {roundComplete && results && (
        <div className="bg-dark-card border border-dark-border rounded-xl p-5 mb-6">
          <h2 className="font-serif text-lg font-bold mb-4">
            Round {selectedRound} Results
          </h2>

          <div className="space-y-2">
            {results.predictions.map((pred) => (
              <div
                key={pred.subjectPlayer.id}
                className="flex items-center justify-between bg-dark rounded-lg px-4 py-3 border border-dark-border/50"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">
                    {pred.subjectPlayer.avatarEmoji ?? ""}{" "}
                    {pred.subjectPlayer.name}
                  </span>
                  <span className="text-xs text-cream/40">
                    ({pred.golferName})
                  </span>
                </div>

                <div className="flex items-center gap-3 text-sm">
                  {/* Predicted */}
                  <span className="text-cream/50">
                    Pred: {pred.predictedScoreToPar !== null ? formatScore(pred.predictedScoreToPar) : "-"}{" "}
                    <span className="uppercase text-xs">{pred.predictedOutcome}</span>
                  </span>

                  {/* Actual */}
                  <span className="text-cream/80">
                    Act: {pred.actualScoreToPar !== null ? formatScore(pred.actualScoreToPar) : "-"}{" "}
                    <span className="uppercase text-xs">{pred.actualOutcome}</span>
                  </span>

                  {/* Result */}
                  {pred.exactCorrect && (
                    <span className="bg-gold/20 text-gold px-2 py-0.5 rounded text-xs font-bold">
                      EXACT
                    </span>
                  )}
                  {pred.outcomeCorrect && !pred.exactCorrect && (
                    <span className="bg-augusta/20 text-augusta-light px-2 py-0.5 rounded text-xs font-bold">
                      CORRECT
                    </span>
                  )}
                  {pred.outcomeCorrect === false && (
                    <span className="bg-red-500/20 text-red-400 px-2 py-0.5 rounded text-xs font-bold">
                      WRONG
                    </span>
                  )}

                  {pred.pointsAwarded != null && pred.pointsAwarded > 0 && (
                    <span className="text-gold font-bold">
                      +{pred.pointsAwarded}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 text-right">
            <span className="text-cream/50 text-sm">Round total: </span>
            <span className="text-gold font-bold text-lg">
              {results.totalPoints} pts
            </span>
          </div>
        </div>
      )}

      {/* Pundit standings */}
      <div className="mt-8">
        <h2 className="font-serif text-lg font-bold mb-4">
          🔮 Pundit Standings
        </h2>

        {standings.length === 0 ? (
          <div className="bg-dark-card border border-dark-border rounded-xl p-8 text-center text-cream/40">
            No predictions have been resolved yet.
          </div>
        ) : (
          <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-border text-xs text-cream/40 uppercase tracking-wider">
                  <th className="text-left px-4 py-3">#</th>
                  <th className="text-left px-4 py-3">Player</th>
                  <th className="text-right px-4 py-3">Correct</th>
                  <th className="text-right px-4 py-3">Exact</th>
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
                    <td className="text-right px-4 py-3 text-augusta-light">
                      {s.correctOutcomes}
                    </td>
                    <td className="text-right px-4 py-3 text-gold">
                      {s.exactPredictions}
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
