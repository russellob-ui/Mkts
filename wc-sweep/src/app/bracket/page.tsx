"use client";

import { useEffect, useState } from "react";

interface TeamInfo {
  name: string;
  flag: string;
  ownerName: string | null;
  ownerColor: string | null;
}

interface BracketMatch {
  id: number;
  homeTeam: TeamInfo;
  awayTeam: TeamInfo;
  homeScore: number | null;
  awayScore: number | null;
  homePenalties: number | null;
  awayPenalties: number | null;
  status: string;
  minute: number | null;
  kickoff: string;
  winnerTeamId: number | null;
  stage: string;
  stageLabel: string;
  venue: string | null;
  city: string | null;
}

type Rounds = Record<string, BracketMatch[]>;

const STAGE_ORDER = ["R32", "R16", "QF", "SF", "3P", "F"];
const STAGE_LABELS: Record<string, string> = {
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarter-finals",
  SF: "Semi-finals",
  "3P": "Third Place",
  F: "Final",
};

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

function MatchCard({ match }: { match: BracketMatch }) {
  const isLive = match.status === "live";
  const isFinished = match.status === "finished";
  const hasScore = match.homeScore !== null && match.awayScore !== null;

  // Determine winner side for bold/gold styling
  let homeWon = false;
  let awayWon = false;
  if (isFinished && hasScore) {
    if (match.homeScore! > match.awayScore!) {
      homeWon = true;
    } else if (match.awayScore! > match.homeScore!) {
      awayWon = true;
    } else if (
      match.homePenalties !== null &&
      match.awayPenalties !== null
    ) {
      // Pens decided it
      if (match.homePenalties > match.awayPenalties) homeWon = true;
      else if (match.awayPenalties > match.homePenalties) awayWon = true;
    }
  }

  return (
    <div className="bg-dark-card border border-dark-border rounded-lg p-3 space-y-2">
      {/* Status bar */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-cream/40">
          {match.venue && match.city
            ? `${match.venue}, ${match.city}`
            : formatKickoff(match.kickoff)}
        </span>
        {isLive && (
          <span className="flex items-center gap-1.5 text-wc-red font-semibold">
            <span className="inline-block w-2 h-2 rounded-full bg-red-500 live-dot" />
            {match.minute ? `${match.minute}'` : "LIVE"}
          </span>
        )}
        {isFinished && (
          <span className="text-cream/40 font-medium">FT</span>
        )}
        {!isLive && !isFinished && (
          <span className="text-cream/30">{formatKickoff(match.kickoff)}</span>
        )}
      </div>

      {/* Teams + score */}
      <div className="space-y-1.5">
        {/* Home */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-lg shrink-0">{match.homeTeam.flag}</span>
            <div className="min-w-0">
              <span
                className={`block font-medium truncate ${
                  homeWon ? "text-wc-gold font-bold" : ""
                }`}
              >
                {match.homeTeam.name}
              </span>
              {match.homeTeam.ownerName && (
                <span
                  className="block text-xs truncate opacity-60"
                  style={{
                    color: match.homeTeam.ownerColor ?? undefined,
                  }}
                >
                  {match.homeTeam.ownerName}
                </span>
              )}
            </div>
          </div>
          <div className="text-right shrink-0 ml-2">
            {hasScore ? (
              <span
                className={`text-lg font-bold tabular-nums ${
                  homeWon ? "text-wc-gold" : ""
                }`}
              >
                {match.homeScore}
              </span>
            ) : (
              <span className="text-cream/30 text-lg">&ndash;</span>
            )}
          </div>
        </div>

        {/* Away */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-lg shrink-0">{match.awayTeam.flag}</span>
            <div className="min-w-0">
              <span
                className={`block font-medium truncate ${
                  awayWon ? "text-wc-gold font-bold" : ""
                }`}
              >
                {match.awayTeam.name}
              </span>
              {match.awayTeam.ownerName && (
                <span
                  className="block text-xs truncate opacity-60"
                  style={{
                    color: match.awayTeam.ownerColor ?? undefined,
                  }}
                >
                  {match.awayTeam.ownerName}
                </span>
              )}
            </div>
          </div>
          <div className="text-right shrink-0 ml-2">
            {hasScore ? (
              <span
                className={`text-lg font-bold tabular-nums ${
                  awayWon ? "text-wc-gold" : ""
                }`}
              >
                {match.awayScore}
              </span>
            ) : (
              <span className="text-cream/30 text-lg">&ndash;</span>
            )}
          </div>
        </div>
      </div>

      {/* Penalties */}
      {match.homePenalties !== null && match.awayPenalties !== null && (
        <div className="text-center text-xs text-cream/40">
          Pens: {match.homePenalties} &ndash; {match.awayPenalties}
        </div>
      )}

      {/* Scheduled — show "vs" */}
      {!hasScore && !isLive && (
        <div className="text-center text-cream/30 text-sm font-medium">
          vs
        </div>
      )}
    </div>
  );
}

export default function BracketPage() {
  const [rounds, setRounds] = useState<Rounds>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/bracket");
        if (res.ok) {
          const data = await res.json();
          setRounds(data.rounds ?? {});
        }
      } catch {
        // API not ready
      } finally {
        setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="font-serif text-3xl font-bold">
          <span className="text-wc-gold">Knockout</span> Bracket
        </h1>
        <p className="text-cream/50 text-sm">
          FIFA World Cup 2026 &middot; Road to the Final
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-cream/40">Loading...</div>
      ) : (
        STAGE_ORDER.map((stage) => {
          const stageMatches = rounds[stage] ?? [];
          if (stageMatches.length === 0) return null;

          return (
            <section key={stage} className="space-y-3">
              <h2 className="font-serif text-xl font-bold text-wc-gold border-b border-dark-border pb-2">
                {STAGE_LABELS[stage] ?? stage}
              </h2>
              <div className="grid grid-cols-1 gap-3">
                {stageMatches.map((match) => (
                  <MatchCard key={match.id} match={match} />
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
