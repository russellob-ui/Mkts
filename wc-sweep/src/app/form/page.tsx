"use client";

import { useEffect, useState } from "react";

interface DailyPoint {
  date: string;
  points: number;
}

interface FormEntry {
  playerId: number;
  playerName: string;
  color: string;
  trend: "hot" | "cold" | "steady";
  dailyPoints: DailyPoint[];
}

const TREND_BADGE: Record<string, { emoji: string; label: string; className: string }> = {
  hot: { emoji: "🔥", label: "Hot", className: "bg-red-500/20 text-red-400 border-red-500/30" },
  cold: { emoji: "❄️", label: "Cold", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  steady: { emoji: "➡️", label: "Steady", className: "bg-cream/10 text-cream/60 border-cream/20" },
};

export default function FormGuidePage() {
  const [data, setData] = useState<FormEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/form");
        if (res.ok) {
          const json = await res.json();
          setData(json.form);
        } else {
          setError(`API returned ${res.status}`);
        }
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="text-center py-12 text-cream/40">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="bg-dark-card border border-red-500 rounded-lg p-6 text-center text-red-400">
          Error: {error}
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="bg-dark-card border border-dark-border rounded-lg p-8 text-center text-cream/40">
          No form data yet &mdash; points need to be scored first
        </div>
      </div>
    );
  }

  // Find global max daily points for scaling the sparklines
  const allDailyPts = data.flatMap((d) => d.dailyPoints.map((dp) => dp.points));
  const maxDailyPts = Math.max(...allDailyPts, 1);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="font-serif text-3xl font-bold">
          <span className="text-wc-gold">Form</span> Guide
        </h1>
        <p className="text-cream/50 text-sm">
          Who&apos;s hot and who&apos;s not &mdash; last 10 match days
        </p>
      </div>

      <div className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
        <div className="divide-y divide-dark-border/50">
          {data.map((entry) => {
            const badge = TREND_BADGE[entry.trend];
            const totalRecent = entry.dailyPoints.reduce(
              (s, d) => s + d.points,
              0
            );

            return (
              <div
                key={entry.playerId}
                className="px-4 py-4 space-y-2"
              >
                {/* Top row: name, trend, total */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className="font-medium text-sm"
                      style={{ color: entry.color }}
                    >
                      {entry.playerName}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border ${badge.className}`}
                    >
                      {badge.emoji} {badge.label}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-cream/60">
                    {Math.round(totalRecent * 10) / 10} pts
                  </span>
                </div>

                {/* Sparkline bars */}
                <div className="flex items-end gap-1 h-8">
                  {entry.dailyPoints.map((dp, i) => {
                    const height =
                      dp.points > 0
                        ? Math.max((dp.points / maxDailyPts) * 100, 8)
                        : 0;
                    const isLast3 = i >= entry.dailyPoints.length - 3;

                    return (
                      <div
                        key={dp.date}
                        className="flex-1 flex flex-col items-center justify-end"
                        title={`${new Date(dp.date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}: ${dp.points} pts`}
                      >
                        <div
                          className="w-full rounded-sm transition-all duration-300"
                          style={{
                            height: `${height}%`,
                            backgroundColor: entry.color,
                            opacity: isLast3 ? 1 : 0.4,
                            minHeight: dp.points > 0 ? "3px" : "0px",
                          }}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Date labels */}
                <div className="flex gap-1">
                  {entry.dailyPoints.map((dp) => (
                    <div
                      key={dp.date}
                      className="flex-1 text-center text-[9px] text-cream/25 truncate"
                    >
                      {new Date(dp.date + "T00:00:00").toLocaleDateString(
                        undefined,
                        { day: "numeric" }
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 text-xs text-cream/40">
        <div className="flex items-center gap-1">
          <span>{TREND_BADGE.hot.emoji}</span>
          <span>Hot: above average last 3 days</span>
        </div>
        <div className="flex items-center gap-1">
          <span>{TREND_BADGE.cold.emoji}</span>
          <span>Cold: below average last 3 days</span>
        </div>
        <div className="flex items-center gap-1">
          <span>{TREND_BADGE.steady.emoji}</span>
          <span>Steady: on pace</span>
        </div>
      </div>
    </div>
  );
}
