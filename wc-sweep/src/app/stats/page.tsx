"use client";

import { useEffect, useState } from "react";

interface TopScorer {
  playerName: string;
  teamName: string;
  flagEmoji: string;
  goals: number;
}

interface MatchRecord {
  homeTeam: string;
  awayTeam: string;
  homeFlag: string;
  awayFlag: string;
  homeScore: number;
  awayScore: number;
  stage: string;
}

interface FastestGoal {
  playerName: string;
  teamName: string;
  flagEmoji: string;
  minute: number;
  matchLabel: string;
}

interface LeaderByDay {
  date: string;
  leader: string;
  color: string;
  points: number;
}

interface TierBreakdown {
  tier: number;
  label: string;
  points: number;
}

interface PredictionPlayer {
  playerName: string;
  color: string;
  total: number;
  correct: number;
  accuracy: number;
}

interface StatsData {
  totalGoals: number;
  totalMatches: number;
  avgGoalsPerMatch: number;
  totalCards: number;
  totalRedCards: number;
  totalYellowCards: number;
  totalCleanSheets: number;
  topScorers: TopScorer[];
  mostCardedTeam: { teamName: string; flagEmoji: string; cards: number } | null;
  biggestWin: MatchRecord | null;
  mostExciting: MatchRecord | null;
  fastestGoal: FastestGoal | null;
  leaderByDay: LeaderByDay[];
  tierBreakdown: TierBreakdown[];
  predictionLeaderboard: PredictionPlayer[];
}

const TIER_COLORS: Record<number, string> = {
  1: "#ffd700",
  2: "#c0c0c0",
  3: "#cd7f32",
  4: "#22c55e",
};

