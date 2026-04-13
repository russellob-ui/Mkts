"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { timeAgo, getBanterLine } from "@/lib/banter";
import ChatPanel from "@/components/ChatPanel";
import TournamentLogo from "@/components/TournamentLogo";

type PlayerStatus =
  | "not_started"
  | "playing"
  | "finished"
  | "cut"
  | "wd"
  | "dq"
  | "unknown";

interface LeaderboardEntry {
  player: { name: string; slug: string; color: string | null; rowColor: string | null; avatarEmoji: string | null };
  golfer: { name: string; country: string | null; flagEmoji: string | null };
  position: string | null;
  scoreToPar: number | null;
  todayScore: number | null;
  currentRound: number | null;
  thru: string | null;
  teeTime: string | null;
  status: PlayerStatus;
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

function scoreColorClass(score: number | null): string {
  if (score === null || score === undefined) return "text-cream/40";
  if (score <= -3) return "text-red-500";
  if (score < 0) return "text-red-400";
  if (score === 0) return "text-gray-400";
  if (score <= 2) return "text-white";
  return "text-gray-500";
}

function oddsArrow(opening: number | null, current: number | null): string {
  if (!opening || !current) return "";
  if (current < opening - 0.5) return " ↓";
  if (current > opening + 0.5) return " ↑";
  return "";
}

function oddsArrowColor(opening: number | null, current: number | null): string {
  if (!opening || !current) return "";
  if (current < opening - 0.5) return "text-red-400";
  if (current > opening + 0.5) return "text-gray-500";
  return "text-cream/40";
}

export default function HomePage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [tournament, setTournament] = useState<TournamentInfo | null>(null);
  const [lastPolled, setLastPolled] = useState<string | null>(null);
  const [lastOddsPolled, setLastOddsPolled] = useState<string | null>(null);
  const [banter, setBanter] = useState("");
  const [seeding, setSeeding] = useState(false);

