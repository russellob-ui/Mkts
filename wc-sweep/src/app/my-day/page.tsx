"use client";

import { useEffect, useState, useCallback } from "react";

interface PlayerInfo {
  id: number;
  name: string;
  slug: string;
  avatarEmoji: string | null;
  color: string | null;
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
  stage: string;
  venue: string | null;
  city: string | null;
  homeOwner: string | null;
  awayOwner: string | null;
  isYourTeam: boolean;
  yourTeamSide: "home" | "away" | null;
}

interface PointBreakdown {
  source: string;
  points: number;
  note: string | null;
  teamName: string;
  teamFlag: string;
}

interface TeamStatus {
  teamId: number;
  teamName: string;
  flagEmoji: string;
  tier: number;
  eliminated: boolean;
  isPlayingToday: boolean;
  playedYesterday: boolean;
  playsTomorrow: boolean;
}

interface BanterItem {
  id: number;
  eventType: string;
  headline: string;
  detail: string | null;
  emoji: string | null;
  importance: number;
  teamName: string | null;
  teamFlag: string | null;
  createdAt: string;
}

interface MyDayData {
  player: PlayerInfo;
  rank: number;
  totalPoints: number;
  totalPlayers: number;
  todayMatches: MatchCard[];
  yesterdayMatches: MatchCard[];
  tomorrowMatches: MatchCard[];
  todayPoints: {
    total: number;
    breakdown: PointBreakdown[];
  };
  nextMatch: MatchCard | null;
  nextMatchCountdownMs: number | null;
  upcomingMatches: MatchCard[];
  yourTeams: TeamStatus[];
  recentBanter: BanterItem[];
}

interface PlayerOption {
  slug: string;
  name: string;
}

const TIER_LABELS: Record<number, string> = {
  1: "Elite",
  2: "Strong",
  3: "Mid",
  4: "Underdog",
};

