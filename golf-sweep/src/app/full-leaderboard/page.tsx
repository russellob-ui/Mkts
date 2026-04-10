"use client";
import { useEffect, useState } from "react";

interface FullLeaderboardEntry {
  playerId: string;
  name: string;
  position: string | null;
  scoreToPar: number;
  thru: string | null;
  isOurPick: boolean;
  ourPlayerName?: string;
  ourPlayerColor?: string | null;
  country?: string | null;
  flagEmoji?: string | null;
}

function formatScore(s: number): string {
  if (s === 0) return "E";
  return s > 0 ? `+${s}` : String(s);
}

function scoreColor(s: number): string {
  if (s <= -3) return "text-red-500";
  if (s < 0) return "text-red-400";
  if (s === 0) return "text-gray-400";
  if (s <= 2) return "text-white";
  return "text-gray-500";
}

export default function FullLeaderboardPage() {
  const [entries, setEntries] = useState<FullLeaderboardEntry[]>([]);
  const [tournamentName, setTournamentName] = useState("");
  const [loading, setLoading] = useState(true);
  const [showOnlyOurs, setShowOnlyOurs] = useState(false);
  const [cachedAgo, setCachedAgo] = useState(0);

  async function fetchData() {
    const res = await fetch("/api/full-leaderboard");
    const json = await res.json();
    setEntries(json.players ?? []);
    setTournamentName(json.tournament ?? "");
    setCachedAgo(json.cachedAgo ?? 0);
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const filtered = showOnlyOurs ? entries.filter((e) => e.isOurPick) : entries;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="font-serif text-2xl font-bold">Full Leaderboard</h1>
          <div className="text-xs text-cream/40">
            {tournamentName} {cachedAgo > 0 && `· ${cachedAgo}s ago`}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={showOnlyOurs}
              onChange={(e) => setShowOnlyOurs(e.target.checked)}
              className="w-3 h-3"
            />
            Our picks only
          </label>
        </div>
      </div>

      {loading && (
        <div className="bg-dark-card border border-dark-border rounded-xl p-8 text-center text-cream/40">
          Loading...
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="bg-dark-card border border-dark-border rounded-xl p-8 text-center text-cream/40">
          No leaderboard data available.
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[auto_1fr_auto_auto] gap-2 px-3 py-2 text-[10px] text-cream/40 uppercase tracking-wider border-b border-dark-border">
            <span className="w-10">Pos</span>
            <span>Player</span>
            <span className="w-10 text-right">Score</span>
            <span className="w-10 text-right">Thru</span>
          </div>

          {/* Rows */}
          {filtered.map((entry, i) => (
            <div
              key={`${entry.playerId}-${i}`}
              className="grid grid-cols-[auto_1fr_auto_auto] gap-2 px-3 py-2 text-sm border-b border-dark-border/30 last:border-0"
              style={
                entry.isOurPick
                  ? {
                      borderLeft: `3px solid ${entry.ourPlayerColor ?? "#006747"}`,
                      backgroundColor: `${entry.ourPlayerColor ?? "#006747"}15`,
                    }
                  : { borderLeft: "3px solid transparent" }
              }
            >
              <span className="w-10 font-mono font-bold text-cream/80">
                {entry.position ?? "-"}
              </span>
              <div className="min-w-0">
                <div className="font-bold truncate">
                  {entry.flagEmoji ?? ""} {entry.name}
                </div>
                {entry.isOurPick && entry.ourPlayerName && (
                  <div className="text-[10px] text-cream/50">
                    {entry.ourPlayerName}&apos;s pick
                  </div>
                )}
              </div>
              <span className={`w-10 text-right font-mono font-bold ${scoreColor(entry.scoreToPar)}`}>
                {formatScore(entry.scoreToPar)}
              </span>
              <span className="w-10 text-right text-xs text-cream/50">
                {entry.thru ?? "-"}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="text-center text-[10px] text-cream/30 mt-3">
        Auto-refreshes every 30 seconds · Your 8 picks highlighted with their player colour
      </div>
    </div>
  );
}