  async function fetchData() {
    const res = await fetch("/api/leaderboard");
    const json = await res.json();

    // Auto-seed if empty on first load
    if (json.entries?.length === 0 && !json.tournament) {
      setSeeding(true);
      await fetch("/api/seed", { method: "POST" });
      const res2 = await fetch("/api/leaderboard");
      const json2 = await res2.json();
      setEntries(json2.entries ?? []);
      setTournament(json2.tournament);
      setLastPolled(json2.lastPolled);
      setLastOddsPolled(json2.lastOddsPolled);
      setSeeding(false);
    } else {
      setEntries(json.entries ?? []);
      setTournament(json.tournament);
      setLastPolled(json.lastPolled);
      setLastOddsPolled(json.lastOddsPolled);
    }

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
  const isFinished = tournament?.status === "finished";
  const winner = entries.find(
    (e) => (e.position ?? "").toUpperCase().replace(/^T/, "") === "1"
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-3">
      {/* Compact hero */}
      <div className="text-center py-3">
        <h1 className="font-serif text-xl md:text-3xl font-bold text-cream leading-tight">
          LONDON BANTER <span className="text-augusta-light">&amp; WOODY</span>
        </h1>
        <p className="text-xs text-gold font-serif italic">Major Sweep 2026</p>
      </div>

      {seeding && (
        <div className="text-center py-4 text-cream/60 text-sm">
          Setting up the sweep...
        </div>
      )}

      {/* Tournament header */}
      {tournament && (
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {isLive && (
              <span className="live-dot inline-block w-2.5 h-2.5 rounded-full bg-augusta-light" />
            )}
            <TournamentLogo tournamentName={tournament.name} size="md" />
            {isLive && (
              <span className="text-[10px] bg-augusta/20 text-augusta-light px-2 py-0.5 rounded-full uppercase tracking-wider">
                Live
              </span>
            )}
            {isFinished && (
              <span className="text-[10px] bg-gold/20 text-gold px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">
                Final
              </span>
            )}
          </div>
        </div>
      )}

      {/* Winner banner — only shown when tournament is finished */}
      {isFinished && winner && (
        <div
          className="relative rounded-xl px-4 py-3 mb-3 overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${winner.player.color ?? "#d4af37"}22 0%, #d4af3722 100%)`,
            border: `1px solid ${winner.player.color ?? "#d4af37"}55`,
          }}
        >
          <div className="flex items-center gap-3">
            <div className="text-2xl">🏆</div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-widest text-gold/80 font-bold">
                Champion
              </div>
              <div className="font-serif text-base md:text-lg font-bold leading-tight">
                {winner.player.name}
                <span className="text-cream/40 font-normal text-xs">
                  {" · "}
                </span>
                <span className="text-cream/90">
                  {winner.golfer.flagEmoji} {winner.golfer.name}
                </span>
              </div>
              <div className="text-[11px] text-cream/60 font-mono mt-0.5">
                {formatScore(winner.scoreToPar)} · {tournament?.name}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Banter strip */}
      {banter && !isFinished && (
        <div className="bg-augusta/10 border border-augusta/20 rounded-lg px-3 py-1.5 mb-3 text-center text-xs italic text-cream/80">
          {banter}
        </div>
      )}

      {/* Leaderboard */}
      <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-1 px-3 py-1.5 text-[10px] text-cream/40 uppercase tracking-wider border-b border-dark-border">
          <span className="w-8">Pos</span>
          <span className="flex-1">Player / Golfer</span>
          <span className="w-10 text-right">Tot</span>
          <span className="w-10 text-right">Rd</span>
          <span className="w-16 text-right">Thru</span>
          <span className="w-12 text-right">Odds</span>
          <span className="w-7 text-right">Pts</span>
        </div>

        {entries.map((entry) => {
          const isWinner =
            isFinished &&
            (entry.position ?? "").toUpperCase().replace(/^T/, "") === "1";
          return (
          <Link
            key={entry.player.slug}
            href={`/player/${entry.player.slug}`}
            className="flex items-center gap-1 px-3 py-2 border-b border-dark-border/40 last:border-0 hover:bg-dark-border/20 transition-colors"
            style={
              isWinner
                ? {
                    borderLeft: `4px solid #d4af37`,
                    background: `linear-gradient(90deg, rgba(212,175,55,0.18) 0%, ${entry.player.color ?? "#006747"}12 100%)`,
                  }
                : {
                    borderLeft: `4px solid ${entry.player.color ?? "#006747"}`,
                    backgroundColor: `${entry.player.color ?? "#006747"}08`,
                  }
            }
          >
            <span className={`text-xs font-mono font-bold w-8 ${isWinner ? "text-gold" : "text-cream/80"}`}>
              {isWinner ? "🏆" : entry.position ?? "-"}
            </span>

            <div className="flex-1 min-w-0">
              <div className={`font-bold text-xs truncate ${isWinner ? "text-gold" : ""}`}>
                {entry.player.name}
              </div>
              <div className="text-[10px] text-cream/50 truncate">
                {entry.golfer.flagEmoji} {entry.golfer.name}
              </div>
            </div>

            {/* Total (tournament to par) */}
            <span className={`w-10 text-right font-mono font-bold text-sm ${scoreColorClass(entry.scoreToPar)}`}>
              {formatScore(entry.scoreToPar)}
            </span>

            {/* Rd / Thru — state-driven display:
                - not_started: dash in Rd, bold tee time in Thru
                - playing:     round score in Rd, hole count in Thru
                - finished:    round score in Rd, "F" in Thru
                - cut/wd/dq:   dash in Rd, status label in Thru (dimmed) */}
            {entry.status === "not_started" ? (
              <>
                <span className="w-10 text-right font-mono text-xs text-cream/30">
                  —
                </span>
                <span className="w-16 text-right text-[10px] font-semibold text-augusta-light tabular-nums">
                  {entry.teeTime ?? "—"}
                </span>
              </>
            ) : entry.status === "cut" || entry.status === "wd" || entry.status === "dq" ? (
              <>
                <span className="w-10 text-right font-mono text-xs text-cream/30">
                  —
                </span>
                <span className="w-16 text-right text-[10px] font-bold text-red-400/80 uppercase tracking-wider">
                  {entry.status}
                </span>
              </>
            ) : (
              <>
                <span className={`w-10 text-right font-mono text-xs ${scoreColorClass(entry.todayScore)}`}>
                  {entry.todayScore != null ? formatScore(entry.todayScore) : "-"}
                </span>
                <span className="w-16 text-right text-[10px] text-cream/60">
                  {entry.thru ?? "-"}
                </span>
              </>
            )}

            {/* Odds */}
            <span className="w-12 text-right text-[10px]">
              {entry.currentOdds ? (
                <span className={oddsArrowColor(entry.openingOddsDecimal, entry.currentOddsDecimal)}>
                  {entry.currentOdds}
                  {oddsArrow(entry.openingOddsDecimal, entry.currentOddsDecimal)}
                </span>
              ) : (
                <span className="text-cream/40">{entry.openingOdds ?? "-"}</span>
              )}
            </span>

            {/* Points */}
            <span className={`w-7 text-right font-bold text-[10px] ${isWinner ? "text-gold text-xs" : "text-gold"}`}>
              {entry.points > 0 ? entry.points : "-"}
            </span>
          </Link>
          );
        })}

        {entries.length === 0 && !seeding && (
          <div className="px-4 py-8 text-center text-cream/40">
            Loading leaderboard...
          </div>
        )}
      </div>

      {/* Last updated */}
      <div className="mt-2 text-center text-[10px] text-cream/30">
        Scores updated {timeAgo(lastPolled)}
        {lastOddsPolled && <> · Odds updated {timeAgo(lastOddsPolled)}</>}
      </div>

      {/* Chat panel */}
      <div className="mt-4 h-[50dvh]">
        <ChatPanel />
      </div>
    </div>
  );
}
