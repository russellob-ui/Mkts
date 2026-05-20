"use client";

import { useEffect, useState } from "react";

interface MatchCard {
  id: number;
  homeTeam: string;
  awayTeam: string;
  homeFlag: string;
  awayFlag: string;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  minute: number | null;
  kickoff: string;
  homeOwner: string | null;
  awayOwner: string | null;
  stage: string;
}

interface HypotheticalEntry {
  playerId: number;
  playerName: string;
  color: string;
  currentPoints: number;
  hypotheticalPoints: number;
  change: number;
  newRank: number;
  currentRank: number;
}

interface Scenario {
  matchId: number;
  homeScore: number;
  awayScore: number;
}

export default function WhatIfPage() {
  const [upcomingMatches, setUpcomingMatches] = useState<MatchCard[]>([]);
  const [scenarios, setScenarios] = useState<Map<number, { home: string; away: string }>>(new Map());
  const [results, setResults] = useState<HypotheticalEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/matches?status=upcoming");
        if (res.ok) {
          const json = await res.json();
          // Accept either upcoming or all matches that are scheduled/live
          const all: MatchCard[] = json.matches ?? json.todayMatches ?? [];
          const upcoming = all.filter(
            (m: MatchCard) =>
              m.status === "scheduled" ||
              m.status === "not_started" ||
              m.status === "live"
          );
          setUpcomingMatches(upcoming.slice(0, 20));
        } else {
          // Fallback: try leaderboard endpoint for today's matches
          const lbRes = await fetch("/api/leaderboard");
          if (lbRes.ok) {
            const json = await lbRes.json();
            const todayMatches: MatchCard[] = json.todayMatches ?? [];
            const upcoming = todayMatches.filter(
              (m) =>
                m.status === "scheduled" ||
                m.status === "not_started" ||
                m.status === "live"
            );
            setUpcomingMatches(upcoming);
          }
        }
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function updateScenario(matchId: number, side: "home" | "away", value: string) {
    setScenarios((prev) => {
      const next = new Map(prev);
      const existing = next.get(matchId) ?? { home: "", away: "" };
      next.set(matchId, { ...existing, [side]: value });
      return next;
    });
  }

  async function runSimulation() {
    const scenarioList: Scenario[] = [];
    for (const [matchId, scores] of scenarios) {
      const home = parseInt(scores.home);
      const away = parseInt(scores.away);
      if (!isNaN(home) && !isNaN(away) && home >= 0 && away >= 0) {
        scenarioList.push({ matchId, homeScore: home, awayScore: away });
      }
    }

    if (scenarioList.length === 0) {
      setError("Enter at least one score prediction");
      return;
    }

    setSimulating(true);
    setError(null);

    try {
      const res = await fetch("/api/what-if", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarios: scenarioList }),
      });
      if (res.ok) {
        const json = await res.json();
        setResults(json.hypothetical);
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.error ?? `API returned ${res.status}`);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setSimulating(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="text-center py-12 text-cream/40">Loading matches...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="font-serif text-3xl font-bold">
          <span className="text-wc-gold">What If</span> Simulator
        </h1>
        <p className="text-cream/50 text-sm">
          Set hypothetical scores and see how the leaderboard would change
        </p>
      </div>

      {/* Match Score Cards */}
      {upcomingMatches.length === 0 ? (
        <div className="bg-dark-card border border-dark-border rounded-lg p-8 text-center text-cream/40">
          No upcoming matches to simulate
        </div>
      ) : (
        <div className="space-y-3">
          {upcomingMatches.map((match) => {
            const scenario = scenarios.get(match.id);
            return (
              <div
                key={match.id}
                className="bg-dark-card border border-dark-border rounded-lg p-4"
              >
                <div className="flex items-center justify-between text-xs text-cream/40 mb-2">
                  <span>{match.stage}</span>
                  <span>
                    {match.status === "live"
                      ? `LIVE ${match.minute ?? 0}'`
                      : new Date(match.kickoff).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                  </span>
                </div>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  {/* Home team */}
                  <div className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div>
                        <div className="text-sm font-medium">{match.homeTeam}</div>
                        {match.homeOwner && (
                          <div className="text-xs text-cream/40">{match.homeOwner}</div>
                        )}
                      </div>
                      <span className="text-lg">{match.homeFlag}</span>
                    </div>
                  </div>

                  {/* Score inputs */}
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="20"
                      placeholder="-"
                      value={scenario?.home ?? ""}
                      onChange={(e) =>
                        updateScenario(match.id, "home", e.target.value)
                      }
                      className="w-12 h-10 bg-dark border border-dark-border rounded-lg text-center text-cream font-bold text-lg focus:outline-none focus:border-wc-gold"
                    />
                    <span className="text-cream/30 font-bold">:</span>
                    <input
                      type="number"
                      min="0"
                      max="20"
                      placeholder="-"
                      value={scenario?.away ?? ""}
                      onChange={(e) =>
                        updateScenario(match.id, "away", e.target.value)
                      }
                      className="w-12 h-10 bg-dark border border-dark-border rounded-lg text-center text-cream font-bold text-lg focus:outline-none focus:border-wc-gold"
                    />
                  </div>

                  {/* Away team */}
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{match.awayFlag}</span>
                      <div>
                        <div className="text-sm font-medium">{match.awayTeam}</div>
                        {match.awayOwner && (
                          <div className="text-xs text-cream/40">{match.awayOwner}</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Calculate Button */}
      <div className="text-center">
        <button
          onClick={runSimulation}
          disabled={simulating || scenarios.size === 0}
          className="bg-wc-gold text-dark font-bold px-8 py-3 rounded-lg text-sm hover:bg-wc-gold/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {simulating ? "Calculating..." : "Calculate What-If"}
        </button>
      </div>

      {error && (
        <div className="bg-dark-card border border-red-500 rounded-lg p-4 text-center text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Results: Side-by-side leaderboard */}
      {results && (
        <div className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
          <div className="px-4 py-2 border-b border-dark-border bg-dark-border/30">
            <h2 className="font-serif font-bold text-wc-gold">
              Hypothetical Leaderboard
            </h2>
            <p className="text-xs text-cream/40">
              Current standings vs what-if projection
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-border text-xs text-cream/40">
                  <th className="px-4 py-2 text-left">Rank</th>
                  <th className="px-4 py-2 text-left">Player</th>
                  <th className="px-4 py-2 text-right">Current</th>
                  <th className="px-4 py-2 text-right">Change</th>
                  <th className="px-4 py-2 text-right">Projected</th>
                  <th className="px-4 py-2 text-center">Move</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border/50">
                {results.map((entry) => {
                  const rankChange = entry.currentRank - entry.newRank;
                  return (
                    <tr key={entry.playerId} className="hover:bg-dark-border/20">
                      <td className="px-4 py-3 font-bold text-wc-gold">
                        #{entry.newRank}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="font-medium"
                          style={{ color: entry.color }}
                        >
                          {entry.playerName}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-cream/60">
                        {entry.currentPoints}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {entry.change > 0 ? (
                          <span className="text-green-400 font-bold">
                            +{entry.change}
                          </span>
                        ) : (
                          <span className="text-cream/30">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-cream">
                        {entry.hypotheticalPoints}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {rankChange > 0 ? (
                          <span className="text-green-400 font-bold">
                            {"↑"}{rankChange}
                          </span>
                        ) : rankChange < 0 ? (
                          <span className="text-red-400 font-bold">
                            {"↓"}{Math.abs(rankChange)}
                          </span>
                        ) : (
                          <span className="text-cream/30">&mdash;</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
