"use client";

import { useEffect, useState } from "react";

interface TeamDetail {
  teamId: number;
  teamName: string;
  flagEmoji: string;
  tier: number;
  currentPoints: number;
  remainingMatches: number;
  expectedFromTeam: number;
  eliminated: boolean;
}

interface ExpectedEntry {
  playerId: number;
  playerName: string;
  color: string;
  currentPoints: number;
  expectedRemaining: number;
  projectedTotal: number;
  teamsAlive: number;
  teams: TeamDetail[];
}

const TIER_LABELS: Record<number, string> = {
  1: "Elite",
  2: "Strong",
  3: "Mid",
  4: "Underdog",
};

const TIER_COLORS: Record<number, string> = {
  1: "#ffd700",
  2: "#c0c0c0",
  3: "#cd7f32",
  4: "#22c55e",
};

export default function ExpectedPointsPage() {
  const [data, setData] = useState<ExpectedEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/expected-points");
        if (res.ok) {
          const json = await res.json();
          setData(json.expected);
        } else {
          setError(`API returned ${res.status}`);
        }
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="text-center py-12 text-cream/40">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="bg-dark-card border border-red-500 rounded-lg p-6 text-center text-red-400">
          Error: {error}
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) return null;

  const maxProjected = Math.max(...data.map((d) => d.projectedTotal), 1);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="font-serif text-3xl font-bold">
          <span className="text-wc-gold">Expected</span> Points
        </h1>
        <p className="text-cream/50 text-sm">
          Projected final standings based on remaining fixtures
        </p>
      </div>

      {/* Bar chart visualization */}
      <div className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
        <div className="px-4 py-2 border-b border-dark-border bg-dark-border/30">
          <h2 className="font-serif font-bold text-wc-gold">
            Projected Standings
          </h2>
          <p className="text-xs text-cream/40">
            Solid = current points &middot; Striped = expected remaining
          </p>
        </div>
        <div className="p-4 space-y-3">
          {data.map((entry, i) => {
            const currentWidth =
              (entry.currentPoints / maxProjected) * 100;
            const expectedWidth =
              (entry.expectedRemaining / maxProjected) * 100;

            return (
              <div
                key={entry.playerId}
                className="cursor-pointer"
                onClick={() =>
                  setExpanded(
                    expanded === entry.playerId ? null : entry.playerId
                  )
                }
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-cream/40 w-5 text-right font-bold">
                      {i + 1}
                    </span>
                    <span
                      className="font-medium text-sm"
                      style={{ color: entry.color }}
                    >
                      {entry.playerName}
                    </span>
                    <span className="text-xs text-cream/40">
                      {entry.teamsAlive} alive
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-cream/40">
                      {entry.currentPoints} + {entry.expectedRemaining}
                    </span>
                    <span className="text-sm font-bold text-wc-gold min-w-[50px] text-right">
                      {entry.projectedTotal}
                    </span>
                  </div>
                </div>
                <div className="h-6 bg-dark-border rounded-full overflow-hidden flex">
                  {/* Current points - solid */}
                  <div
                    className="h-full rounded-l-full transition-all duration-500"
                    style={{
                      width: `${currentWidth}%`,
                      backgroundColor: entry.color,
                    }}
                  />
                  {/* Expected remaining - striped */}
                  <div
                    className="h-full transition-all duration-500"
                    style={{
                      width: `${expectedWidth}%`,
                      backgroundColor: entry.color,
                      opacity: 0.35,
                      backgroundImage: `repeating-linear-gradient(
                        45deg,
                        transparent,
                        transparent 3px,
                        rgba(0,0,0,0.3) 3px,
                        rgba(0,0,0,0.3) 6px
                      )`,
                    }}
                  />
                </div>

                {/* Expanded team details */}
                {expanded === entry.playerId && (
                  <div className="mt-2 ml-7 space-y-1">
                    {entry.teams.map((team) => (
                      <div
                        key={team.teamId}
                        className={`flex items-center justify-between text-xs py-1 px-2 rounded ${
                          team.eliminated ? "opacity-40" : ""
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span>{team.flagEmoji}</span>
                          <span className="text-cream/80">{team.teamName}</span>
                          <span
                            className="px-1 py-0.5 rounded text-[10px] font-medium"
                            style={{
                              color: TIER_COLORS[team.tier] ?? "#fff",
                              backgroundColor: `${TIER_COLORS[team.tier] ?? "#fff"}20`,
                            }}
                          >
                            {TIER_LABELS[team.tier] ?? `T${team.tier}`}
                          </span>
                          {team.eliminated && (
                            <span className="text-red-400">OUT</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-cream/50">
                            {team.currentPoints} pts
                          </span>
                          {!team.eliminated && (
                            <span className="text-wc-gold/70">
                              +{team.expectedFromTeam} ({team.remainingMatches}{" "}
                              {team.remainingMatches === 1 ? "match" : "matches"})
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {data.slice(0, 4).map((entry, i) => (
          <div
            key={entry.playerId}
            className="bg-dark-card border border-dark-border rounded-lg p-3 text-center"
          >
            <div
              className={`text-xs mb-1 ${
                i === 0 ? "text-wc-gold" : "text-cream/40"
              }`}
            >
              #{i + 1} Projected
            </div>
            <div
              className="font-serif text-xl font-bold"
              style={{ color: entry.color }}
            >
              {entry.playerName}
            </div>
            <div className="text-wc-gold font-bold text-lg">
              {entry.projectedTotal}
            </div>
            <div className="text-xs text-cream/40">
              {entry.teamsAlive} teams alive
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
