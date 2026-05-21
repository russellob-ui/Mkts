"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";

// ---- Types ----

interface LeaderboardEntry {
  playerId: number;
  playerName: string;
  playerSlug: string;
  avatarEmoji: string | null;
  color: string;
  gamePoints: number;
  predictionPoints: number;
  quizPoints: number;
  propPoints: number;
  otherPoints: number;
  totalPoints: number;
  teamsAlive: number;
  teamsTotal: number;
  rankChange: number;
  trend: "hot" | "cold" | "steady";
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
  venue?: string;
  city?: string;
}

interface LiveMatch {
  id: number;
  homeTeam: string;
  homeFlag: string;
  awayTeam: string;
  awayFlag: string;
  homeScore: number;
  awayScore: number;
  minute: number;
  homeOwner: string | null;
  awayOwner: string | null;
}

interface NextMatch {
  homeTeam: string;
  homeFlag: string;
  awayTeam: string;
  awayFlag: string;
  kickoff: string;
  homeOwner: string | null;
  awayOwner: string | null;
  stage: string;
}

interface TodayPoints {
  playerId: number;
  playerName: string;
  points: number;
}

interface ActivityItem {
  type: "banter" | "chat" | "prediction" | "quiz";
  emoji: string;
  text: string;
  timeAgo: string;
}

interface FeaturedStat {
  emoji: string;
  text: string;
}

interface PendingActions {
  matchesToPredict: number;
  quizAvailable: boolean;
  propsAvailable: boolean;
}

interface ApiData {
  leaderboard: LeaderboardEntry[];
  todayMatches: MatchCard[];
  nextMatch: NextMatch | null;
  liveMatch: LiveMatch | null;
  todayPointsByPlayer: TodayPoints[];
  featuredStat: FeaturedStat | null;
  recentActivity: ActivityItem[];
  pendingActions: PendingActions;
  upcomingMatches: MatchCard[];
}

// ---- Helpers ----

