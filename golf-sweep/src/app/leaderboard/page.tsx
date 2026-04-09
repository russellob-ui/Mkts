"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  formatScore,
  scoreClass,
  timeAgo,
  getBanterLine,
} from "@/lib/banter";

interface LeaderboardEntry {
  player: { name: string; slug: string; color: string | null; avatarEmoji: string | null };
  golfer: { name: string; country: string | null; flagEmoji: string | null };
  position: string | null;
  scoreToPar: number | null;
  thru: string | null;
  openingOdds: string | null;
  roundScores: Record<number, { scoreToPar: number | null; thru: string | null }>;
  points: number;
}

interface TournamentInfo {
  name: string;
  status: string;
  lastPolledAt: string | null;
}

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [tournament, setTournament] = useState<TournamentInfo | null>(null);
  const [lastPolled, setLastPolled] = useState<string | null>(null);
  const [banter, setBanter] = useState("");

  async function fetchData() {
    const res = await fetch("/api/leaderboard");
    const json = await res.json();
    setEntries(json.entries ?? []);
    setTournament(json.tournament);
    setLastPolled(json.lastPolled);

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

  // Determine which rounds have any data
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
        <div className="text-xs text-cream/40">
          Updated {timeAgo(lastPolled)}
        </div>
      </div>

      {/* Banter strip */}
      {banter && (
        <div className="bg-augusta/10 border border-augusta/20 rounded-lg px-4 py-2 mb-4 text-center text-sm italic text-cream/80">
          {banter}
        </div>
      )}

      {/* Leaderboard table */}
      <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
        {/* Header row */}
        <div className="flex items-center gap-1 px-3 py-2 text-[10px] text-cream/40 uppercase tracking-wider border-b border-dark-border">
          <span className="w-9">Pos</span>
          <span className="flex-1">Player / Golfer</span>
          <span className="w-10 text-right">Score</span>
          <span className="w-8 text-right">Thru</span>
          <span className="w-10 text-right">Odds</span>
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
            }}
          >
            {/* Position */}
            <span className="text-sm font-mono font-bold text-cream/80 w-9">
              {entry.position ?? "-"}
            </span>

            {/* Player + Golfer */}
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm truncate">
                {entry.player.name}
              </div>
              <div className="text-xs text-cream/50 truncate">
                {entry.golfer.flagEmoji} {entry.golfer.name}
              </div>
            </div>

            {/* Score */}
            <span
              className={`w-10 text-right font-mono font-bold text-base ${scoreClass(entry.scoreToPar)}`}
            >
              {formatScore(entry.scoreToPar)}
            </span>

            {/* Thru */}
            <span className="w-8 text-right text-xs text-cream/60">
              {entry.thru ?? "-"}
            </span>

            {/* Odds */}
            <span className="w-10 text-right text-xs text-cream/40">
              {entry.openingOdds ?? "-"}
            </span>

            {/* Round scores */}
            {activeRounds.map((r) => (
              <span
                key={r}
                className={`w-8 text-right text-xs font-mono ${scoreClass(entry.roundScores?.[r]?.scoreToPar ?? null)}`}
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

      {/* Scoring guide */}
      <div className="mt-6 bg-dark-card border border-dark-border rounded-xl p-4">
        <h3 className="font-serif text-sm font-bold mb-2 text-cream/60">
          Points Guide
        </h3>
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
