"use client";

import { useEffect, useState, useCallback } from "react";

interface Player {
  playerId: number;
  playerName: string;
}

interface PropBet {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string | null;
  date: string;
}

interface PropPrediction {
  id: number;
  playerId: number;
  playerName: string;
  propId: string;
  answer: string;
  resolved: boolean;
  correct: boolean | null;
  pointsAwarded: number | null;
}

export default function PropsPage() {
  const [playersList, setPlayersList] = useState<Player[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [passcode, setPasscode] = useState("");
  const [props, setProps] = useState<PropBet[]>([]);
  const [propPredictions, setPropPredictions] = useState<PropPrediction[]>([]);
  const [matchCount, setMatchCount] = useState(0);
  const [allFinished, setAllFinished] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // localStorage
  useEffect(() => {
    const stored = localStorage.getItem("wc_sweep_passcode");
    if (stored) setPasscode(stored);
  }, []);

  useEffect(() => {
    if (passcode) localStorage.setItem("wc_sweep_passcode", passcode);
  }, [passcode]);

  // Load players
  useEffect(() => {
    async function loadPlayers() {
      try {
        const res = await fetch("/api/leaderboard");
        if (res.ok) {
          const data = await res.json();
          const list = (data.leaderboard ?? []).map((p: any) => ({
            playerId: p.playerId,
            playerName: p.playerName,
          }));
          setPlayersList(list);
          if (!selectedPlayerId && list.length > 0) {
            const storedId = localStorage.getItem("wc_sweep_player_id");
            if (
              storedId &&
              list.find((p: Player) => p.playerId === Number(storedId))
            ) {
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

  useEffect(() => {
    if (selectedPlayerId) {
      localStorage.setItem("wc_sweep_player_id", String(selectedPlayerId));
    }
  }, [selectedPlayerId]);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/props");
      if (res.ok) {
        const data = await res.json();
        setProps(data.props ?? []);
        setPropPredictions(data.predictions ?? []);
        setMatchCount(data.matchCount ?? 0);
        setAllFinished(data.allFinished ?? false);
      }
    } catch {
      // API not ready
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadData();
    const interval = setInterval(loadData, 30_000);
    return () => clearInterval(interval);
  }, [loadData]);

  async function submitProp(propId: string, answer: string) {
    if (!selectedPlayerId) return;
    setSubmitting(propId);
    setError(null);

    try {
      const res = await fetch("/api/props", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: selectedPlayerId,
          propId,
          answer,
          passcode,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to submit");
      } else {
        await loadData();
      }
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(null);
    }
  }

  function getMyPrediction(propId: string): PropPrediction | undefined {
    return propPredictions.find(
      (p) => p.playerId === selectedPlayerId && p.propId === propId
    );
  }

  const myResolved = propPredictions.filter(
    (p) => p.playerId === selectedPlayerId && p.resolved
  );
  const myCorrect = myResolved.filter((p) => p.correct).length;
  const myTotalPts = myResolved.reduce(
    (s, p) => s + (p.pointsAwarded ?? 0),
    0
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="font-serif text-3xl font-bold">
          <span className="text-wc-gold">Daily</span> Prop Bets
        </h1>
        <p className="text-cream/50 text-sm">
          {matchCount} match{matchCount !== 1 ? "es" : ""} today &middot; +1 pt
          per correct prop
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
      ) : props.length === 0 ? (
        <div className="bg-dark-card border border-dark-border rounded-lg p-8 text-center">
          <div className="text-4xl mb-3">⚽</div>
          <p className="text-cream/50">No matches today — no props available.</p>
          <p className="text-cream/30 text-sm mt-1">
            Check back on a match day!
          </p>
        </div>
      ) : (
        <section className="space-y-4">
          {props.map((prop) => {
            const myPred = getMyPrediction(prop.id);
            const isResolved = prop.correctAnswer !== null;
            const isSubmittingThis = submitting === prop.id;

            return (
              <div
                key={prop.id}
                className={`bg-dark-card border rounded-lg p-4 space-y-3 ${
                  isResolved
                    ? myPred?.correct
                      ? "border-green-500/40"
                      : myPred
                        ? "border-red-500/40"
                        : "border-dark-border"
                    : "border-dark-border"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium text-sm">{prop.question}</h3>
                  {isResolved && myPred && (
                    <span
                      className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
                        myPred.correct
                          ? "bg-green-400/10 text-green-400"
                          : "bg-red-400/10 text-red-400"
                      }`}
                    >
                      {myPred.correct ? "+1" : "Wrong"}
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  {prop.options.map((option) => {
                    const isSelected = myPred?.answer === option;
                    const isCorrectAnswer =
                      isResolved && prop.correctAnswer === option;

                    return (
                      <button
                        key={option}
                        onClick={() =>
                          !isResolved && submitProp(prop.id, option)
                        }
                        disabled={isResolved || isSubmittingThis}
                        className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-all ${
                          isCorrectAnswer
                            ? "bg-green-500/20 border-2 border-green-500 text-green-400"
                            : isSelected
                              ? isResolved
                                ? "bg-red-500/10 border-2 border-red-500/40 text-red-400"
                                : "bg-wc-gold/20 border-2 border-wc-gold text-wc-gold"
                              : "bg-dark border border-dark-border text-cream/60"
                        } ${
                          isResolved
                            ? "cursor-default"
                            : "hover:border-cream/30 hover:text-cream"
                        } ${isSubmittingThis ? "opacity-50" : ""}`}
                      >
                        <span className="flex items-center justify-center gap-1.5">
                          {isSelected && !isResolved && (
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
                          {isCorrectAnswer && (
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
                          {option}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {isResolved && (
                  <div className="text-xs text-cream/30">
                    Answer: <span className="text-green-400">{prop.correctAnswer}</span>
                  </div>
                )}
              </div>
            );
          })}

          {/* Summary for resolved */}
          {myResolved.length > 0 && (
            <div className="bg-dark-card border border-dark-border rounded-lg p-4 text-center">
              <div className="text-sm text-cream/50">
                {myCorrect}/{myResolved.length} correct &middot;{" "}
                {myTotalPts > 0 ? "+" : ""}
                {myTotalPts} pts
              </div>
            </div>
          )}

          {/* All players' picks for today (social view) */}
          {propPredictions.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-cream/40 uppercase tracking-wider">
                Everyone&apos;s Picks
              </h3>
              <div className="bg-dark-card border border-dark-border rounded-lg divide-y divide-dark-border overflow-hidden">
                {Array.from(
                  new Set(propPredictions.map((p) => p.playerId))
                ).map((pid) => {
                  const playerPreds = propPredictions.filter(
                    (p) => p.playerId === pid
                  );
                  const name = playerPreds[0]?.playerName ?? "?";
                  return (
                    <div
                      key={pid}
                      className="px-3 py-2 flex items-center justify-between"
                    >
                      <span className="text-sm font-medium">{name}</span>
                      <div className="flex gap-2 text-xs">
                        {playerPreds.map((pp) => (
                          <span
                            key={pp.id}
                            className={`px-2 py-0.5 rounded ${
                              pp.resolved
                                ? pp.correct
                                  ? "bg-green-400/10 text-green-400"
                                  : "bg-red-400/10 text-red-400"
                                : "bg-dark-border text-cream/50"
                            }`}
                          >
                            {pp.answer}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
