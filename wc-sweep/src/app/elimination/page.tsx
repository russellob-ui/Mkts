"use client";

import { useState, useEffect } from "react";

interface Team {
  teamId: number;
  name: string;
  flagEmoji: string;
  fifaCode: string;
  tier: number;
  eliminated: boolean;
  eliminatedAt: string | null;
}

interface PlayerElimination {
  playerId: number;
  playerName: string;
  color: string;
  totalTeams: number;
  teamsAlive: number;
  teamsEliminated: number;
  survivalRate: number;
  teams: Team[];
}

const ROUND_LABELS: Record<string, string> = {
  group: "GS",
  group_stage: "GS",
  round_of_32: "R32",
  round_of_16: "R16",
  quarter_final: "QF",
  semi_final: "SF",
  final: "F",
  r32: "R32",
  r16: "R16",
  qf: "QF",
  sf: "SF",
};

function getRoundLabel(eliminatedAt: string | null): string {
  if (!eliminatedAt) return "";
  const key = eliminatedAt.toLowerCase().replace(/[\s-]/g, "_");
  return ROUND_LABELS[key] ?? eliminatedAt;
}

export default function EliminationPage() {
  const [playerData, setPlayerData] = useState<PlayerElimination[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/elimination");
        const data = await res.json();
        setPlayerData(data.players ?? []);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-dark text-cream flex items-center justify-center">
        <div className="text-cream/50">Loading...</div>
      </div>
    );
  }

  // Find who might be "last man standing"
  const maxAlive = Math.max(...playerData.map((p) => p.teamsAlive), 0);
  const leaders = playerData.filter((p) => p.teamsAlive === maxAlive && maxAlive > 0);

  return (
    <div className="min-h-screen bg-dark text-cream">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-serif font-bold mb-2">
          <span className="text-wc-gold">Elimination</span> Tracker
        </h1>
        <p className="text-cream/50 text-sm mb-6">
          Track which teams are still alive and which have been knocked out.
        </p>

        <div className="space-y-4">
          {playerData.map((player) => (
            <div
              key={player.playerId}
              className="bg-dark-card border border-dark-border rounded-xl p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-lg" style={{ color: player.color }}>
                    {player.playerName}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-green-400 font-semibold">
                    {player.teamsAlive} alive
                  </span>
                  {player.teamsEliminated > 0 && (
                    <span className="text-red-400/70">
                      {player.teamsEliminated} out
                    </span>
                  )}
                  <span className="text-cream/30">
                    {player.survivalRate}%
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {player.teams.map((team) => (
                  <div
                    key={team.teamId}
                    className="flex flex-col items-center"
                    title={`${team.name}${team.eliminated ? " (eliminated)" : ""}`}
                  >
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center text-xl border-2 relative ${
                        team.eliminated
                          ? "border-red-800/50 bg-dark-border/50 grayscale opacity-50"
                          : "border-dark-border bg-dark-card"
                      }`}
                    >
                      {team.flagEmoji}
                      {team.eliminated && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-red-500 text-2xl font-bold opacity-80">
                            &#x2715;
                          </span>
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] text-cream/50 mt-1">
                      {team.fifaCode}
                    </span>
                    {team.eliminated && team.eliminatedAt && (
                      <span className="text-[9px] text-red-400/70">
                        {getRoundLabel(team.eliminatedAt)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Last Man Standing */}
        {leaders.length > 0 && (
          <div className="mt-8 bg-dark-card border border-wc-gold/30 rounded-xl p-5">
            <h2 className="text-lg font-serif font-bold text-wc-gold mb-2">
              Last Man Standing
            </h2>
            <p className="text-cream/60 text-sm mb-3">
              Who will have teams alive the longest?
            </p>
            <div className="flex flex-wrap gap-3">
              {leaders.map((p) => (
                <div
                  key={p.playerId}
                  className="bg-dark border border-dark-border rounded-lg px-4 py-2 flex items-center gap-2"
                >
                  <span className="font-bold" style={{ color: p.color }}>
                    {p.playerName}
                  </span>
                  <span className="text-wc-gold text-sm font-semibold">
                    {p.teamsAlive} teams
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
