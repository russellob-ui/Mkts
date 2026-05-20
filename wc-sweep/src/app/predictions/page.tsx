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

type PredictionTab = "match_result" | "exact_score" | "first_scorer";

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

function ConfidenceStars({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-cream/40 mr-1">Confidence:</span>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          onClick={() => onChange(star)}
          className={`text-lg transition-all ${
            star <= value
              ? "text-wc-gold drop-shadow-[0_0_4px_rgba(212,168,67,0.5)]"
              : "text-cream/20 hover:text-cream/40"
          } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
        >
          ★
        </button>
      ))}
      {value > 1 && (
        <span className="text-xs text-cream/40 ml-1">
          {value === 2
            ? "1.25x"
            : value === 3
              ? "1.5x"
              : value === 4
                ? "1.75x"
                : "2x"}
          {" / "}
          <span className="text-red-400">-{value - 1} if wrong</span>
        </span>
      )}
    </div>
  );
}

export default function PredictionsPage() {
  const [playersList, setPlayersList] = useState<Player[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [upcomingMatches, setUpcomingMatches] = useState<UpcomingMatch[]>([]);
  const [passcode, setPasscode] = useState("");
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<PredictionTab>("match_result");

  // Local state for exact scores and first scorers (before submission)
  const [exactScores, setExactScores] = useState<
    Record<number, { home: string; away: string }>
  >({});
  const [firstScorers, setFirstScorers] = useState<Record<number, string>>({});
  const [confidences, setConfidences] = useState<Record<string, number>>({});

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
        const preds: Prediction[] = predsData.predictions ?? [];
        setPredictions(preds);

        // Initialize local state from existing predictions
        const newExactScores: Record<number, { home: string; away: string }> =
          {};
        const newFirstScorers: Record<number, string> = {};
        const newConfidences: Record<string, number> = {};

        for (const p of preds) {
          if (!p.matchId) continue;
          if (p.predictionType === "exact_score") {
            const [h, a] = p.predictionValue.split("-");
            newExactScores[p.matchId] = { home: h ?? "", away: a ?? "" };
          } else if (p.predictionType === "first_scorer") {
            newFirstScorers[p.matchId] = p.predictionValue;
          } else if (p.predictionType === "confidence") {
            // Find which other prediction types exist for this match
            // Store confidence keyed by matchId (applies to all prediction types for that match)
            newConfidences[String(p.matchId)] = Number(p.predictionValue) || 1;
          }
        }

        setExactScores((prev) => ({ ...prev, ...newExactScores }));
        setFirstScorers((prev) => ({ ...prev, ...newFirstScorers }));
        setConfidences((prev) => ({ ...prev, ...newConfidences }));
      }

      if (matchesRes.ok) {
        const matchesData = await matchesRes.json();
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

  useEffect(() => {
    setLoading(true);
    loadData();
    const interval = setInterval(loadData, 30_000);
    return () => clearInterval(interval);
  }, [loadData]);

  async function submitPrediction(
    matchId: number,
    type: PredictionTab,
    value: string
  ) {
    if (!selectedPlayerId) return;
    setSubmitting(`${type}-${matchId}`);
    setError(null);

    try {
      const conf = confidences[String(matchId)] ?? 1;
      const res = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: selectedPlayerId,
          matchId,
          predictionType: type,
          predictionValue: value,
          passcode,
          confidence: conf,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to submit prediction");
      } else {
        await loadData();
      }
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(null);
    }
  }

  function getPrediction(
    matchId: number,
    type: string = "match_result"
  ): Prediction | undefined {
    return predictions.find(
      (p) => p.matchId === matchId && p.predictionType === type
    );
  }

  function getConfidence(matchId: number): number {
    return confidences[String(matchId)] ?? 1;
  }

  function setConfidence(matchId: number, value: number) {
    setConfidences((prev) => ({ ...prev, [String(matchId)]: value }));
  }

  // Separate resolved predictions (past) from unresolved
  const resolvedPredictions = predictions.filter(
    (p) => p.resolved && p.predictionType !== "confidence"
  );
  const correctCount = resolvedPredictions.filter((p) => p.correct).length;
  const totalPoints = resolvedPredictions.reduce(
    (s, p) => s + (p.pointsAwarded ?? 0),
    0
  );

  const tabs: { key: PredictionTab; label: string }[] = [
    { key: "match_result", label: "Match Result" },
    { key: "exact_score", label: "Exact Score" },
    { key: "first_scorer", label: "First Scorer" },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="font-serif text-3xl font-bold">
          <span className="text-wc-gold">Match</span> Predictions
        </h1>
        <p className="text-cream/50 text-sm">
          Predict match results, exact scores &amp; first scorers
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

      {/* Tabs */}
      <div className="flex border-b border-dark-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-3 px-2 text-sm font-medium transition-all text-center ${
              activeTab === tab.key
                ? "text-wc-gold border-b-2 border-wc-gold"
                : "text-cream/40 hover:text-cream/60"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-cream/40">Loading...</div>
      ) : (
        <>
          {/* Upcoming matches with prediction inputs */}
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
                const isSubmitting = submitting === `${activeTab}-${match.id}`;
                const matchConf = getConfidence(match.id);

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

                    {/* Tab-specific prediction input */}
                    {activeTab === "match_result" && (
                      <MatchResultInput
                        match={match}
                        prediction={getPrediction(match.id, "match_result")}
                        isSubmitting={isSubmitting}
                        onSubmit={(value) =>
                          submitPrediction(match.id, "match_result", value)
                        }
                      />
                    )}

                    {activeTab === "exact_score" && (
                      <ExactScoreInput
                        match={match}
                        scores={exactScores[match.id] ?? { home: "", away: "" }}
                        prediction={getPrediction(match.id, "exact_score")}
                        isSubmitting={isSubmitting}
                        onScoreChange={(home, away) =>
                          setExactScores((prev) => ({
                            ...prev,
                            [match.id]: { home, away },
                          }))
                        }
                        onSubmit={(value) =>
                          submitPrediction(match.id, "exact_score", value)
                        }
                      />
                    )}

                    {activeTab === "first_scorer" && (
                      <FirstScorerInput
                        scorer={firstScorers[match.id] ?? ""}
                        prediction={getPrediction(match.id, "first_scorer")}
                        isSubmitting={isSubmitting}
                        onScorerChange={(value) =>
                          setFirstScorers((prev) => ({
                            ...prev,
                            [match.id]: value,
                          }))
                        }
                        onSubmit={(value) =>
                          submitPrediction(match.id, "first_scorer", value)
                        }
                      />
                    )}

                    {/* Confidence slider — always shown */}
                    <ConfidenceStars
                      value={matchConf}
                      onChange={(v) => setConfidence(match.id, v)}
                      disabled={isSubmitting}
                    />
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
                  {totalPoints > 0 ? "+" : ""}
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
                            {(pred.pointsAwarded ?? 0) > 0 ? "+" : ""}
                            {pred.pointsAwarded}
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
                            {(pred.pointsAwarded ?? 0) < 0
                              ? `${pred.pointsAwarded}`
                              : "Wrong"}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-cream/40">
                      <span className="text-cream/30 mr-1">
                        [{pred.predictionType === "match_result"
                          ? "Result"
                          : pred.predictionType === "exact_score"
                            ? "Score"
                            : pred.predictionType === "first_scorer"
                              ? "Scorer"
                              : pred.predictionType}]
                      </span>
                      You predicted:{" "}
                      <span className="text-cream/60">
                        {pred.predictionType === "match_result"
                          ? pred.predictionValue === "home"
                            ? `${pred.match?.homeTeam ?? "Home"} win`
                            : pred.predictionValue === "away"
                              ? `${pred.match?.awayTeam ?? "Away"} win`
                              : "Draw"
                          : pred.predictionValue}
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

/* ---- Sub-components ---- */

function MatchResultInput({
  match,
  prediction,
  isSubmitting,
  onSubmit,
}: {
  match: UpcomingMatch;
  prediction: Prediction | undefined;
  isSubmitting: boolean;
  onSubmit: (value: string) => void;
}) {
  return (
    <div className="flex gap-2">
      {(["home", "draw", "away"] as const).map((value) => {
        const isSelected = prediction?.predictionValue === value;
        const label =
          value === "home"
            ? match.homeTeam
            : value === "away"
              ? match.awayTeam
              : "Draw";

        return (
          <button
            key={value}
            onClick={() => onSubmit(value)}
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
  );
}

function ExactScoreInput({
  match,
  scores,
  prediction,
  isSubmitting,
  onScoreChange,
  onSubmit,
}: {
  match: UpcomingMatch;
  scores: { home: string; away: string };
  prediction: Prediction | undefined;
  isSubmitting: boolean;
  onScoreChange: (home: string, away: string) => void;
  onSubmit: (value: string) => void;
}) {
  const canSubmit =
    scores.home !== "" &&
    scores.away !== "" &&
    !isNaN(Number(scores.home)) &&
    !isNaN(Number(scores.away));
  const currentValue = `${scores.home}-${scores.away}`;
  const isAlreadySubmitted = prediction?.predictionValue === currentValue;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 justify-center">
        <span className="text-xs text-cream/40">{match.homeTeam}</span>
        <input
          type="number"
          min={0}
          max={20}
          value={scores.home}
          onChange={(e) => onScoreChange(e.target.value, scores.away)}
          className="w-14 bg-dark border border-dark-border rounded px-2 py-1.5 text-center text-cream text-sm"
          placeholder="0"
        />
        <span className="text-cream/30">-</span>
        <input
          type="number"
          min={0}
          max={20}
          value={scores.away}
          onChange={(e) => onScoreChange(scores.home, e.target.value)}
          className="w-14 bg-dark border border-dark-border rounded px-2 py-1.5 text-center text-cream text-sm"
          placeholder="0"
        />
        <span className="text-xs text-cream/40">{match.awayTeam}</span>
      </div>
      <button
        onClick={() => canSubmit && onSubmit(currentValue)}
        disabled={!canSubmit || isSubmitting}
        className={`w-full py-2 rounded text-xs font-medium transition-all ${
          isAlreadySubmitted
            ? "bg-wc-gold/20 border-2 border-wc-gold text-wc-gold"
            : canSubmit
              ? "bg-dark border border-dark-border text-cream/60 hover:border-wc-gold hover:text-wc-gold"
              : "bg-dark border border-dark-border text-cream/20 cursor-not-allowed"
        } ${isSubmitting ? "opacity-50" : ""}`}
      >
        {isAlreadySubmitted ? (
          <span className="flex items-center justify-center gap-1">
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
            Saved: {prediction?.predictionValue}
          </span>
        ) : prediction ? (
          `Update (was ${prediction.predictionValue})`
        ) : (
          "Submit Score"
        )}
      </button>
    </div>
  );
}

function FirstScorerInput({
  scorer,
  prediction,
  isSubmitting,
  onScorerChange,
  onSubmit,
}: {
  scorer: string;
  prediction: Prediction | undefined;
  isSubmitting: boolean;
  onScorerChange: (value: string) => void;
  onSubmit: (value: string) => void;
}) {
  const canSubmit = scorer.trim().length > 0;
  const isAlreadySubmitted =
    prediction?.predictionValue.toLowerCase() === scorer.trim().toLowerCase() &&
    scorer.trim().length > 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={scorer}
          onChange={(e) => onScorerChange(e.target.value)}
          placeholder="Player name (e.g. Kane)"
          className="flex-1 bg-dark border border-dark-border rounded px-3 py-1.5 text-cream text-sm placeholder:text-cream/20"
        />
        <button
          onClick={() => canSubmit && onSubmit(scorer.trim())}
          disabled={!canSubmit || isSubmitting}
          className={`px-4 py-1.5 rounded text-xs font-medium transition-all ${
            isAlreadySubmitted
              ? "bg-wc-gold/20 border-2 border-wc-gold text-wc-gold"
              : canSubmit
                ? "bg-dark border border-dark-border text-cream/60 hover:border-wc-gold hover:text-wc-gold"
                : "bg-dark border border-dark-border text-cream/20 cursor-not-allowed"
          } ${isSubmitting ? "opacity-50" : ""}`}
        >
          {isAlreadySubmitted ? (
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
          ) : (
            "Save"
          )}
        </button>
      </div>
      {prediction && (
        <div className="text-xs text-cream/30">
          Current: <span className="text-cream/50">{prediction.predictionValue}</span>
        </div>
      )}
    </div>
  );
}
