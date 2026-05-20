"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface TeamInfo {
  id: number;
  name: string;
  fifaCode: string;
  groupLetter: string;
  flagEmoji: string;
  tier: number;
  tierLabel: string;
  eliminated: boolean;
  bestFinish: string | null;
  fifaRanking: number | null;
}

interface OwnerInfo {
  id: number;
  name: string;
  color: string | null;
}

interface StandingInfo {
  position: number | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  qualified: boolean;
}

interface MatchEntry {
  matchId: number;
  stage: string;
  groupLetter: string | null;
  kickoff: string;
  status: string;
  venue: string | null;
  city: string | null;
  isHome: boolean;
  homeScore: number | null;
  awayScore: number | null;
  homePenalties: number | null;
  awayPenalties: number | null;
  minute: number | null;
  winnerTeamId: number | null;
  opponentId: number;
  opponentName: string;
  opponentFlag: string;
  result: "W" | "D" | "L" | null;
  teamScore: number | null;
  opponentScore: number | null;
}

interface EventEntry {
  id: number;
  matchId: number;
  eventType: string;
  playerName: string | null;
  assistPlayerName: string | null;
  minute: number | null;
  detail: string | null;
}

interface PointEntry {
  id: number;
  source: string;
  points: number;
  note: string | null;
  matchId: number | null;
  createdAt: string;
}

interface TeamData {
  team: TeamInfo;
  owner: OwnerInfo | null;
  standing: StandingInfo | null;
  matches: MatchEntry[];
  events: EventEntry[];
  points: PointEntry[];
  totalPoints: number;
}

function tierColorClass(tier: number): string {
  switch (tier) {
    case 1:
      return "text-[#ffd700]";
    case 2:
      return "text-[#c0c0c0]";
    case 3:
      return "text-[#cd7f32]";
    case 4:
      return "text-[#22c55e]";
    default:
      return "text-cream/60";
  }
}

function tierBgClass(tier: number): string {
  switch (tier) {
    case 1:
      return "bg-[#ffd700]/15 border-[#ffd700]/30 text-[#ffd700]";
    case 2:
      return "bg-[#c0c0c0]/15 border-[#c0c0c0]/30 text-[#c0c0c0]";
    case 3:
      return "bg-[#cd7f32]/15 border-[#cd7f32]/30 text-[#cd7f32]";
    case 4:
      return "bg-[#22c55e]/15 border-[#22c55e]/30 text-[#22c55e]";
    default:
      return "bg-dark-border text-cream/60";
  }
}