export default function StatsPage() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/stats");
        if (res.ok) {
          const json = await res.json();
          setData(json);
          setError(null);
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
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="text-center py-12 text-cream/40">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="bg-dark-card border border-red-500 rounded-lg p-6 text-center text-red-400">
          Error: {error}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const maxTierPoints = Math.max(...data.tierBreakdown.map((t) => t.points), 1);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="font-serif text-3xl font-bold">
          <span className="text-wc-gold">Tournament</span> Stats
        </h1>
        <p className="text-cream/50 text-sm">
          FIFA World Cup 2026 &middot; Numbers that matter
        </p>
      </div>

      {/* Big Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Goals", value: data.totalGoals, emoji: "⚽" },
          { label: "Matches Played", value: data.totalMatches, emoji: "🏟️" },
          {
            label: "Avg Goals/Match",
            value: data.avgGoalsPerMatch,
            emoji: "📊",
          },
          {
            label: "Clean Sheets",
            value: data.totalCleanSheets,
            emoji: "🧤",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-dark-card border border-dark-border rounded-lg p-4 text-center"
          >
            <div className="text-2xl mb-1">{stat.emoji}</div>
            <div className="font-serif text-3xl font-bold text-wc-gold">
              {stat.value}
            </div>
            <div className="text-xs text-cream/40 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Cards Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-dark-card border border-dark-border rounded-lg p-3 text-center">
          <div className="text-lg">{"🟨"}</div>
          <div className="font-bold text-xl text-yellow-400">
            {data.totalYellowCards}
          </div>
          <div className="text-xs text-cream/40">Yellow Cards</div>
        </div>
        <div className="bg-dark-card border border-dark-border rounded-lg p-3 text-center">
          <div className="text-lg">{"🟥"}</div>
          <div className="font-bold text-xl text-red-400">
            {data.totalRedCards}
          </div>
          <div className="text-xs text-cream/40">Red Cards</div>
        </div>
        {data.mostCardedTeam && (
          <div className="bg-dark-card border border-dark-border rounded-lg p-3 text-center">
            <div className="text-lg">{data.mostCardedTeam.flagEmoji}</div>
            <div className="font-bold text-sm text-cream">
              {data.mostCardedTeam.teamName}
            </div>
            <div className="text-xs text-cream/40">
              Most Carded ({data.mostCardedTeam.cards})
            </div>
          </div>
        )}
      </div>

      {/* Golden Boot */}
      {data.topScorers.length > 0 && (
        <div className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
          <div className="px-4 py-2 border-b border-dark-border bg-dark-border/30">
            <h2 className="font-serif font-bold text-wc-gold">
              {"👟"} Golden Boot
            </h2>
            <p className="text-xs text-cream/40">Top goal scorers</p>
          </div>
          <div className="divide-y divide-dark-border/50">
            {data.topScorers.map((scorer, i) => (
              <div
                key={`${scorer.playerName}-${i}`}
                className="px-4 py-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-6 text-center font-bold text-sm ${
                      i === 0
                        ? "text-wc-gold"
                        : i === 1
                          ? "text-gray-400"
                          : i === 2
                            ? "text-amber-700"
                            : "text-cream/40"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="text-lg">{scorer.flagEmoji}</span>
                  <div>
                    <div className="font-medium text-sm text-cream">
                      {scorer.playerName}
                    </div>
                    <div className="text-xs text-cream/40">
                      {scorer.teamName}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span
                    className={`font-bold text-lg ${
                      i === 0 ? "text-wc-gold" : "text-cream/80"
                    }`}
                  >
                    {scorer.goals}
                  </span>
                  <span className="text-xs text-cream/40">goals</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Prediction Kings */}
      {data.predictionLeaderboard.length > 0 && (
        <div className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
          <div className="px-4 py-2 border-b border-dark-border bg-dark-border/30">
            <h2 className="font-serif font-bold text-wc-gold">
              {"🔮"} Prediction Kings
            </h2>
            <p className="text-xs text-cream/40">
              Ranked by prediction accuracy
            </p>
          </div>
          <div className="divide-y divide-dark-border/50">
            {data.predictionLeaderboard.map((player, i) => (
              <div
                key={player.playerName}
                className="px-4 py-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-6 text-center font-bold text-sm ${
                      i === 0 ? "text-wc-gold" : "text-cream/40"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span
                    className="font-medium text-sm"
                    style={{ color: player.color }}
                  >
                    {player.playerName}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-2 bg-dark-border rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${player.accuracy}%`,
                        backgroundColor:
                          i === 0 ? "#d4a843" : player.color,
                      }}
                    />
                  </div>
                  <span
                    className={`text-sm font-bold min-w-[50px] text-right ${
                      i === 0 ? "text-wc-gold" : "text-cream/70"
                    }`}
                  >
                    {player.accuracy}%
                  </span>
                  <span className="text-xs text-cream/40 min-w-[40px] text-right">
                    {player.correct}/{player.total}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tier Performance */}
      <div className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
        <div className="px-4 py-2 border-b border-dark-border bg-dark-border/30">
          <h2 className="font-serif font-bold text-wc-gold">
            Tier Performance
          </h2>
          <p className="text-xs text-cream/40">
            Points generated by each tier
          </p>
        </div>
        <div className="p-4 space-y-3">
          {data.tierBreakdown.map((tier) => (
            <div key={tier.tier}>
              <div className="flex items-center justify-between mb-1">
                <span
                  className="text-sm font-medium"
                  style={{ color: TIER_COLORS[tier.tier] ?? "#fff" }}
                >
                  T{tier.tier} &mdash; {tier.label}
                </span>
                <span
                  className="text-sm font-bold"
                  style={{ color: TIER_COLORS[tier.tier] ?? "#fff" }}
                >
                  {tier.points} pts
                </span>
              </div>
              <div className="h-3 bg-dark-border rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${(tier.points / maxTierPoints) * 100}%`,
                    backgroundColor: TIER_COLORS[tier.tier] ?? "#fff",
                    opacity: 0.8,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Records Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Biggest Win */}
        {data.biggestWin && (
          <div className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
            <div className="px-4 py-2 border-b border-dark-border bg-dark-border/30">
              <h3 className="font-serif font-bold text-wc-gold text-sm">
                Biggest Win
              </h3>
            </div>
            <div className="p-4 text-center">
              <div className="flex items-center justify-center gap-3 mb-2">
                <span className="text-xl">
                  {data.biggestWin.homeFlag}
                </span>
                <div>
                  <div className="font-bold text-2xl">
                    <span
                      className={
                        data.biggestWin.homeScore >
                        data.biggestWin.awayScore
                          ? "text-wc-gold"
                          : "text-cream/60"
                      }
                    >
                      {data.biggestWin.homeScore}
                    </span>
                    <span className="text-cream/30 mx-1">-</span>
                    <span
                      className={
                        data.biggestWin.awayScore >
                        data.biggestWin.homeScore
                          ? "text-wc-gold"
                          : "text-cream/60"
                      }
                    >
                      {data.biggestWin.awayScore}
                    </span>
                  </div>
                </div>
                <span className="text-xl">
                  {data.biggestWin.awayFlag}
                </span>
              </div>
              <div className="text-xs text-cream/40">
                {data.biggestWin.homeTeam} vs {data.biggestWin.awayTeam}
              </div>
              <div className="text-xs text-cream/30">{data.biggestWin.stage}</div>
            </div>
          </div>
        )}

        {/* Most Exciting */}
        {data.mostExciting && (
          <div className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
            <div className="px-4 py-2 border-b border-dark-border bg-dark-border/30">
              <h3 className="font-serif font-bold text-wc-gold text-sm">
                Most Exciting Match
              </h3>
            </div>
            <div className="p-4 text-center">
              <div className="flex items-center justify-center gap-3 mb-2">
                <span className="text-xl">
                  {data.mostExciting.homeFlag}
                </span>
                <div>
                  <div className="font-bold text-2xl">
                    <span className="text-wc-gold">
                      {data.mostExciting.homeScore}
                    </span>
                    <span className="text-cream/30 mx-1">-</span>
                    <span className="text-wc-gold">
                      {data.mostExciting.awayScore}
                    </span>
                  </div>
                </div>
                <span className="text-xl">
                  {data.mostExciting.awayFlag}
                </span>
              </div>
              <div className="text-xs text-cream/40">
                {data.mostExciting.homeTeam} vs{" "}
                {data.mostExciting.awayTeam}
              </div>
              <div className="text-xs text-cream/30">
                {data.mostExciting.stage} &middot;{" "}
                {data.mostExciting.homeScore + data.mostExciting.awayScore}{" "}
                total goals
              </div>
            </div>
          </div>
        )}

        {/* Fastest Goal */}
        {data.fastestGoal && (
          <div className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
            <div className="px-4 py-2 border-b border-dark-border bg-dark-border/30">
              <h3 className="font-serif font-bold text-wc-gold text-sm">
                Fastest Goal
              </h3>
            </div>
            <div className="p-4 text-center">
              <div className="font-serif text-3xl font-bold text-wc-gold mb-1">
                {data.fastestGoal.minute}&apos;
              </div>
              <div className="flex items-center justify-center gap-2">
                <span>{data.fastestGoal.flagEmoji}</span>
                <span className="text-sm font-medium text-cream">
                  {data.fastestGoal.playerName}
                </span>
              </div>
              <div className="text-xs text-cream/40 mt-1">
                {data.fastestGoal.matchLabel}
              </div>
            </div>
          </div>
        )}

        {/* Cards Total */}
        <div className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
          <div className="px-4 py-2 border-b border-dark-border bg-dark-border/30">
            <h3 className="font-serif font-bold text-wc-gold text-sm">
              Discipline
            </h3>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="font-bold text-2xl text-yellow-400">
                  {data.totalYellowCards}
                </div>
                <div className="text-xs text-cream/40">Yellow Cards</div>
              </div>
              <div>
                <div className="font-bold text-2xl text-red-400">
                  {data.totalRedCards}
                </div>
                <div className="text-xs text-cream/40">Red Cards</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Points Leader Timeline */}
      {data.leaderByDay.length > 0 && (
        <div className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
          <div className="px-4 py-2 border-b border-dark-border bg-dark-border/30">
            <h2 className="font-serif font-bold text-wc-gold">
              Points Leader Timeline
            </h2>
            <p className="text-xs text-cream/40">
              Who was leading after each match day
            </p>
          </div>
          <div className="overflow-x-auto">
            <div className="p-4 min-w-[400px]">
              <div className="space-y-1">
                {data.leaderByDay.map((day, i) => {
                  const prevLeader =
                    i > 0 ? data.leaderByDay[i - 1].leader : null;
                  const changed = day.leader !== prevLeader;
                  return (
                    <div
                      key={day.date}
                      className={`flex items-center justify-between text-sm py-1 px-2 rounded ${
                        changed ? "bg-dark-border/30" : ""
                      }`}
                    >
                      <span className="text-xs text-cream/40 w-24 shrink-0">
                        {new Date(day.date + "T00:00:00").toLocaleDateString(
                          undefined,
                          {
                            month: "short",
                            day: "numeric",
                          }
                        )}
                      </span>
                      <div className="flex items-center gap-2">
                        <span
                          className="font-medium"
                          style={{ color: day.color }}
                        >
                          {day.leader}
                        </span>
                        {changed && i > 0 && (
                          <span className="text-wc-gold text-xs">NEW</span>
                        )}
                      </div>
                      <span className="text-cream/60 font-bold text-sm w-16 text-right">
                        {day.points}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