function formatCountdown(ms: number): string {
  if (ms <= 0) return "Now";
  const hours = Math.floor(ms / 3_600_000);
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function rankBadge(rank: number): string {
  if (rank === 1) return "1st";
  if (rank === 2) return "2nd";
  if (rank === 3) return "3rd";
  return `${rank}th`;
}

export default function MyDayPage() {
  const [playerSlug, setPlayerSlug] = useState<string>("");
  const [allPlayers, setAllPlayers] = useState<PlayerOption[]>([]);
  const [data, setData] = useState<MyDayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState<string>("");

  // Load players list from leaderboard
  useEffect(() => {
    async function loadPlayers() {
      try {
        const res = await fetch("/api/leaderboard");
        if (res.ok) {
          const json = await res.json();
          const pList: PlayerOption[] = (json.leaderboard ?? []).map(
            (e: { playerId: number; playerName: string }) => ({
              slug: e.playerName.toLowerCase().replace(/\s+/g, "-"),
              name: e.playerName,
            })
          );
          setAllPlayers(pList);

          // Restore from localStorage
          const saved = localStorage.getItem("wc_my_day_player");
          if (saved && pList.some((p) => p.slug === saved)) {
            setPlayerSlug(saved);
          } else if (pList.length > 0) {
            setPlayerSlug(pList[0].slug);
          }
        }
      } catch {
        // API not ready
      } finally {
        setLoading(false);
      }
    }
    loadPlayers();
  }, []);

  const loadData = useCallback(async () => {
    if (!playerSlug) return;
    try {
      const res = await fetch(`/api/my-day?playerSlug=${encodeURIComponent(playerSlug)}`);
      if (res.ok) {
        const json: MyDayData = await res.json();
        setData(json);
      }
    } catch {
      // silently retry on next poll
    }
  }, [playerSlug]);

  useEffect(() => {
    if (!playerSlug) return;
    setLoading(true);
    loadData().finally(() => setLoading(false));
    const interval = setInterval(loadData, 30_000);
    return () => clearInterval(interval);
  }, [playerSlug, loadData]);

  // Countdown timer
  useEffect(() => {
    if (!data?.nextMatchCountdownMs) {
      setCountdown("");
      return;
    }
    const startMs = data.nextMatchCountdownMs;
    const loadedAt = Date.now();
    function tick() {
      const elapsed = Date.now() - loadedAt;
      const remaining = startMs - elapsed;
      setCountdown(formatCountdown(remaining > 0 ? remaining : 0));
    }
    tick();
    const interval = setInterval(tick, 30_000);
    return () => clearInterval(interval);
  }, [data?.nextMatchCountdownMs]);

  function handlePlayerChange(slug: string) {
    setPlayerSlug(slug);
    localStorage.setItem("wc_my_day_player", slug);
  }

  if (loading && !data) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center text-cream/40">
        Loading your briefing...
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Player Selector */}
      <div className="flex items-center gap-3">
        <select
          value={playerSlug}
          onChange={(e) => handlePlayerChange(e.target.value)}
          className="bg-dark-card border border-dark-border rounded-lg px-3 py-2 text-cream text-sm flex-1 focus:outline-none focus:border-wc-gold"
        >
          {allPlayers.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {data && (
        <>
          {/* Greeting + Rank */}
          <div className="text-center space-y-2">
            <h1 className="font-serif text-2xl font-bold">
              {getGreeting()},{" "}
              <span className="text-wc-gold">{data.player.name}</span>
            </h1>
            <div className="flex items-center justify-center gap-3">
              <span className="inline-flex items-center gap-1.5 bg-wc-gold/20 border border-wc-gold/30 text-wc-gold px-3 py-1 rounded-full text-sm font-semibold">
                {rankBadge(data.rank)} of {data.totalPlayers}
              </span>
              <span className="text-lg font-bold text-wc-gold">
                {data.totalPoints.toFixed(1)} pts
              </span>
            </div>
          </div>

          {/* Your Teams */}
          <section>
            <h2 className="text-xs font-semibold text-cream/50 uppercase tracking-wider mb-2">
              Your Teams
            </h2>
            <div className="flex flex-wrap gap-2">
              {data.yourTeams.map((t) => (
                <div
                  key={t.teamId}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm border ${
                    t.eliminated
                      ? "bg-dark-card/50 border-dark-border/50 text-cream/30 line-through"
                      : t.isPlayingToday
                        ? "bg-wc-gold/15 border-wc-gold/40 text-wc-gold"
                        : "bg-dark-card border-dark-border text-cream/70"
                  }`}
                >
                  <span>{t.flagEmoji}</span>
                  <span className="font-medium">{t.teamName}</span>
                  <span className={`text-xs ${t.eliminated ? "text-cream/20" : "text-cream/40"}`}>
                    T{t.tier}
                  </span>
                  {t.isPlayingToday && (
                    <span className="live-dot inline-block w-1.5 h-1.5 rounded-full bg-wc-gold ml-1" />
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* TODAY section */}
          <section>
            <h2 className="text-xs font-semibold text-cream/50 uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="live-dot inline-block w-2 h-2 rounded-full bg-red-500" />
              Today
            </h2>
            {data.todayMatches.length === 0 ? (
              <div className="bg-dark-card border border-dark-border rounded-lg p-4 text-center text-cream/40 text-sm">
                None of your teams play today
                {data.nextMatch && countdown && (
                  <div className="mt-2 text-cream/60">
                    Next up in <span className="text-wc-gold font-semibold">{countdown}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {data.todayMatches.map((m) => (
                  <div
                    key={m.id}
                    className="bg-dark-card border border-wc-gold/20 rounded-lg p-3"
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
                          {countdown && m.id === data.nextMatch?.id && (
                            <span className="ml-1 text-wc-gold">({countdown})</span>
                          )}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-lg">{m.homeFlag}</span>
                        <div>
                          <div
                            className={`font-semibold text-sm ${
                              m.yourTeamSide === "home" ? "text-wc-gold" : ""
                            }`}
                          >
                            {m.homeTeam}
                          </div>
                        </div>
                      </div>
                      <div className="text-xl font-bold px-4 font-mono">
                        {m.homeScore ?? "-"} - {m.awayScore ?? "-"}
                      </div>
                      <div className="flex items-center gap-2 flex-1 justify-end text-right">
                        <div>
                          <div
                            className={`font-semibold text-sm ${
                              m.yourTeamSide === "away" ? "text-wc-gold" : ""
                            }`}
                          >
                            {m.awayTeam}
                          </div>
                        </div>
                        <span className="text-lg">{m.awayFlag}</span>
                      </div>
                    </div>
                    {m.venue && (
                      <div className="text-xs text-cream/30 mt-1 text-center">
                        {m.venue}, {m.city}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* YOUR POINTS TODAY */}
          <section>
            <h2 className="text-xs font-semibold text-cream/50 uppercase tracking-wider mb-3">
              Your Points Today
            </h2>
            <div className="bg-dark-card border border-dark-border rounded-lg p-4">
              <div className="text-center mb-3">
                <span className="text-3xl font-bold text-wc-gold font-mono">
                  +{data.todayPoints.total.toFixed(1)}
                </span>
                <span className="text-cream/40 text-sm ml-1">pts</span>
              </div>
              {data.todayPoints.breakdown.length > 0 ? (
                <div className="space-y-1.5">
                  {data.todayPoints.breakdown.map((b, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-sm"
                    >
                      <div className="flex items-center gap-2 text-cream/70">
                        <span>{b.teamFlag}</span>
                        <span>{b.note ?? b.source}</span>
                      </div>
                      <span className="text-wc-gold font-semibold">
                        +{b.points.toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-cream/30 text-sm">
                  No points yet today
                </div>
              )}
            </div>
          </section>

          {/* COMING UP */}
          {data.upcomingMatches.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-cream/50 uppercase tracking-wider mb-3">
                Coming Up
              </h2>
              <div className="space-y-2">
                {data.upcomingMatches.map((m) => (
                  <div
                    key={m.id}
                    className="bg-dark-card border border-dark-border rounded-lg p-3 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span>{m.homeFlag}</span>
                      <span
                        className={`text-sm font-medium ${
                          m.yourTeamSide === "home" ? "text-wc-gold" : "text-cream/80"
                        }`}
                      >
                        {m.homeTeam}
                      </span>
                      <span className="text-cream/30 text-xs">vs</span>
                      <span
                        className={`text-sm font-medium ${
                          m.yourTeamSide === "away" ? "text-wc-gold" : "text-cream/80"
                        }`}
                      >
                        {m.awayTeam}
                      </span>
                      <span>{m.awayFlag}</span>
                    </div>
                    <div className="text-right text-xs text-cream/50">
                      <div>
                        {new Date(m.kickoff).toLocaleDateString("en-GB", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}
                      </div>
                      <div>
                        {new Date(m.kickoff).toLocaleTimeString("en-GB", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* RECENT ACTION */}
          {data.recentBanter.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-cream/50 uppercase tracking-wider mb-3">
                Recent Action
              </h2>
              <div className="space-y-1.5">
                {data.recentBanter.slice(0, 5).map((b) => (
                  <div
                    key={b.id}
                    className="bg-dark-card border border-dark-border rounded-lg px-3 py-2 flex items-start gap-2"
                  >
                    <span className="text-lg shrink-0">{b.emoji ?? "📢"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-cream/90">
                        {b.headline}
                      </div>
                      {b.detail && (
                        <div className="text-xs text-cream/40 mt-0.5 truncate">
                          {b.detail}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-cream/30 whitespace-nowrap shrink-0">
                      {timeAgo(b.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}