function resultBadge(result: "W" | "D" | "L") {
  const map = {
    W: "bg-green-600 text-white",
    D: "bg-yellow-600 text-white",
    L: "bg-red-600 text-white",
  };
  return (
    <span
      className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${map[result]}`}
    >
      {result}
    </span>
  );
}

function eventIcon(eventType: string): string {
  switch (eventType) {
    case "Goal":
      return "⚽";
    case "Card":
      return "🟨";
    case "subst":
      return "🔄";
    default:
      return "•";
  }
}

function formatKickoff(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TeamDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [data, setData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    async function load() {
      try {
        const res = await fetch(`/api/team/${id}`);
        if (!res.ok) {
          setError("Team not found");
          return;
        }
        const json = await res.json();
        setData(json);
      } catch {
        setError("Failed to load team");
      } finally {
        setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 30_000);
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
        <p className="text-red-400">{error ?? "Team not found"}</p>
        <Link
          href="/"
          className="text-wc-gold underline text-sm mt-4 inline-block"
        >
          Back to home
        </Link>
      </div>
    );
  }

  const { team, owner, standing, matches: teamMatches, events, points, totalPoints } = data;

  // Form: last 5 finished results
  const finishedMatches = teamMatches.filter(
    (m) => m.status === "finished" && m.result
  );
  const form = finishedMatches.slice(-5);

  const upcomingMatches = teamMatches.filter(
    (m) => m.status === "scheduled" || m.status === "live"
  );
  const completedMatches = teamMatches.filter(
    (m) => m.status === "finished"
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Back link */}
      <Link href="/groups" className="text-cream/40 text-sm hover:text-cream/70">
        &larr; Back to Groups
      </Link>

      {/* Header */}
      <div className="text-center space-y-3">
        <div className="text-6xl">{team.flagEmoji}</div>
        <h1 className="font-serif text-3xl font-bold">{team.name}</h1>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <span className="text-xs bg-dark-card border border-dark-border px-2 py-1 rounded text-cream/60">
            Group {team.groupLetter}
          </span>
          <span
            className={`text-xs px-2 py-1 rounded border ${tierBgClass(team.tier)}`}
          >
            T{team.tier} {team.tierLabel}
          </span>
          {team.fifaRanking && (
            <span className="text-xs bg-dark-card border border-dark-border px-2 py-1 rounded text-cream/60">
              FIFA #{team.fifaRanking}
            </span>
          )}
          {team.eliminated && (
            <span className="text-xs bg-red-900/40 border border-red-500/30 text-red-400 px-2 py-1 rounded">
              ELIMINATED
            </span>
          )}
          {team.bestFinish && (
            <span className="text-xs bg-wc-gold/15 border border-wc-gold/30 text-wc-gold px-2 py-1 rounded">
              {team.bestFinish}
            </span>
          )}
        </div>

        {/* Owner */}
        {owner && (
          <div className="text-sm text-cream/60">
            Owned by{" "}
            <span
              className="font-semibold"
              style={{ color: owner.color ?? undefined }}
            >
              {owner.name}
            </span>
          </div>
        )}

        {/* Standing line */}
        {standing && (
          <div className="text-sm text-cream/50">
            {standing.position != null && (
              <span>
                {standing.position === 1
                  ? "1st"
                  : standing.position === 2
                  ? "2nd"
                  : standing.position === 3
                  ? "3rd"
                  : `${standing.position}th`}{" "}
                in group &middot;{" "}
              </span>
            )}
            {standing.played}P {standing.won}W {standing.drawn}D {standing.lost}L
            &middot; GD{" "}
            {standing.goalDifference > 0
              ? `+${standing.goalDifference}`
              : standing.goalDifference}{" "}
            &middot;{" "}
            <span className="text-wc-gold font-semibold">
              {standing.points} pts
            </span>
            {standing.qualified && (
              <span className="ml-2 text-green-400 text-xs font-bold">
                QUALIFIED
              </span>
            )}
          </div>
        )}

        {/* Total sweep points */}
        <div className="text-2xl font-bold text-wc-gold">
          {totalPoints.toFixed(1)}{" "}
          <span className="text-base font-normal text-cream/50">
            sweep pts
          </span>
        </div>
      </div>

      {/* Form */}
      {form.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-cream/60 uppercase tracking-wider mb-3">
            Form
          </h2>
          <div className="flex items-center gap-2">
            {form.map((m) => (
              <div key={m.matchId} className="text-center">
                {resultBadge(m.result!)}
                <div className="text-[10px] text-cream/40 mt-1">
                  {m.opponentFlag}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Matches */}
      <section>
        <h2 className="text-sm font-semibold text-cream/60 uppercase tracking-wider mb-3">
          Matches
        </h2>
        <div className="space-y-2">
          {teamMatches.map((m) => (
            <Link
              key={m.matchId}
              href={`/match/${m.matchId}`}
              className="block bg-dark-card border border-dark-border rounded-lg px-4 py-3 hover:border-dark-border/80 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {m.result && resultBadge(m.result)}
                  <span className="text-sm truncate">
                    <span className="text-cream/40">vs</span>{" "}
                    <span>
                      {m.opponentFlag} {m.opponentName}
                    </span>
                  </span>
                </div>
                <div className="text-right shrink-0 ml-3">
                  {m.status === "finished" ? (
                    <div>
                      <span className="font-mono font-bold text-sm">
                        {m.teamScore} - {m.opponentScore}
                      </span>
                      {m.homePenalties != null && m.awayPenalties != null && (
                        <span className="text-xs text-cream/40 ml-1">
                          (
                          {m.isHome ? m.homePenalties : m.awayPenalties}-
                          {m.isHome ? m.awayPenalties : m.homePenalties} pen)
                        </span>
                      )}
                    </div>
                  ) : m.status === "live" ? (
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm">
                        {m.teamScore ?? 0} - {m.opponentScore ?? 0}
                      </span>
                      <span className="inline-block w-2 h-2 rounded-full bg-red-500 live-dot" />
                      <span className="text-xs text-red-400">
                        {m.minute}&apos;
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-cream/40">
                      {formatKickoff(m.kickoff)}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-cream/30">
                  {m.stage}
                  {m.groupLetter ? ` · Group ${m.groupLetter}` : ""}
                </span>
                {m.venue && (
                  <span className="text-xs text-cream/30 truncate ml-2">
                    {m.venue}
                  </span>
                )}
              </div>
            </Link>
          ))}
          {teamMatches.length === 0 && (
            <div className="text-center text-cream/40 py-4 text-sm">
              No matches scheduled yet
            </div>
          )}
        </div>
      </section>

      {/* Events */}
      {events.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-cream/60 uppercase tracking-wider mb-3">
            Events
          </h2>
          <div className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
            <div className="divide-y divide-dark-border/50">
              {events.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center gap-3 px-4 py-2.5"
                >
                  <span className="text-base shrink-0">
                    {eventIcon(e.eventType)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">
                      {e.playerName ?? "Unknown"}
                    </span>
                    {e.assistPlayerName && (
                      <span className="text-xs text-cream/40 ml-1.5">
                        (ast. {e.assistPlayerName})
                      </span>
                    )}
                    {e.detail && (
                      <span className="text-xs text-cream/40 ml-1.5">
                        &middot; {e.detail}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-cream/40 shrink-0 font-mono">
                    {e.minute != null ? `${e.minute}'` : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Points */}
      {points.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-cream/60 uppercase tracking-wider mb-3">
            Points Earned
          </h2>
          <div className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-cream/50 text-xs border-b border-dark-border">
                  <th className="text-left px-3 py-2">Source</th>
                  <th className="text-right px-3 py-2">Pts</th>
                  <th className="text-left px-3 py-2 hidden sm:table-cell">
                    Note
                  </th>
                </tr>
              </thead>
              <tbody>
                {points.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-dark-border/50 last:border-0"
                  >
                    <td className="px-3 py-2 text-cream/60">{p.source}</td>
                    <td className="px-3 py-2 text-right font-mono text-wc-gold">
                      {p.points > 0 ? "+" : ""}
                      {p.points.toFixed(1)}
                    </td>
                    <td className="px-3 py-2 text-cream/40 text-xs hidden sm:table-cell">
                      {p.note ?? ""}
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
