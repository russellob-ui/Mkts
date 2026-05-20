"use client";

import { useEffect, useState, useCallback } from "react";

interface Player {
  playerId: number;
  playerName: string;
  color: string;
}

interface MatchInfo {
  homeTeam: string;
  awayTeam: string;
  homeFlag: string;
  awayFlag: string;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  kickoff: string;
  stage: string;
}

interface Prediction {
  id: number;
  playerId: number;
  matchId: number | null;
  predictionType: string;
  predictionValue: string;
  submittedAt: string;
  resolved: boolean;
  correct: boolean | null;
  pointsAwarded: number | null;
  resolvedAt: string | null;
  match: MatchInfo | null;
}

interface UpcomingMatch {
  id: number;
  homeTeam: string;
  awayTeam: string;
  homeFlag: string;
  awayFlag: string;
  status: string;
  kickoff: string;
  stage: string;
}

function formatKickoff(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const time = d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${day} ${time}`;
}

export default function PredictionsPage() {
  const [playersList, setPlayersList] = useState<Player[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [upcomingMatches, setUpcomingMatches] = useState<UpcomingMatch[]>([]);
  const [passcode, setPasscode] = useState("");
  const [submitting, setSubmitting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load passcode from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("wc_sweep_passcode");
    if (stored) setPasscode(stored);
  }, []);

  // Save passcode to localStorage when it changes
  useEffect(() => {
    if (passcode) {
      localStorage.setItem("wc_sweep_passcode", passcode);
    }
  }, [passcode]);

  // Load players from leaderboard
  useEffect(() => {
    async function loadPlayers() {
      try {
        const res = await fetch("/api/leaderboard");
        if (res.ok) {
          const data = await res.json();
          const list = (data.leaderboard ?? []).map((p: any) => ({
            playerId: p.playerId,
            playerName: p.playerName,
            color: p.color,
          }));
          setPlayersList(list);
          // Auto-select first player if none selected
          if (!selectedPlayerId && list.length > 0) {
            const storedId = localStorage.getItem("wc_sweep_player_id");
            if (storedId && list.find((p: Player) => p.playerId === Number(storedId))) {
              setSelectedPlayerId(Number(storedId));
            } else {
              setSelectedPlayerId(list[0].playerId);
            }
          }
        }
      } catch {
        // API not ready
      }
    }
    loadPlayers();
  }, []);

  // Save selected player
  useEffect(() => {
    if (selectedPlayerId) {
      localStorage.setItem("wc_sweep_player_id", String(selectedPlayerId));
    }
  }, [selectedPlayerId]);

  const loadData = useCallback(async () => {
    if (!selectedPlayerId) return;
    try {
      const [predsRes, matchesRes] = await Promise.all([
        fetch(`/api/predictions?playerId=${selectedPlayerId}`),
        fetch("/api/matches"),
      ]);

      if (predsRes.ok) {
        const predsData = await predsRes.json();
        setPredictions(predsData.predictions ?? []);
      }

      if (matchesRes.ok) {
        const matchesData = await matchesRes.json();
        // Collect all scheduled matches from the various buckets
        const all: UpcomingMatch[] = [];
        for (const bucket of ["today", "upcoming"]) {
          const items = matchesData[bucket] ?? [];
          for (const m of items) {
            if (m.status === "scheduled") {
              all.push({
                id: m.id,
                homeTeam: m.homeTeam,
                awayTeam: m.awayTeam,
                homeFlag: m.homeFlag,
                awayFlag: m.awayFlag,
                status: m.status,
                kickoff: m.kickoff,
                stage: m.stage,
              });
            }
          }
        }
        // Also fetch all scheduled matches directly in case they're beyond 48h
        const allMatchesRes = await fetch("/api/matches?date=all");
        if (allMatchesRes.ok) {
          const allData = await allMatchesRes.json();
          const allItems = allData.matches ?? [];
          for (const m of allItems) {
            if (m.status === "scheduled" && !all.find((a) => a.id === m.id)) {
              all.push({
                id: m.id,
                homeTeam: m.homeTeam,
                awayTeam: m.awayTeam,
                homeFlag: m.homeFlag,
                awayFlag: m.awayFlag,
                status: m.status,
                kickoff: m.kickoff,
                stage: m.stage,
              });
            }
          }
        }
        all.sort(
          (a, b) =>
            new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime()
        );
        setUpcomingMatches(all);
      }
    } catch {
      // API not ready
    } finally {
      setLoading(false);
    }
  }, [selectedPlayerId]);

  // Load data on player change + poll
  useEffect(() => {
    setLoading(true);
    loadData();
    const interval = setInterval(loadData, 30_000);
    return () => clearInterval(interval);
  }, [loadData]);

  async function submitPrediction(matchId: number, value: string) {
    if (!selectedPlayerId) return;
    setSubmitting(matchId);
    setError(null);

    try {
      const res = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: selectedPlayerId,
          matchId,
          predictionType: "match_result",
          predictionValue: value,
          passcode,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to submit prediction");
      } else {
        // Refresh predictions
        await loadData();
      }
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(null);
    }
  }

  // Helpers: look up current prediction for a match
  function getPrediction(matchId: number): Prediction | undefined {
    return predictions.find(
      (p) => p.matchId === matchId && p.predictionType === "match_result"
    );
  }

  // Separate resolved predictions (past) from unresolved
  const resolvedPredictions = predictions.filter((p) => p.resolved);
  const correctCount = resolvedPredictions.filter((p) => p.correct).length;
  const totalPoints = resolvedPredictions.reduce(
    (s, p) => s + (p.pointsAwarded ?? 0),
    0
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="font-serif text-3xl font-bold">
          <span className="text-wc-gold">Match</span> Predictions
        </h1>
        <p className="text-cream/50 text-sm">
          Predict match results &middot; 2 points per correct prediction
        </p>
      </div>

      {/* Player selector + passcode */}
      <div className="bg-dark-card border border-dark-border rounded-lg p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="block text-xs text-cream/40 mb-1">Player</label>
            <select
              value={selectedPlayerId ?? ""}
              onChange={(e) => setSelectedPlayerId(Number(e.target.value))}
              className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-cream"
            >
              {playersList.map((p) => (
                <option key={p.playerId} value={p.playerId}>
                  {p.playerName}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs text-cream/40 mb-1">
              Passcode
            </label>
            <input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Enter your passcode"
              className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-cream placeholder:text-cream/20"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-wc-red/20 border border-wc-red/40 rounded-lg p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-cream/40">Loading...</div>
      ) : (
        <>
          {/* Upcoming matches with prediction buttons */}
          <section className="space-y-3">
            <h2 className="font-serif text-xl font-bold text-wc-gold border-b border-dark-border pb-2">
              Upcoming Matches
            </h2>
            {upcomingMatches.length === 0 ? (
              <div className="bg-dark-card border border-dark-border rounded-lg p-4 text-center text-cream/40">
                No upcoming matches to predict.
              </div>
            ) : (
              upcomingMatches.map((match) => {
                const pred = getPrediction(match.id);
                const isSubmitting = submitting === match.id;

                return (
                  <div
                    key={match.id}
                    className="bg-dark-card border border-dark-border rounded-lg p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs text-cream/40">
                      <span>{match.stage}</span>
                      <span>{formatKickoff(match.kickoff)}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{match.homeFlag}</span>
                        <span className="font-medium">{match.homeTeam}</span>
                      </div>
                      <span className="text-cream/30 text-sm mx-2">vs</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{match.awayTeam}</span>
                        <span className="text-lg">{match.awayFlag}</span>
                      </div>
                    </div>

                    {/* Prediction buttons */}
                    <div className="flex gap-2">
                      {(["home", "draw", "away"] as const).map((value) => {
                        const isSelected = pred?.predictionValue === value;
                        const label =
                          value === "home"
                            ? match.homeTeam
                            : value === "away"
                              ? match.awayTeam
                              : "Draw";

                        return (
                          <button
                            key={value}
                            onClick={() => submitPrediction(match.id, value)}
                            disabled={isSubmitting}
                            className={`flex-1 py-2 px-2 rounded text-xs font-medium transition-all ${
                              isSelected
                                ? "bg-wc-gold/20 border-2 border-wc-gold text-wc-gold"
                                : "bg-dark border border-dark-border text-cream/60 hover:border-cream/30 hover:text-cream"
                            } ${isSubmitting ? "opacity-50" : ""}`}
                          >
                            <span className="flex items-center justify-center gap-1">
                              {isSelected && (
                                <svg
                                  className="w-3.5 h-3.5"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={3}
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                              )}
                              {label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </section>

          {/* Past predictions / results */}
          {resolvedPredictions.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-serif text-xl font-bold text-wc-gold border-b border-dark-border pb-2">
                Results
                <span className="text-sm font-sans font-normal text-cream/50 ml-2">
                  {correctCount}/{resolvedPredictions.length} correct &middot;{" "}
                  {totalPoints} pts
                </span>
              </h2>
              {resolvedPredictions
                .sort(
                  (a, b) =>
                    new Date(b.resolvedAt ?? b.submittedAt).getTime() -
                    new Date(a.resolvedAt ?? a.submittedAt).getTime()
                )
                .map((pred) => (
                  <div
                    key={pred.id}
                    className="bg-dark-card border border-dark-border rounded-lg p-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        {pred.match && (
                          <>
                            <span>{pred.match.homeFlag}</span>
                            <span className="font-medium">
                              {pred.match.homeTeam}
                            </span>
                            <span className="text-cream/40">
                              {pred.match.homeScore} &ndash;{" "}
                              {pred.match.awayScore}
                            </span>
                            <span className="font-medium">
                              {pred.match.awayTeam}
                            </span>
                            <span>{pred.match.awayFlag}</span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {pred.correct ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={3}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                            +{pred.pointsAwarded}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full">
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={3}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                            Wrong
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-cream/40">
                      You predicted:{" "}
                      <span className="text-cream/60">
                        {pred.predictionValue === "home"
                          ? `${pred.match?.homeTeam ?? "Home"} win`
                          : pred.predictionValue === "away"
                            ? `${pred.match?.awayTeam ?? "Away"} win`
                            : "Draw"}
                      </span>
                    </div>
                  </div>
                ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