function formatCountdown(ms: number): string {
  if (ms <= 0) return "Starting soon";
  const totalSecs = Math.floor(ms / 1000);
  const days = Math.floor(totalSecs / 86400);
  const hrs = Math.floor((totalSecs % 86400) / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  if (days > 0) return `${days}d ${hrs}h ${mins}m`;
  if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
  return `${mins}m ${secs}s`;
}

function medalEmoji(rank: number): string {
  if (rank === 1) return "\u{1F947}";
  if (rank === 2) return "\u{1F948}";
  if (rank === 3) return "\u{1F949}";
  return "";
}

const activityBg: Record<string, string> = {
  banter: "bg-blue-500/10 border-blue-500/20",
  chat: "bg-white/5 border-white/10",
  prediction: "bg-yellow-500/10 border-yellow-500/20",
  quiz: "bg-green-500/10 border-green-500/20",
};

// ---- Components ----

function HeroBar({
  liveMatch,
  nextMatch,
  todayMatches,
}: {
  liveMatch: LiveMatch | null;
  nextMatch: NextMatch | null;
  todayMatches: MatchCard[];
}) {
  const [countdown, setCountdown] = useState("");

  useEffect(() => {
    if (liveMatch || !nextMatch) return;
    const target = new Date(nextMatch.kickoff).getTime();
    function tick() {
      setCountdown(formatCountdown(target - Date.now()));
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [liveMatch, nextMatch]);

  // Live match
  if (liveMatch) {
    return (
      <div className="bg-gradient-to-r from-red-900/60 via-dark-card to-red-900/60 border border-red-500/30 rounded-xl p-4">
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="live-dot inline-block w-2.5 h-2.5 rounded-full bg-red-500" />
          <span className="text-red-400 font-semibold text-xs uppercase tracking-wider">
            Live &middot; {liveMatch.minute}&apos;
          </span>
        </div>
        <div className="flex items-center justify-center gap-4">
          <div className="text-center flex-1">
            <div className="text-2xl mb-0.5">{liveMatch.homeFlag}</div>
            <div className="text-sm font-semibold truncate">
              {liveMatch.homeTeam}
            </div>
            {liveMatch.homeOwner && (
              <div className="text-[10px] text-cream/40">
                {liveMatch.homeOwner}
              </div>
            )}
          </div>
          <div className="text-3xl font-bold font-mono text-wc-gold px-3">
            {liveMatch.homeScore} - {liveMatch.awayScore}
          </div>
          <div className="text-center flex-1">
            <div className="text-2xl mb-0.5">{liveMatch.awayFlag}</div>
            <div className="text-sm font-semibold truncate">
              {liveMatch.awayTeam}
            </div>
            {liveMatch.awayOwner && (
              <div className="text-[10px] text-cream/40">
                {liveMatch.awayOwner}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Upcoming match with countdown
  if (nextMatch) {
    return (
      <div className="bg-gradient-to-r from-wc-blue/40 via-dark-card to-wc-blue/40 border border-dark-border rounded-xl p-4">
        <div className="text-center mb-2">
          <span className="text-cream/50 text-xs uppercase tracking-wider">
            Next Kick-Off
          </span>
        </div>
        <div className="flex items-center justify-center gap-4">
          <div className="text-center flex-1">
            <div className="text-2xl mb-0.5">{nextMatch.homeFlag}</div>
            <div className="text-sm font-semibold truncate">
              {nextMatch.homeTeam}
            </div>
            {nextMatch.homeOwner && (
              <div className="text-[10px] text-cream/40">
                {nextMatch.homeOwner}
              </div>
            )}
          </div>
          <div className="text-center px-3">
            <div className="text-2xl font-bold font-mono text-wc-gold">
              {countdown}
            </div>
            <div className="text-[10px] text-cream/40 mt-0.5">
              {nextMatch.stage}
            </div>
          </div>
          <div className="text-center flex-1">
            <div className="text-2xl mb-0.5">{nextMatch.awayFlag}</div>
            <div className="text-sm font-semibold truncate">
              {nextMatch.awayTeam}
            </div>
            {nextMatch.awayOwner && (
              <div className="text-[10px] text-cream/40">
                {nextMatch.awayOwner}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Rest day
  return (
    <div className="bg-gradient-to-r from-dark-card via-dark-card to-dark-card border border-dark-border rounded-xl p-4 text-center">
      <div className="text-cream/50 text-sm">
        {todayMatches.length === 0
          ? "No matches today"
          : "All matches finished for today"}
      </div>
      <div className="text-cream/30 text-xs mt-1">
        Check back tomorrow for more action
      </div>
    </div>
  );
}

function MatchCardComponent({ m }: { m: MatchCard }) {
  return (
    <div className="bg-dark-card border border-dark-border rounded-lg p-3">
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
            <div className="font-semibold text-sm">{m.homeTeam}</div>
            {m.homeOwner && (
              <div className="text-xs text-cream/40">{m.homeOwner}</div>
            )}
          </div>
        </div>
        <div className="text-xl font-bold px-4 font-mono">
          {m.homeScore ?? "-"} - {m.awayScore ?? "-"}
        </div>
        <div className="flex items-center gap-2 flex-1 justify-end text-right">
          <div>
            <div className="font-semibold text-sm">{m.awayTeam}</div>
            {m.awayOwner && (
              <div className="text-xs text-cream/40">{m.awayOwner}</div>
            )}
          </div>
          <span className="text-lg">{m.awayFlag}</span>
        </div>
      </div>
    </div>
  );
}

// ---- Main Page ----

export default function Home() {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/leaderboard");
      if (res.ok && mountedRef.current) {
        const json: ApiData = await res.json();
        setData(json);
      }
    } catch {
      // API not ready
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    load();
    const interval = setInterval(load, 30_000);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [load]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center text-cream/40">
        Loading...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center text-cream/40">
        Unable to load data. Try refreshing.
      </div>
    );
  }

  const {
    leaderboard,
    todayMatches,
    nextMatch,
    liveMatch,
    todayPointsByPlayer,
    featuredStat,
    recentActivity,
    pendingActions,
    upcomingMatches,
  } = data;

  const maxTodayPts = todayPointsByPlayer.length > 0
    ? Math.max(...todayPointsByPlayer.map((p) => p.points))
    : 0;

  // Look up player color from leaderboard for the points bars
  const playerColorMap = new Map(
    leaderboard.map((e) => [e.playerId, e.color])
  );

  const hasPendingActions =
    pendingActions.matchesToPredict > 0 ||
    pendingActions.quizAvailable ||
    pendingActions.propsAvailable;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-1">
        <h1 className="font-serif text-3xl font-bold">
          <span className="text-wc-gold">World Cup</span> Sweep
        </h1>
        <p className="text-cream/50 text-sm">
          FIFA World Cup 2026 &middot; USA / Canada / Mexico
        </p>
      </div>

      {/* Hero Status Bar */}
      <HeroBar
        liveMatch={liveMatch}
        nextMatch={nextMatch}
        todayMatches={todayMatches}
      />

      {/* Today's Matches */}
      {todayMatches.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-cream/60 uppercase tracking-wider mb-3">
            Today&apos;s Matches
          </h2>
          <div className="space-y-2">
            {todayMatches.map((m) => (
              <MatchCardComponent key={m.id} m={m} />
            ))}
          </div>
        </section>
      )}

      {/* Quick Actions */}
      {hasPendingActions && (
        <section>
          <div className="flex gap-2">
            {pendingActions.matchesToPredict > 0 && (
              <Link
                href="/predictions"
                className="flex-1 bg-dark-card border border-dark-border rounded-lg px-3 py-2.5 text-center hover:border-wc-gold/40 transition-colors"
              >
                <div className="text-lg mb-0.5">{"\u{1F3AF}"}</div>
                <div className="text-xs text-cream/70">Predictions</div>
                <span className="inline-block mt-1 text-[10px] bg-wc-gold/20 text-wc-gold rounded-full px-2 py-0.5 font-semibold">
                  {pendingActions.matchesToPredict}
                </span>
              </Link>
            )}
            {pendingActions.quizAvailable && (
              <Link
                href="/quiz"
                className="flex-1 bg-dark-card border border-dark-border rounded-lg px-3 py-2.5 text-center hover:border-wc-gold/40 transition-colors"
              >
                <div className="text-lg mb-0.5">{"\u{1F9E0}"}</div>
                <div className="text-xs text-cream/70">Quiz</div>
              </Link>
            )}
            {pendingActions.propsAvailable && (
              <Link
                href="/props"
                className="flex-1 bg-dark-card border border-dark-border rounded-lg px-3 py-2.5 text-center hover:border-wc-gold/40 transition-colors"
              >
                <div className="text-lg mb-0.5">{"\u{1F4CA}"}</div>
                <div className="text-xs text-cream/70">Props</div>
              </Link>
            )}
          </div>
        </section>
      )}

      {/* Leaderboard */}
      <section>
        <h2 className="text-sm font-semibold text-cream/60 uppercase tracking-wider mb-3">
          Leaderboard
        </h2>
        {leaderboard.length === 0 ? (
          <div className="bg-dark-card border border-dark-border rounded-lg p-6 text-center text-cream/40">
            No players yet. Join the sweep to get started!
          </div>
        ) : (
          <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[2rem_1fr_3.5rem_3.5rem] sm:grid-cols-[2rem_1fr_3.5rem_3.5rem_3.5rem_3.5rem_4rem_2.5rem] gap-x-1 px-3 py-2 text-[10px] text-cream/40 uppercase tracking-wider border-b border-dark-border font-semibold">
              <span>#</span>
              <span>Player</span>
              <span className="text-right">Game</span>
              <span className="text-right hidden sm:block">Pred</span>
              <span className="text-right hidden sm:block">Quiz</span>
              <span className="text-right hidden sm:block">Props</span>
              <span className="text-right">Total</span>
              <span className="text-center">{""}</span>
            </div>
            {/* Table rows */}
            {leaderboard.map((entry, i) => {
              const rank = i + 1;
              const medal = medalEmoji(rank);
              return (
                <Link
                  key={entry.playerId}
                  href={`/player/${entry.playerSlug}`}
                  className="grid grid-cols-[2rem_1fr_3.5rem_3.5rem] sm:grid-cols-[2rem_1fr_3.5rem_3.5rem_3.5rem_3.5rem_4rem_2.5rem] gap-x-1 px-3 py-2.5 items-center hover:bg-white/5 transition-colors border-b border-dark-border/50 last:border-b-0"
                >
                  {/* Rank */}
                  <span className="text-sm font-bold text-cream/30">
                    {medal || rank}
                  </span>

                  {/* Player info */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="text-sm font-semibold truncate">
                      {entry.avatarEmoji && (
                        <span className="mr-1">{entry.avatarEmoji}</span>
                      )}
                      {entry.playerName}
                    </span>
                    {entry.teamsTotal > 0 && (
                      <span className="text-[10px] bg-dark-border/70 text-cream/50 rounded px-1 py-0.5 shrink-0">
                        {entry.teamsAlive}/{entry.teamsTotal}
                      </span>
                    )}
                  </div>

                  {/* Game points */}
                  <span className="text-right text-sm text-cream/70 tabular-nums">
                    {entry.gamePoints.toFixed(1)}
                  </span>

                  {/* Prediction (desktop) */}
                  <span className="text-right text-sm text-cream/70 tabular-nums hidden sm:block">
                    {entry.predictionPoints.toFixed(1)}
                  </span>

                  {/* Quiz (desktop) */}
                  <span className="text-right text-sm text-cream/70 tabular-nums hidden sm:block">
                    {entry.quizPoints.toFixed(1)}
                  </span>

                  {/* Props (desktop) */}
                  <span className="text-right text-sm text-cream/70 tabular-nums hidden sm:block">
                    {entry.propPoints.toFixed(1)}
                  </span>

                  {/* Total */}
                  <span
                    className={`text-right text-sm font-bold tabular-nums ${
                      rank === 1 ? "text-wc-gold" : "text-cream"
                    }`}
                  >
                    {entry.totalPoints.toFixed(1)}
                  </span>

                  {/* Trend + rank change */}
                  <span className="text-center text-sm">
                    {entry.trend === "hot" ? (
                      <span className="text-red-400">{"\u{1F525}"}</span>
                    ) : entry.trend === "cold" ? (
                      <span className="text-blue-300">{"\u{2744}\u{FE0F}"}</span>
                    ) : (
                      <span className="text-cream/30">{"\u{27A1}\u{FE0F}"}</span>
                    )}
                    {entry.rankChange > 0 && (
                      <span className="text-[10px] text-green-400 ml-0.5">
                        {"\u{2191}"}{entry.rankChange}
                      </span>
                    )}
                    {entry.rankChange < 0 && (
                      <span className="text-[10px] text-red-400 ml-0.5">
                        {"\u{2193}"}{Math.abs(entry.rankChange)}
                      </span>
                    )}
                    {entry.rankChange === 0 && (
                      <span className="text-[10px] text-cream/20 ml-0.5">
                        &mdash;
                      </span>
                    )}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Points Today */}
      {todayPointsByPlayer.length > 0 && maxTodayPts > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-cream/60 uppercase tracking-wider mb-3">
            Points Today
          </h2>
          <div className="bg-dark-card border border-dark-border rounded-xl p-3 space-y-2">
            {todayPointsByPlayer.map((p) => {
              const pct = maxTodayPts > 0 ? (p.points / maxTodayPts) * 100 : 0;
              const barColor = playerColorMap.get(p.playerId) ?? "#d4a843";
              return (
                <div key={p.playerId} className="flex items-center gap-3">
                  <span className="text-sm w-20 truncate text-cream/80">
                    {p.playerName}
                  </span>
                  <span className="text-xs font-mono text-wc-gold w-10 text-right">
                    +{p.points.toFixed(1)}
                  </span>
                  <div className="flex-1 h-4 bg-dark-border/50 rounded-sm overflow-hidden">
                    <div
                      className="h-full rounded-sm transition-all duration-500"
                      style={{
                        width: `${Math.max(pct, 4)}%`,
                        backgroundColor: barColor,
                        opacity: 0.7,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Live Feed */}
      {recentActivity.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-cream/60 uppercase tracking-wider mb-3">
            Live Feed
          </h2>
          <div className="space-y-1.5">
            {recentActivity.map((item, i) => (
              <div
                key={i}
                className={`border rounded-lg px-3 py-2 flex items-center gap-2.5 ${
                  activityBg[item.type] ?? "bg-dark-card border-dark-border"
                }`}
              >
                <span className="text-base shrink-0">{item.emoji}</span>
                <span className="text-sm text-cream/80 flex-1 min-w-0 truncate">
                  {item.text}
                </span>
                <span className="text-[10px] text-cream/30 shrink-0 whitespace-nowrap">
                  {item.timeAgo}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Featured Stat */}
      {featuredStat && (
        <section>
          <div className="border border-wc-gold/30 bg-wc-gold/5 rounded-xl p-4 text-center">
            <div className="text-3xl mb-2">{featuredStat.emoji}</div>
            <div className="text-sm text-cream/80">{featuredStat.text}</div>
          </div>
        </section>
      )}

      {/* Coming Up */}
      {upcomingMatches.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-cream/60 uppercase tracking-wider mb-3">
            Coming Up
          </h2>
          <div className="space-y-2">
            {upcomingMatches.map((m) => (
              <div
                key={m.id}
                className="bg-dark-card border border-dark-border rounded-lg p-3"
              >
                <div className="flex items-center justify-between text-xs text-cream/50 mb-2">
                  <span>{m.stage}</span>
                  <span>
                    {new Date(m.kickoff).toLocaleDateString("en-GB", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}{" "}
                    {new Date(m.kickoff).toLocaleTimeString("en-GB", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-lg">{m.homeFlag}</span>
                    <div>
                      <div className="font-semibold text-sm">{m.homeTeam}</div>
                      {m.homeOwner && (
                        <div className="text-xs text-cream/40">
                          {m.homeOwner}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-cream/30 px-4">vs</div>
                  <div className="flex items-center gap-2 flex-1 justify-end text-right">
                    <div>
                      <div className="font-semibold text-sm">{m.awayTeam}</div>
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

      {/* Bottom spacer for nav */}
      <div className="h-4" />
    </div>
  );
}
