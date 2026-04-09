"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { timeAgo, getBanterLine } from "@/lib/banter";

interface LeaderboardEntry {
  player: { name: string; slug: string; color: string | null; rowColor: string | null; avatarEmoji: string | null };
  golfer: { name: string; country: string | null; flagEmoji: string | null };
  position: string | null;
  scoreToPar: number | null;
  thru: string | null;
  openingOdds: string | null;
  openingOddsDecimal: number | null;
  currentOdds: string | null;
  currentOddsDecimal: number | null;
  roundScores: Record<number, { scoreToPar: number | null; thru: string | null }>;
  points: number;
}

interface TournamentInfo {
  name: string;
  status: string;
  lastPolledAt: string | null;
  lastOddsPolledAt: string | null;
}

function formatScore(score: number | null): string {
  if (score === null || score === undefined) return "-";
  if (score === 0) return "E";
  if (score > 0) return `+${score}`;
  return String(score);
}

/** Spec-compliant score colors */
function scoreColorClass(score: number | null): string {
  if (score === null || score === undefined) return "text-cream/40";
  if (score <= -3) return "text-red-500"; // deep red for -3 or better
  if (score < 0) return "text-red-400"; // red for -1, -2
  if (score === 0) return "text-gray-400"; // grey for even
  if (score <= 2) return "text-white"; // white for +1, +2
  return "text-gray-500"; // dim grey for +3+
}

/** Odds movement arrow */
function oddsArrow(opening: number | null, current: number | null): string {
  if (!opening || !current) return "";
  if (current < opening - 0.5) return " ↓"; // shortened (better chance)
  if (current > opening + 0.5) return " ↑"; // drifted (worse chance)
  return "";
}

function oddsArrowColor(opening: number | null, current: number | null): string {
  if (!opening || !current) return "";
  if (current < opening - 0.5) return "text-red-400"; // shortened = good
  if (current > opening + 0.5) return "text-gray-500"; // drifted = bad
  return "text-cream/40";
}

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [tournament, setTournament] = useState<TournamentInfo | null>(null);
  const [lastPolled, setLastPolled] = useState<string | null>(null);
  const [lastOddsPolled, setLastOddsPolled] = useState<string | null>(null);
  const [banter, setBanter] = useState("");

  async function fetchData() {
    const res = await fetch("/api/leaderboard");
    const json = await res.json();
    setEntries(json.entries ?? []);
    setTournament(json.tournament);
    setLastPolled(json.lastPolled);
    setLastOddsPolled(json.lastOddsPolled);

    if (json.entries?.length > 0) {
      const leader = json.entries[0];
      const worst = json.entries[json.entries.length - 1];
      setBanter(getBanterLine(leader.golfer.name, worst.golfer.name));
    }
  }

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const isLive = tournament?.status === "live";
  const activeRounds = [1, 2, 3, 4].filter((r) =>
    entries.some((e) => e.roundScores?.[r]?.scoreToPar != null)
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {isLive && (
            <span className="live-dot inline-block w-3 h-3 rounded-full bg-augusta-light" />
          )}
          <h1 className="font-serif text-2xl md:text-3xl font-bold">
            {tournament?.name ?? "Leaderboard"}
          </h1>
        </div>
      </div>

      {/* Banter strip */}
      {banter && (
        <div className="bg-augusta/10 border border-augusta/20 rounded-lg px-4 py-2 mb-4 text-center text-sm italic text-cream/80">
          {banter}
        </div>
      )}

      {/* Leaderboard */}
      <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-1 px-3 py-2 text-[10px] text-cream/40 uppercase tracking-wider border-b border-dark-border">
          <span className="w-9">Pos</span>
          <span className="flex-1">Player / Golfer</span>
          <span className="w-10 text-right">Score</span>
          <span className="w-8 text-right">Thru</span>
          <span className="w-20 text-right">Odds</span>
          {activeRounds.map((r) => (
            <span key={r} className="w-8 text-right">R{r}</span>
          ))}
          <span className="w-8 text-right">Pts</span>
        </div>

        {entries.map((entry) => (
          <Link
            key={entry.player.slug}
            href={`/player/${entry.player.slug}`}
            className="flex items-center gap-1 px-3 py-3 border-b border-dark-border/40 last:border-0 hover:bg-dark-border/20 transition-colors"
            style={{
              borderLeft: `4px solid ${entry.player.color ?? "#006747"}`,
              backgroundColor: entry.player.rowColor
                ? undefined
                : `${entry.player.color ?? "#006747"}08`,
            }}
          >
            {/* Position */}
            <span className="text-sm font-mono font-bold text-cream/80 w-9">
              {entry.position ?? "-"}
            </span>

            {/* Player + Golfer */}
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm truncate">
                {entry.player.avatarEmoji} {entry.player.name}
              </div>
              <div className="text-xs text-cream/50 truncate">
                {entry.golfer.flagEmoji} {entry.golfer.name}
              </div>
            </div>

            {/* Score */}
            <span className={`w-10 text-right font-mono font-bold text-base ${scoreColorClass(entry.scoreToPar)}`}>
              {formatScore(entry.scoreToPar)}
            </span>

            {/* Thru */}
            <span className="w-8 text-right text-xs text-cream/60">
              {entry.thru ?? "-"}
            </span>

            {/* Odds: opening → current with arrow */}
            <span className="w-20 text-right text-xs">
              {entry.currentOdds ? (
                <>
                  <span className="text-cream/30">{entry.openingOdds}</span>
                  <span className="text-cream/20"> → </span>
                  <span className={oddsArrowColor(entry.openingOddsDecimal, entry.currentOddsDecimal)}>
                    {entry.currentOdds}
                    {oddsArrow(entry.openingOddsDecimal, entry.currentOddsDecimal)}
                  </span>
                </>
              ) : (
                <span className="text-cream/40">{entry.openingOdds ?? "-"}</span>
              )}
            </span>

            {/* Round scores */}
            {activeRounds.map((r) => (
              <span
                key={r}
                className={`w-8 text-right text-xs font-mono ${scoreColorClass(entry.roundScores?.[r]?.scoreToPar ?? null)}`}
              >
                {entry.roundScores?.[r]
                  ? formatScore(entry.roundScores[r].scoreToPar)
                  : "-"}
              </span>
            ))}

            {/* Points */}
            <span className="w-8 text-right font-bold text-gold text-xs">
              {entry.points > 0 ? entry.points : "-"}
            </span>
          </Link>
        ))}

        {entries.length === 0 && (
          <div className="px-4 py-8 text-center text-cream/40">
            Loading leaderboard...
          </div>
        )}
      </div>

      {/* Last updated */}
      <div className="mt-3 text-center text-xs text-cream/30">
        Scores updated {timeAgo(lastPolled)}
        {lastOddsPolled && <> · Odds updated {timeAgo(lastOddsPolled)}</>}
      </div>

      {/* Points guide */}
      <div className="mt-4 bg-dark-card border border-dark-border rounded-xl p-4">
        <h3 className="font-serif text-sm font-bold mb-2 text-cream/60">Points Guide</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-cream/40">
          <span>1st: 50pts</span>
          <span>2nd: 30pts</span>
          <span>3rd: 20pts</span>
          <span>T4-5: 15pts</span>
          <span>T6-10: 10pts</span>
          <span>T11-20: 6pts</span>
          <span>T21-30: 3pts</span>
          <span>Made cut: 1pt</span>
          <span>ROTD: +5pts</span>
          <span>Best of round: +2pts</span>
        </div>
      </div>
    </div>
  );
}
