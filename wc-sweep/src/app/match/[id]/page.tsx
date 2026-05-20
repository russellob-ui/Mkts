"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface TeamInfo {
  id: number;
  name: string;
  flagEmoji: string;
  fifaCode: string;
  tier: number;
  tierLabel: string;
  ownerName: string | null;
  ownerColor: string | null;
}

interface MatchInfo {
  id: number;
  homeScore: number | null;
  awayScore: number | null;
  homePenalties: number | null;
  awayPenalties: number | null;
  status: string;
  minute: number | null;
  kickoff: string;
  venue: string | null;
  city: string | null;
  stage: string;
  groupLetter: string | null;
}

interface MatchEvent {
  id: number;
  teamId: number;
  teamName: string;
  teamFlag: string;
  eventType: string;
  playerName: string | null;
  assistPlayerName: string | null;
  minute: number | null;
  detail: string | null;
}

interface PointEntry {
  source: string;
  points: number;
  note: string | null;
  playerName: string;
}

interface MatchData {
  match: MatchInfo;
  homeTeam: TeamInfo;
  awayTeam: TeamInfo;
  events: MatchEvent[];
  homePoints: PointEntry[];
  awayPoints: PointEntry[];
}

const EVENT_ICONS: Record<string, string> = {
  Goal: "⚽",
  goal: "⚽",
  "Yellow Card": "🟨",
  yellowcard: "🟨",
  "Red Card": "🟥",
  redcard: "🟥",
  subst: "⇔",
  Substitution: "⇔",
};

function getEventIcon(eventType: string): string {
  return EVENT_ICONS[eventType] ?? "•";
}

function tierClass(tier: number): string {
  return `tier-${tier}`;
}

