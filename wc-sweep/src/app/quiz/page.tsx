"use client";

import { useState, useEffect, useRef } from "react";

interface QuizQuestion {
  index: number;
  question: string;
  options: string[];
  correctIndex?: number;
}

interface LeaderboardEntry {
  playerId: number;
  playerName: string;
  color: string | null;
  score: number;
}

interface PlayerOption {
  id: number;
  name: string;
  slug: string;
  color: string | null;
}

interface ScoredAnswer {
  questionIndex: number;
  answer: number;
  correct: boolean;
  correctIndex: number;
}

const LS_PLAYER_ID = "wc_sweep_player_id";
const LS_PASSCODE = "wc_sweep_passcode";

export default function QuizPage() {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [players, setPlayers] = useState<PlayerOption[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [passcode, setPasscode] = useState("");
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Result state
  const [submitted, setSubmitted] = useState(false);
  const [scoredAnswers, setScoredAnswers] = useState<ScoredAnswer[]>([]);
  const [score, setScore] = useState(0);

  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    try {
      const savedId = localStorage.getItem(LS_PLAYER_ID);
      const savedPass = localStorage.getItem(LS_PASSCODE);
      if (savedId) setSelectedPlayerId(Number(savedId));
      if (savedPass) setPasscode(savedPass);
    } catch {
      // localStorage unavailable
    }
  }, []);

  useEffect(() => {
    try {
      if (selectedPlayerId !== null) localStorage.setItem(LS_PLAYER_ID, String(selectedPlayerId));
      if (passcode) localStorage.setItem(LS_PASSCODE, passcode);
    } catch {
      // localStorage unavailable
    }
  }, [selectedPlayerId, passcode]);

  useEffect(() => {
    async function load() {
      try {
        const url = selectedPlayerId
          ? `/api/quiz?playerId=${selectedPlayerId}`
          : "/api/quiz";
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setQuestions(data.questions ?? []);
          setPlayers(data.players ?? []);
          setLeaderboard(data.leaderboard ?? []);

          // If already submitted
          if (data.existingResult) {
            setSubmitted(true);
            setScore(data.existingResult.score);
            setScoredAnswers(data.existingResult.answers ?? []);
            // Populate answers from existing result
            const existingAnswers: Record<number, number> = {};
            for (const a of data.existingResult.answers ?? []) {
              existingAnswers[a.questionIndex] = a.answer;
            }
            setAnswers(existingAnswers);
          } else {
            setSubmitted(false);
            setScoredAnswers([]);
          }
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [selectedPlayerId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPlayerId || !passcode) return;

    // Check all answered
    if (Object.keys(answers).length < 5) {
      setError("Please answer all 5 questions");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: selectedPlayerId,
          passcode,
          answers: Object.entries(answers).map(([qi, a]) => ({
            questionIndex: Number(qi),
            answer: a,
          })),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSubmitted(true);
        setScore(data.result.score);
        setScoredAnswers(data.result.answers);
        // Reload leaderboard
        const lb = await fetch(
          `/api/quiz?playerId=${selectedPlayerId}`
        );
        if (lb.ok) {
          const lbData = await lb.json();
          setLeaderboard(lbData.leaderboard ?? []);
          setQuestions(lbData.questions ?? []);
        }
      } else {
        setError(data.error ?? "Failed to submit");
      }
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  function getScoredAnswer(qi: number): ScoredAnswer | undefined {
    return scoredAnswers.find((a) => a.questionIndex === qi);
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center text-cream/40">
        Loading quiz...
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="font-serif text-3xl font-bold">
          <span className="text-wc-gold">Daily</span>{" "}
          <span className="text-cream">World Cup Quiz</span>
        </h1>
        <p className="text-cream/50 text-sm">
          5 questions a day &middot; Test your knowledge &middot; New questions daily
        </p>
      </div>

      {/* Player selector */}
      <div className="bg-dark-card border border-dark-border rounded-lg p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="block text-xs text-cream/40 mb-1">Player</label>
            <select
              value={selectedPlayerId ?? ""}
              onChange={(e) => {
                setSelectedPlayerId(e.target.value ? Number(e.target.value) : null);
                setAnswers({});
                setSubmitted(false);
                setScoredAnswers([]);
              }}
              className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-cream text-sm"
            >
              <option value="">Select player...</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs text-cream/40 mb-1">Passcode</label>
            <input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Enter your passcode"
              className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-cream text-sm placeholder:text-cream/20"
            />
          </div>
        </div>
      </div>

      {/* Already submitted banner */}
      {submitted && (
        <div className="bg-wc-green/20 border border-wc-green/40 rounded-lg p-4 text-center space-y-2">
          <div className="text-2xl font-bold text-wc-gold">
            {score}/5
          </div>
          <p className="text-cream/70 text-sm">
            {score === 5
              ? "Perfect score! You absolute legend!"
              : score >= 3
                ? "Solid effort! Not bad at all."
                : score >= 1
                  ? "Room for improvement..."
                  : "Ouch. Maybe stick to watching the games."}
          </p>
          <p className="text-cream/40 text-xs">Come back tomorrow for new questions!</p>
        </div>
      )}

      {error && (
        <div className="bg-wc-red/20 border border-wc-red/40 rounded-lg p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Questions */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {questions.map((q, qi) => {
          const scored = getScoredAnswer(q.index);
          return (
            <div
              key={q.index}
              className={`bg-dark-card border rounded-lg p-4 space-y-3 ${
                submitted && scored
                  ? scored.correct
                    ? "border-green-600/50"
                    : "border-red-600/50"
                  : "border-dark-border"
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="bg-wc-gold/20 text-wc-gold font-bold text-sm w-7 h-7 flex items-center justify-center rounded-full shrink-0">
                  {qi + 1}
                </span>
                <p className="text-cream font-medium text-sm leading-relaxed">
                  {q.question}
                </p>
              </div>

              <div className="space-y-2 pl-10">
                {q.options.map((opt, oi) => {
                  const isSelected = answers[q.index] === oi;
                  const isCorrect = submitted && q.correctIndex === oi;
                  const isWrong = submitted && isSelected && !isCorrect;

                  return (
                    <label
                      key={oi}
                      className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all text-sm ${
                        isCorrect
                          ? "bg-green-900/30 border border-green-600/50 text-green-300"
                          : isWrong
                            ? "bg-red-900/30 border border-red-600/50 text-red-300"
                            : isSelected
                              ? "bg-wc-gold/10 border border-wc-gold/40 text-cream"
                              : "bg-dark border border-dark-border text-cream/70 hover:border-cream/30"
                      } ${submitted ? "pointer-events-none" : ""}`}
                    >
                      <input
                        type="radio"
                        name={`q-${q.index}`}
                        value={oi}
                        checked={isSelected}
                        onChange={() => {
                          if (!submitted) {
                            setAnswers((prev) => ({ ...prev, [q.index]: oi }));
                          }
                        }}
                        disabled={submitted}
                        className="accent-wc-gold"
                      />
                      <span>{opt}</span>
                      {isCorrect && (
                        <svg className="w-4 h-4 ml-auto text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      {isWrong && (
                        <svg className="w-4 h-4 ml-auto text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}

        {!submitted && selectedPlayerId && (
          <button
            type="submit"
            disabled={submitting || Object.keys(answers).length < 5}
            className="w-full bg-wc-gold text-dark font-bold py-3 rounded-lg hover:bg-wc-gold/90 disabled:opacity-40 transition-colors cursor-pointer text-sm"
          >
            {submitting ? "Submitting..." : "Submit Answers"}
          </button>
        )}
      </form>

      {/* Leaderboard */}
      {leaderboard.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-serif text-xl font-bold text-wc-gold border-b border-dark-border pb-2">
            Today&apos;s Leaderboard
          </h2>
          <div className="space-y-1">
            {leaderboard.map((entry, i) => (
              <div
                key={entry.playerId}
                className="flex items-center justify-between bg-dark-card border border-dark-border rounded-lg px-4 py-2.5"
              >
                <div className="flex items-center gap-3">
                  <span className="text-cream/30 font-mono text-sm w-5">
                    {i + 1}.
                  </span>
                  <span
                    className="font-semibold text-sm"
                    style={{ color: entry.color ?? "#d4a843" }}
                  >
                    {entry.playerName}
                  </span>
                </div>
                <span className="text-wc-gold font-bold text-sm">
                  {entry.score}/5
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
