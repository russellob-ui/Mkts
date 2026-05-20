"use client";

import { useEffect, useState, useCallback } from "react";

interface StreakInfo {
  playerId: number;
  playerName: string;
  avatarEmoji: string | null;
  color: string | null;
  currentStreak: number;
  bestStreak: number;
  lastResult: "correct" | "incorrect" | null;
  streakBonus: boolean;
}

function getStreakEmoji(streak: number): string {
  if (streak >= 5) return "🔥🔥"; // double fire
  if (streak >= 3) return "🔥"; // single fire
  return "";
}

export default function StreaksPage() {
  const [streaks, setStreaks] = useState<StreakInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/streaks");
      if (res.ok) {
        const data = await res.json();
        setStreaks(data.streaks ?? []);
      }
    } catch {
      // API not ready
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30_000);
    return () => clearInterval(interval);
  }, [loadData]);

  const maxStreak = Math.max(...streaks.map((s) => s.currentStreak), 1);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="font-serif text-3xl font-bold">
          <span className="text-wc-gold">Prediction</span> Streaks
        </h1>
        <p className="text-cream/50 text-sm">
          Consecutive correct match result predictions &middot; 5+ streak = +3
          bonus
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-cream/40">Loading...</div>
      ) : streaks.length === 0 ? (
        <div className="bg-dark-card border border-dark-border rounded-lg p-8 text-center">
          <div className="text-4xl mb-3">&#x26BD;</div>
          <p className="text-cream/50">
            No predictions resolved yet.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {streaks.map((s, idx) => {
            const barWidth =
              maxStreak > 0
                ? Math.max(8, (s.currentStreak / maxStreak) * 100)
                : 8;
            const rank = idx + 1;

            return (
              <div
                key={s.playerId}
                className={`bg-dark-card border rounded-lg p-4 space-y-2 ${
                  s.streakBonus
                    ? "border-wc-gold/50 shadow-[0_0_12px_rgba(212,168,67,0.15)]"
                    : "border-dark-border"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-sm font-bold w-6 text-center ${
                        rank === 1
                          ? "text-wc-gold"
                          : rank === 2
                            ? "text-gray-300"
                            : rank === 3
                              ? "text-amber-700"
                              : "text-cream/30"
                      }`}
                    >
                      {rank}
                    </span>
                    <div className="flex items-center gap-2">
                      {s.avatarEmoji && (
                        <span className="text-lg">{s.avatarEmoji}</span>
                      )}
                      <span className="font-medium">{s.playerName}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {s.lastResult === "correct" && s.currentStreak > 0 ? (
                      <span className="text-green-400 text-xs font-medium">
                        Active
                      </span>
                    ) : s.lastResult === "incorrect" ? (
                      <span className="text-red-400 text-xs">&#x274C;</span>
                    ) : null}

                    {s.streakBonus && (
                      <span className="text-xs font-medium text-wc-gold bg-wc-gold/10 px-2 py-0.5 rounded-full">
                        +3 bonus
                      </span>
                    )}
                  </div>
                </div>

                {/* Streak bar */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-6 bg-dark rounded-full overflow-hidden relative">
                    <div
                      className={`h-full rounded-full transition-all duration-500 flex items-center justify-end pr-2 ${
                        s.currentStreak >= 5
                          ? "bg-gradient-to-r from-wc-gold/60 to-wc-gold"
                          : s.currentStreak >= 3
                            ? "bg-gradient-to-r from-orange-600/60 to-orange-500"
                            : s.currentStreak > 0
                              ? "bg-gradient-to-r from-wc-green/60 to-wc-green"
                              : "bg-dark-border"
                      }`}
                      style={{
                        width:
                          s.currentStreak > 0 ? `${barWidth}%` : "0%",
                      }}
                    >
                      {s.currentStreak > 0 && (
                        <span className="text-xs font-bold text-white drop-shadow">
                          {s.currentStreak}
                        </span>
                      )}
                    </div>
                    {s.currentStreak === 0 && (
                      <span className="absolute inset-0 flex items-center justify-center text-xs text-cream/30">
                        0
                      </span>
                    )}
                  </div>
                  <span className="text-lg shrink-0">
                    {getStreakEmoji(s.currentStreak)}
                  </span>
                </div>

                {/* Best ever */}
                <div className="flex items-center justify-between text-xs text-cream/40">
                  <span>
                    Best Ever:{" "}
                    <span className="text-cream/60 font-medium">
                      {s.bestStreak}
                    </span>
                  </span>
                  <span>
                    Current:{" "}
                    <span
                      className={`font-medium ${
                        s.currentStreak >= 3
                          ? "text-wc-gold"
                          : "text-cream/60"
                      }`}
                    >
                      {s.currentStreak}
                    </span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="bg-dark-card border border-dark-border rounded-lg p-4 space-y-2">
        <h3 className="text-xs font-semibold text-cream/40 uppercase tracking-wider">
          How Streaks Work
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-cream/50">
          <div className="flex items-center gap-2">
            <span>&#x1F525;</span>
            <span>3+ consecutive correct predictions</span>
          </div>
          <div className="flex items-center gap-2">
            <span>&#x1F525;&#x1F525;</span>
            <span>5+ streak = +3 bonus points</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-400">Active</span>
            <span>Streak is still going</span>
          </div>
          <div className="flex items-center gap-2">
            <span>&#x274C;</span>
            <span>Last prediction was wrong</span>
          </div>
        </div>
      </div>
    </div>
  );
}
