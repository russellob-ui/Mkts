"use client";
import { useEffect, useState } from "react";
import { formatScore } from "@/lib/banter";
import TournamentLogo from "@/components/TournamentLogo";

type PlayerStatus =
  | "not_started"
  | "playing"
  | "finished"
  | "cut"
  | "wd"
  | "dq"
  | "unknown";

interface RoundBreakdown {
  birdies: number;
  eagles: number;
  bogeys: number;
  doubles: number;
}

interface FullLeaderboardEntry {
  playerId: string;
  name: string;
  position: string | null;
  scoreToPar: number;
  thru: string | null;
  teeTime: string | null;
  status: PlayerStatus;
  currentRoundNumber: number | null;
  roundScores: Record<number, number | null>;
  roundBreakdown?: Record<number, RoundBreakdown>;
  isOurPick: boolean;
  ourPlayerName?: string;
  ourPlayerColor?: string | null;
  country?: string | null;
  flagEmoji?: string | null;
}

function scoreColor(s: number | null): string {
  if (s === null) return "text-cream/30";
  if (s <= -3) return "text-red-500";
  if (s < 0) return "text-red-400";
  if (s === 0) return "text-gray-400";
  if (s <= 2) return "text-white";
  return "text-gray-500";
}

/** Render small coloured dots for birdie/eagle/bogey counts — tablet+ only */
function BreakdownDots({ bd }: { bd: RoundBreakdown | undefined }) {
  if (!bd) return null;
  const dots: Array<{ color: string; key: string }> = [];
  for (let i = 0; i < bd.eagles; i++) dots.push({ color: "bg-yellow-500", key: `e${i}` });
  for (let i = 0; i < bd.birdies; i++) dots.push({ color: "bg-red-400", key: `b${i}` });
  for (let i = 0; i < bd.bogeys; i++) dots.push({ color: "bg-blue-400", key: `g${i}` });
  if (dots.length === 0) return null;
  return (
    <span className="hidden md:inline-flex gap-[2px] ml-0.5 items-center">
      {dots.map((d) => (
        <span key={d.key} className={`inline-block w-1 h-1 rounded-full ${d.color}`} />
      ))}
    </span>
  );
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
    const interval = setInterval(fetchData, 20000);
    return () => clearInterval(interval);
  }, []);

  const filtered = showOnlyOurs ? entries.filter((e) => e.isOurPick) : entries;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="font-serif text-2xl font-bold">Full Leaderboard</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <TournamentLogo tournamentName={tournamentName} size="sm" />
            {cachedAgo > 0 && (
              <span className="text-[10px] text-cream/40">
                · {cachedAgo}s ago
              </span>
            )}
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
          <div className="flex items-center gap-1 px-2 py-1.5 text-[9px] text-cream/40 uppercase tracking-wider border-b border-dark-border">
            <span className="w-8">Pos</span>
            <span className="flex-1 min-w-0">Player</span>
            <span className="w-8 text-right">Tot</span>
            <span className="w-7 text-right hidden sm:inline">R1</span>
            <span className="w-7 text-right hidden sm:inline">R2</span>
            <span className="w-7 text-right hidden sm:inline">R3</span>
            <span className="w-7 text-right hidden sm:inline">R4</span>
            <span className="w-14 text-right">Thru</span>
          </div>

          {/* Rows */}
          {filtered.map((entry, i) => (
            <div
              key={`${entry.playerId}-${i}`}
              className="flex items-center gap-1 px-2 py-2.5 text-xs border-b border-dark-border/30 last:border-0"
              style={
                entry.isOurPick
                  ? {
                      borderLeft: `3px solid ${entry.ourPlayerColor ?? "#006747"}`,
                      backgroundColor: `${entry.ourPlayerColor ?? "#006747"}15`,
                    }
                  : { borderLeft: "3px solid transparent" }
              }
            >
              <span className="w-8 font-mono font-bold text-cream/80 text-[10px]">
                {entry.position ?? "-"}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate text-[11px]">
                  {entry.flagEmoji ?? ""} {entry.name}
                </div>
                {entry.isOurPick && entry.ourPlayerName && (
                  <div className="text-[9px] text-cream/50 truncate">
                    {entry.ourPlayerName}&apos;s pick
                  </div>
                )}
              </div>
              <span className={`w-8 text-right font-mono font-bold text-xs ${scoreColor(entry.scoreToPar)}`}>
                {formatScore(entry.scoreToPar)}
              </span>
              <span className={`w-7 text-right font-mono text-[10px] hidden sm:inline ${scoreColor(entry.roundScores?.[1] ?? null)}`}>
                {entry.roundScores?.[1] != null ? formatScore(entry.roundScores[1]) : "-"}
                <BreakdownDots bd={entry.roundBreakdown?.[1]} />
              </span>
              <span className={`w-7 text-right font-mono text-[10px] hidden sm:inline ${scoreColor(entry.roundScores?.[2] ?? null)}`}>
                {entry.roundScores?.[2] != null ? formatScore(entry.roundScores[2]) : "-"}
                <BreakdownDots bd={entry.roundBreakdown?.[2]} />
              </span>
              <span className={`w-7 text-right font-mono text-[10px] hidden sm:inline ${scoreColor(entry.roundScores?.[3] ?? null)}`}>
                {entry.roundScores?.[3] != null ? formatScore(entry.roundScores[3]) : "-"}
                <BreakdownDots bd={entry.roundBreakdown?.[3]} />
              </span>
              <span className={`w-7 text-right font-mono text-[10px] hidden sm:inline ${scoreColor(entry.roundScores?.[4] ?? null)}`}>
                {entry.roundScores?.[4] != null ? formatScore(entry.roundScores[4]) : "-"}
                <BreakdownDots bd={entry.roundBreakdown?.[4]} />
              </span>
              {/* Thru column: tee time if not started, hole count / F / CUT otherwise */}
              {entry.status === "not_started" ? (
                <span className="w-14 text-right text-[10px] font-semibold text-augusta-light tabular-nums">
                  {entry.teeTime ?? "—"}
                </span>
              ) : entry.status === "cut" || entry.status === "wd" || entry.status === "dq" ? (
                <span className="w-14 text-right text-[10px] font-bold text-red-400/70 uppercase">
                  {entry.status}
                </span>
              ) : (
                <span className="w-14 text-right text-[10px] text-cream/60">
                  {entry.thru ?? "-"}
                </span>
              )}
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
