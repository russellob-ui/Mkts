"use client";
import { useEffect, useState } from "react";

interface LeaderboardEntry {
  player: { name: string; slug: string; color: string | null };
  golfer: { name: string; flagEmoji: string | null };
  position: string | null;
  scoreToPar: number | null;
  thru: string | null;
  points: number;
}

function formatScore(s: number | null): string {
  if (s === null) return "-";
  if (s === 0) return "E";
  return s > 0 ? `+${s}` : String(s);
}

function scoreColor(s: number | null): string {
  if (s === null) return "text-cream/40";
  if (s <= -3) return "text-red-500";
  if (s < 0) return "text-red-400";
  if (s === 0) return "text-gray-400";
  if (s <= 2) return "text-white";
  return "text-gray-500";
}

/**
 * Compact leaderboard strip — shows all 8 picks in a condensed row
 * format, suitable for embedding at the top of chat or other pages.
 */
export default function LeaderboardStrip() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [tournamentName, setTournamentName] = useState<string>("");

  async function fetchData() {
    const res = await fetch("/api/leaderboard");
    const json = await res.json();
    setEntries(json.entries ?? []);
    setTournamentName(json.tournament?.name ?? "");
  }

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (entries.length === 0) {
    return (
      <div className="bg-dark-card border border-dark-border rounded-xl p-3 text-center text-cream/40 text-xs">
        Loading leaderboard...
      </div>
    );
  }

  return (
    <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
      <div className="px-3 py-2 border-b border-dark-border flex items-center justify-between">
        <span className="text-xs font-bold text-cream/60 uppercase tracking-wider">
          {tournamentName || "Leaderboard"}
        </span>
        <span className="live-dot inline-block w-2 h-2 rounded-full bg-augusta-light" />
      </div>
      <div className="divide-y divide-dark-border/30">
        {entries.map((entry, i) => (
          <div
            key={entry.player.slug}
            className="flex items-center gap-2 px-3 py-1.5"
            style={{
              borderLeft: `3px solid ${entry.player.color ?? "#006747"}`,
            }}
          >
            <span className="text-[10px] font-mono font-bold text-cream/50 w-6">
              {entry.position ?? String(i + 1)}
            </span>
            <div className="flex-1 min-w-0">
              <span className="font-bold text-xs">{entry.player.name}</span>
              <span className="text-cream/50 text-[10px] ml-1">
                {entry.golfer.flagEmoji} {entry.golfer.name}
              </span>
            </div>
            <span
              className={`font-mono font-bold text-sm ${scoreColor(entry.scoreToPar)}`}
            >
              {formatScore(entry.scoreToPar)}
            </span>
            {entry.thru && (
              <span className="text-[10px] text-cream/40 w-6 text-right">
                {entry.thru}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
