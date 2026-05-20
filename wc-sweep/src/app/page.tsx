"use client";

import { useEffect, useState } from "react";

interface LeaderboardEntry {
  playerId: number;
  playerName: string;
  color: string;
  totalPoints: number;
  teams: Array<{
    teamId: number;
    teamName: string;
    flagEmoji: string;
    tier: number;
    points: number;
    eliminated: boolean;
  }>;
}

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

export default function Home() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [todayMatches, setTodayMatches] = useState<MatchCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/leaderboard");
        if (res.ok) {
          const data = await res.json();
          setLeaderboard(data.leaderboard ?? []);
          setTodayMatches(data.todayMatches ?? []);
        }
      } catch {
        // API not ready yet
      } finally {
        setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="font-serif text-3xl font-bold">
          <span className="text-wc-gold">World Cup</span> Sweep
        </h1>
        <p className="text-cream/50 text-sm">
          FIFA World Cup 2026 &middot; USA / Canada / Mexico
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-cream/40">Loading...</div>
      ) : (
        <>
          {todayMatches.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-cream/60 uppercase tracking-wider mb-3">
                Today&apos;s Matches
              </h2>
              <div className="space-y-2">
                {todayMatches.map((m) => (
                  <div
                    key={m.id}
                    className="bg-dark-card border border-dark-border rounded-lg p-3"
                  >
                    <div className="flex items-center justify-between text-xs text-cream/50 mb-2">
                      <span>{m.stage}</span>
                      {m.status === "live" ? (
                        <span className="flex items-center gap-1 text-red-400">
                          <span className="live-dot inline-block w-2 h-2 rounded-full bg-red-500" />
                          {m.minute}&apos;
                        </span>
                      ) : m.status === "finished" ? (
                        <span>FT</span>
                      ) : (
                        <span>
                          {new Date(m.kickoff).toLocaleTimeString("en-GB", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-lg">{m.homeFlag}</span>
                        <div>
                          <div className="font-semibold text-sm">
                            {m.homeTeam}
                          </div>
                          {m.homeOwner && (
                            <div className="text-xs text-cream/40">
                              {m.homeOwner}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-xl font-bold px-4 font-mono">
                        {m.homeScore ?? "-"} - {m.awayScore ?? "-"}
                      </div>
                      <div className="flex items-center gap-2 flex-1 justify-end text-right">
                        <div>
                          <div className="font-semibold text-sm">
                            {m.awayTeam}
                          </div>
                          {m.awayOwner && (
                            <div className="text-xs text-cream/40">
                              {m.awayOwner}
                            </div>
                          )}
                        </div>
                        <span className="text-lg">{m.awayFlag}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="text-sm font-semibold text-cream/60 uppercase tracking-wider mb-3">
              Leaderboard
            </h2>
            {leaderboard.length === 0 ? (
              <div className="bg-dark-card border border-dark-border rounded-lg p-6 text-center text-cream/40">
                No players yet. Join the sweep to get started!
              </div>
            ) : (
              <div className="space-y-2">
                {leaderboard.map((entry, i) => (
                  <div
                    key={entry.playerId}
                    className="bg-dark-card border border-dark-border rounded-lg p-3 flex items-center gap-3"
                  >
                    <span className="text-lg font-bold text-cream/30 w-6 text-center">
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <div className="font-semibold text-sm">
                        {entry.playerName}
                      </div>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {entry.teams.map((t) => (
                          <span
                            key={t.teamId}
                            className={`text-xs px-1.5 py-0.5 rounded ${
                              t.eliminated
                                ? "bg-dark-border text-cream/30 line-through"
                                : "bg-dark-border/50 text-cream/70"
                            }`}
                            title={`${t.teamName} (${t.points} pts)`}
                          >
                            {t.flagEmoji}
                          </span>
                        ))}
                      </div>
                    </div>
                    <span className="text-lg font-bold text-wc-gold">
                      {entry.totalPoints.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