export default function MatchDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [data, setData] = useState<MatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    async function load() {
      try {
        const res = await fetch(`/api/matches/${id}`);
        if (!res.ok) {
          setError("Match not found");
          return;
        }
        const json = await res.json();
        setData(json);
      } catch {
        setError("Failed to load match");
      } finally {
        setLoading(false);
      }
    }

    load();

    // Poll every 15s if match is live
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/matches/${id}`);
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch {
        // Silently retry
      }
    }, 15_000);

    return () => clearInterval(interval);
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center text-cream/40">
        Loading...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <p className="text-red-400">{error ?? "Match not found"}</p>
        <Link href="/" className="text-wc-gold underline text-sm mt-4 inline-block">
          Back to home
        </Link>
      </div>
    );
  }

  const { match, homeTeam, awayTeam, events, homePoints, awayPoints } = data;
  const isLive = match.status === "live";
  const isFinished = match.status === "finished";
  const hasScore = match.homeScore !== null && match.awayScore !== null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Back link */}
      <Link href="/" className="text-cream/40 text-sm hover:text-cream/70">
        &larr; Back
      </Link>

      {/* Match header */}
      <div className="bg-dark-card border border-dark-border rounded-lg p-5">
        {/* Stage + status */}
        <div className="flex items-center justify-between text-xs text-cream/50 mb-4">
          <span>
            {match.stage}
            {match.groupLetter ? ` · Group ${match.groupLetter}` : ""}
          </span>
          {isLive ? (
            <span className="flex items-center gap-1 text-red-400 font-semibold">
              <span className="live-dot inline-block w-2 h-2 rounded-full bg-red-500" />
              {match.minute}&apos;
            </span>
          ) : isFinished ? (
            <span className="text-cream/60 font-semibold">FT</span>
          ) : (
            <span>
              {new Date(match.kickoff).toLocaleDateString("en-GB", {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}{" "}
              {new Date(match.kickoff).toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>

        {/* Teams + Score */}
        <div className="flex items-center justify-between">
          {/* Home team */}
          <div className="flex-1 text-center">
            <div className="text-3xl mb-1">{homeTeam.flagEmoji}</div>
            <div className="font-semibold text-sm">{homeTeam.name}</div>
            {homeTeam.ownerName && (
              <div className="text-xs text-cream/40 mt-0.5">
                <span
                  className="inline-block w-2 h-2 rounded-full mr-1"
                  style={{ backgroundColor: homeTeam.ownerColor ?? "#888" }}
                />
                {homeTeam.ownerName}
              </div>
            )}
            <span className={`text-xs ${tierClass(homeTeam.tier)} mt-1 inline-block`}>
              T{homeTeam.tier} {homeTeam.tierLabel}
            </span>
          </div>

          {/* Score */}
          <div className="px-6 text-center">
            <div className="text-3xl font-bold font-mono">
              {hasScore ? (
                <>
                  {match.homeScore} - {match.awayScore}
                </>
              ) : (
                <span className="text-cream/30">vs</span>
              )}
            </div>
            {match.homePenalties !== null && match.awayPenalties !== null && (
              <div className="text-xs text-cream/50 mt-1">
                Pens: {match.homePenalties} - {match.awayPenalties}
              </div>
            )}
          </div>

          {/* Away team */}
          <div className="flex-1 text-center">
            <div className="text-3xl mb-1">{awayTeam.flagEmoji}</div>
            <div className="font-semibold text-sm">{awayTeam.name}</div>
            {awayTeam.ownerName && (
              <div className="text-xs text-cream/40 mt-0.5">
                <span
                  className="inline-block w-2 h-2 rounded-full mr-1"
                  style={{ backgroundColor: awayTeam.ownerColor ?? "#888" }}
                />
                {awayTeam.ownerName}
              </div>
            )}
            <span className={`text-xs ${tierClass(awayTeam.tier)} mt-1 inline-block`}>
              T{awayTeam.tier} {awayTeam.tierLabel}
            </span>
          </div>
        </div>

        {/* Venue */}
        {(match.venue || match.city) && (
          <div className="text-center text-xs text-cream/30 mt-4">
            {[match.venue, match.city].filter(Boolean).join(", ")}
          </div>
        )}
      </div>

      {/* Match Events Timeline */}
      {events.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-cream/60 uppercase tracking-wider mb-3">
            Match Events
          </h2>
          <div className="bg-dark-card border border-dark-border rounded-lg divide-y divide-dark-border">
            {events.map((evt) => {
              const isHome = evt.teamId === homeTeam.id;
              return (
                <div
                  key={evt.id}
                  className={`flex items-center gap-3 px-4 py-2.5 ${
                    isHome ? "" : "flex-row-reverse text-right"
                  }`}
                >
                  <span className="text-xs font-mono text-cream/40 w-8 shrink-0 text-center">
                    {evt.minute != null ? `${evt.minute}'` : ""}
                  </span>
                  <span className="text-base shrink-0">
                    {getEventIcon(evt.eventType)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {evt.playerName ?? evt.eventType}
                    </div>
                    {evt.detail && (
                      <div className="text-xs text-cream/40 truncate">
                        {evt.detail}
                      </div>
                    )}
                    {evt.assistPlayerName && (
                      <div className="text-xs text-cream/40 truncate">
                        Assist: {evt.assistPlayerName}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-cream/30 shrink-0">
                    {evt.teamFlag}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Points Breakdown */}
      {(homePoints.length > 0 || awayPoints.length > 0) && (
        <section>
          <h2 className="text-sm font-semibold text-cream/60 uppercase tracking-wider mb-3">
            Points Breakdown
          </h2>
          <div className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-cream/50 text-xs border-b border-dark-border">
                  <th className="text-left px-4 py-2">Team</th>
                  <th className="text-left px-4 py-2">Source</th>
                  <th className="text-left px-4 py-2">Note</th>
                  <th className="text-right px-4 py-2">Pts</th>
                </tr>
              </thead>
              <tbody>
                {homePoints.map((p, i) => (
                  <tr
                    key={`h-${i}`}
                    className="border-b border-dark-border/50"
                  >
                    <td className="px-4 py-2">
                      {homeTeam.flagEmoji} {homeTeam.name}
                    </td>
                    <td className="px-4 py-2 text-cream/60">{p.source}</td>
                    <td className="px-4 py-2 text-cream/40 text-xs">
                      {p.note ?? ""}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-wc-gold">
                      +{p.points.toFixed(1)}
                    </td>
                  </tr>
                ))}
                {awayPoints.map((p, i) => (
                  <tr
                    key={`a-${i}`}
                    className="border-b border-dark-border/50"
                  >
                    <td className="px-4 py-2">
                      {awayTeam.flagEmoji} {awayTeam.name}
                    </td>
                    <td className="px-4 py-2 text-cream/60">{p.source}</td>
                    <td className="px-4 py-2 text-cream/40 text-xs">
                      {p.note ?? ""}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-wc-gold">
                      +{p.points.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
