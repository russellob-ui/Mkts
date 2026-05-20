"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface PlayerInfo {
  id: number;
  name: string;
  slug: string;
  avatarEmoji: string | null;
  color: string | null;
}

interface TeamEntry {
  teamId: number;
  name: string;
  flagEmoji: string;
  fifaCode: string;
  groupLetter: string;
  tier: number;
  tierLabel: string;
  eliminated: boolean;
  points: number;
}

interface PointsEntry {
  id: number;
  teamId: number;
  teamName: string;
  teamFlag: string;
  source: string;
  points: number;
  note: string | null;
  createdAt: string;
}

interface PredictionsStats {
  total: number;
  correct: number;
  accuracy: number;
}

interface BanterEntry {
  id: number;
  eventType: string;
  headline: string;
  detail: string | null;
  emoji: string | null;
  importance: number;
  createdAt: string;
}

interface PlayerData {
  player: PlayerInfo;
  teams: TeamEntry[];
  totalPoints: number;
  pointsBreakdown: PointsEntry[];
  predictions: PredictionsStats;
  recentBanter: BanterEntry[];
}

function tierClass(tier: number): string {
  return `tier-${tier}`;
}

export default function PlayerProfilePage() {
  const params = useParams();
  const slug = params?.slug as string;
  const [data, setData] = useState<PlayerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;

    async function load() {
      try {
        const res = await fetch(`/api/player/${slug}`);
        if (!res.ok) {
          setError("Player not found");
          return;
        }
        const json = await res.json();
        setData(json);
      } catch {
        setError("Failed to load player");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [slug]);

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
        <p className="text-red-400">{error ?? "Player not found"}</p>
        <Link href="/" className="text-wc-gold underline text-sm mt-4 inline-block">
          Back to home
        </Link>
      </div>
    );
  }

  const { player, teams, totalPoints, pointsBreakdown, predictions, recentBanter } =
    data;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Back link */}
      <Link href="/" className="text-cream/40 text-sm hover:text-cream/70">
        &larr; Back
      </Link>

      {/* Player header */}
      <div className="text-center space-y-2">
        <div className="text-5xl">{player.avatarEmoji ?? "👤"}</div>
        <h1 className="font-serif text-2xl font-bold">{player.name}</h1>
        <div className="text-3xl font-bold text-wc-gold">
          {totalPoints.toFixed(1)}{" "}
          <span className="text-base font-normal text-cream/50">pts</span>
        </div>
      </div>

      {/* My Teams */}
      <section>
        <h2 className="text-sm font-semibold text-cream/60 uppercase tracking-wider mb-3">
          My Teams
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {teams.map((team) => (
            <div
              key={team.teamId}
              className={`bg-dark-card border border-dark-border rounded-lg p-3 ${
                team.eliminated ? "opacity-50" : ""
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <span className="text-2xl">{team.flagEmoji}</span>
                {team.eliminated ? (
                  <span className="text-xs bg-red-900/40 text-red-400 px-1.5 py-0.5 rounded">
                    ELIMINATED
                  </span>
                ) : (
                  <span className="text-xs bg-green-900/40 text-green-400 px-1.5 py-0.5 rounded">
                    ALIVE
                  </span>
                )}
              </div>
              <div
                className={`font-semibold text-sm ${
                  team.eliminated ? "line-through text-cream/40" : ""
                }`}
              >
                {team.name}
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-cream/40">
                  Group {team.groupLetter}
                </span>
                <span className={`text-xs ${tierClass(team.tier)}`}>
                  T{team.tier} {team.tierLabel}
                </span>
              </div>
              <div className="text-right mt-2">
                <span className="text-lg font-bold text-wc-gold font-mono">
                  {team.points.toFixed(1)}
                </span>
                <span className="text-xs text-cream/40 ml-1">pts</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Points Breakdown */}
      {pointsBreakdown.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-cream/60 uppercase tracking-wider mb-3">
            Points Breakdown
          </h2>
          <div className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-cream/50 text-xs border-b border-dark-border">
                  <th className="text-left px-3 py-2">Source</th>
                  <th className="text-left px-3 py-2">Team</th>
                  <th className="text-right px-3 py-2">Pts</th>
                  <th className="text-left px-3 py-2 hidden sm:table-cell">
                    Note
                  </th>
                </tr>
              </thead>
              <tbody>
                {pointsBreakdown.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-b border-dark-border/50"
                  >
                    <td className="px-3 py-2 text-cream/60">{entry.source}</td>
                    <td className="px-3 py-2">
                      {entry.teamFlag} {entry.teamName}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-wc-gold">
                      {entry.points > 0 ? "+" : ""}
                      {entry.points.toFixed(1)}
                    </td>
                    <td className="px-3 py-2 text-cream/40 text-xs hidden sm:table-cell">
                      {entry.note ?? ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Predictions */}
      {predictions.total > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-cream/60 uppercase tracking-wider mb-3">
            Predictions
          </h2>
          <div className="bg-dark-card border border-dark-border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-lg font-bold text-wc-gold">
                  {predictions.correct}
                </span>
                <span className="text-cream/50 text-sm">
                  {" "}
                  correct out of {predictions.total}
                </span>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold text-wc-gold">
                  {predictions.accuracy}%
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Recent Banter */}
      {recentBanter.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-cream/60 uppercase tracking-wider mb-3">
            Recent Banter
          </h2>
          <div className="space-y-2">
            {recentBanter.map((b) => (
              <div
                key={b.id}
                className="bg-dark-card border border-dark-border rounded-lg px-4 py-3"
              >
                <div className="flex items-start gap-2">
                  <span className="text-base shrink-0">
                    {b.emoji ?? "💬"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{b.headline}</div>
                    {b.detail && (
                      <div className="text-xs text-cream/40 mt-0.5">
                        {b.detail}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
