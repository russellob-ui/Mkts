"use client";

import { useEffect, useState } from "react";

interface TeamInfo {
  teamId: number;
  teamName: string;
  flagEmoji: string;
  tier: number;
  points: number;
  eliminated: boolean;
}

interface PredictionStats {
  total: number;
  correct: number;
  accuracy: number;
}

interface PlayerRivalry {
  id: number;
  name: string;
  slug: string;
  color: string;
  totalPoints: number;
  teams: TeamInfo[];
  alive: number;
  eliminated: number;
  predictions: PredictionStats;
}

interface HeadToHeadMatch {
  matchId: number;
  homeTeam: string;
  awayTeam: string;
  homeFlag: string;
  awayFlag: string;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  stage: string;
  kickoff: string;
  p1Side: "home" | "away";
  p2Side: "home" | "away";
  p1Won: boolean | null;
  p2Won: boolean | null;
}

interface RivalryData {
  player1: PlayerRivalry;
  player2: PlayerRivalry;
  headToHead: HeadToHeadMatch[];
}

interface H2HMatch {
  matchId: number;
  homeTeam: string;
  awayTeam: string;
  homeFlag: string;
  awayFlag: string;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  stage: string;
  kickoff: string;
  p1Side: "home" | "away";
  p2Side: "home" | "away";
  p1TeamName: string;
  p2TeamName: string;
  p1Flag: string;
  p2Flag: string;
  p1Points: number;
  p2Points: number;
  p1Won: boolean | null;
  p2Won: boolean | null;
}

interface H2HData {
  h2h: {
    player1: { id: number; name: string; slug: string; color: string; totalH2HPoints: number };
    player2: { id: number; name: string; slug: string; color: string; totalH2HPoints: number };
    matches: H2HMatch[];
    summary: { p1Wins: number; p2Wins: number; draws: number };
  };
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

const TIER_COLORS: Record<number, string> = {
  1: "#ffd700",
  2: "#c0c0c0",
  3: "#cd7f32",
  4: "#22c55e",
};

export default function RivalryPage() {
  const [playerList, setPlayerList] = useState<PlayerOption[]>([]);
  const [slug1, setSlug1] = useState("");
  const [slug2, setSlug2] = useState("");
  const [data, setData] = useState<RivalryData | null>(null);
  const [h2hData, setH2hData] = useState<H2HData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load player list from leaderboard
  useEffect(() => {
    async function loadPlayers() {
      try {
        const res = await fetch("/api/leaderboard");
        if (res.ok) {
          const json = await res.json();
          const list = (json.leaderboard ?? []).map(
            (p: { playerName: string; playerId: number }) => ({
              slug: p.playerName.toLowerCase().replace(/\s+/g, "-"),
              name: p.playerName,
            })
          );
          setPlayerList(list);
        }
      } catch {}
    }
    loadPlayers();
  }, []);

  // Fetch rivalry data when both players are selected
  useEffect(() => {
    if (!slug1 || !slug2 || slug1 === slug2) {
      setData(null);
      setH2hData(null);
      return;
    }
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [rivalryRes, h2hRes] = await Promise.all([
          fetch(
            `/api/rivalry?player1=${encodeURIComponent(slug1)}&player2=${encodeURIComponent(slug2)}`
          ),
          fetch(
            `/api/h2h?player1=${encodeURIComponent(slug1)}&player2=${encodeURIComponent(slug2)}`
          ),
        ]);
        if (!rivalryRes.ok) {
          const err = await rivalryRes.json().catch(() => ({}));
          setError(err.error ?? `API returned ${rivalryRes.status}`);
          setData(null);
          setH2hData(null);
        } else {
          const json = await rivalryRes.json();
          if (!cancelled) setData(json);
        }
        if (h2hRes.ok) {
          const h2hJson = await h2hRes.json();
          if (!cancelled) setH2hData(h2hJson);
        }
      } catch (err) {
        if (!cancelled) setError(String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [slug1, slug2]);

  function goldIfLeader(val1: number, val2: number, side: 1 | 2): string {
    if (val1 === val2) return "text-cream";
    if (side === 1) return val1 > val2 ? "text-wc-gold" : "text-cream/60";
    return val2 > val1 ? "text-wc-gold" : "text-cream/60";
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="font-serif text-3xl font-bold">
          <span className="text-wc-gold">Head-to-Head</span> Rivalry
        </h1>
        <p className="text-cream/50 text-sm">
          Compare two players side-by-side
        </p>
      </div>

      {/* Player Selectors */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-cream/40 mb-1">Player 1</label>
          <select
            value={slug1}
            onChange={(e) => setSlug1(e.target.value)}
            className="w-full bg-dark-card border border-dark-border rounded-lg px-3 py-2 text-cream text-sm focus:outline-none focus:border-wc-gold"
          >
            <option value="">Select player...</option>
            {playerList.map((p) => (
              <option key={p.slug} value={p.slug} disabled={p.slug === slug2}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-cream/40 mb-1">Player 2</label>
          <select
            value={slug2}
            onChange={(e) => setSlug2(e.target.value)}
            className="w-full bg-dark-card border border-dark-border rounded-lg px-3 py-2 text-cream text-sm focus:outline-none focus:border-wc-gold"
          >
            <option value="">Select player...</option>
            {playerList.map((p) => (
              <option key={p.slug} value={p.slug} disabled={p.slug === slug1}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && (
        <div className="text-center py-12 text-cream/40">Loading...</div>
      )}

      {error && (
        <div className="bg-dark-card border border-red-500 rounded-lg p-4 text-center text-red-400 text-sm">
          {error}
        </div>
      )}

      {!slug1 || !slug2 ? (
        <div className="bg-dark-card border border-dark-border rounded-lg p-8 text-center text-cream/40">
          Select two players above to compare
        </div>
      ) : slug1 === slug2 ? (
        <div className="bg-dark-card border border-dark-border rounded-lg p-8 text-center text-cream/40">
          Select two different players
        </div>
      ) : null}

      {data && (
        <>
          {/* Total Points Comparison */}
          <div className="bg-dark-card border border-dark-border rounded-lg p-6">
            <div className="grid grid-cols-3 items-center">
              <div className="text-center">
                <div className="text-xs text-cream/40 mb-1">
                  {data.player1.name}
                </div>
                <div
                  className={`font-serif text-4xl font-bold ${goldIfLeader(data.player1.totalPoints, data.player2.totalPoints, 1)}`}
                >
                  {data.player1.totalPoints}
                </div>
              </div>
              <div className="text-center text-cream/30 text-sm font-medium">
                TOTAL POINTS
              </div>
              <div className="text-center">
                <div className="text-xs text-cream/40 mb-1">
                  {data.player2.name}
                </div>
                <div
                  className={`font-serif text-4xl font-bold ${goldIfLeader(data.player1.totalPoints, data.player2.totalPoints, 2)}`}
                >
                  {data.player2.totalPoints}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: "Teams Alive",
                v1: data.player1.alive,
                v2: data.player2.alive,
              },
              {
                label: "Eliminated",
                v1: data.player1.eliminated,
                v2: data.player2.eliminated,
                invert: true,
              },
              {
                label: "Pred. Accuracy",
                v1: data.player1.predictions.accuracy,
                v2: data.player2.predictions.accuracy,
                suffix: "%",
              },
              {
                label: "Correct Preds",
                v1: data.player1.predictions.correct,
                v2: data.player2.predictions.correct,
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="bg-dark-card border border-dark-border rounded-lg p-3 text-center"
              >
                <div className="text-xs text-cream/40 mb-2">{stat.label}</div>
                <div className="flex justify-between items-center px-2">
                  <span
                    className={`text-lg font-bold ${stat.invert ? goldIfLeader(stat.v2, stat.v1, 1) : goldIfLeader(stat.v1, stat.v2, 1)}`}
                  >
                    {stat.v1}
                    {stat.suffix ?? ""}
                  </span>
                  <span className="text-cream/20 text-xs">vs</span>
                  <span
                    className={`text-lg font-bold ${stat.invert ? goldIfLeader(stat.v2, stat.v1, 2) : goldIfLeader(stat.v1, stat.v2, 2)}`}
                  >
                    {stat.v2}
                    {stat.suffix ?? ""}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Teams Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[data.player1, data.player2].map((player) => (
              <div
                key={player.id}
                className="bg-dark-card border border-dark-border rounded-lg overflow-hidden"
              >
                <div className="px-4 py-2 border-b border-dark-border bg-dark-border/30 flex items-center justify-between">
                  <h3
                    className="font-serif font-bold"
                    style={{ color: player.color }}
                  >
                    {player.name}&apos;s Teams
                  </h3>
                  <span className="text-wc-gold font-bold text-sm">
                    {player.totalPoints} pts
                  </span>
                </div>
                <div className="divide-y divide-dark-border/50">
                  {player.teams.map((team) => (
                    <div
                      key={team.teamId}
                      className={`px-4 py-2 flex items-center justify-between ${team.eliminated ? "opacity-50" : ""}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{team.flagEmoji}</span>
                        <span className="font-medium text-sm">
                          {team.teamName}
                        </span>
                        <span
                          className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                          style={{
                            color: TIER_COLORS[team.tier] ?? "#fff",
                            backgroundColor: `${TIER_COLORS[team.tier] ?? "#fff"}20`,
                          }}
                        >
                          {TIER_LABELS[team.tier] ?? `T${team.tier}`}
                        </span>
                        {team.eliminated && (
                          <span className="text-xs text-red-400">OUT</span>
                        )}
                      </div>
                      <span className="text-sm font-bold text-cream/80">
                        {team.points}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Head-to-Head Matches */}
          <div className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
            <div className="px-4 py-2 border-b border-dark-border bg-dark-border/30">
              <h3 className="font-serif font-bold text-wc-gold">
                Head-to-Head Matches
              </h3>
              <p className="text-xs text-cream/40">
                Matches where their teams faced each other
              </p>
            </div>
            {data.headToHead.length === 0 ? (
              <div className="p-6 text-center text-cream/40 text-sm">
                No direct matchups yet
              </div>
            ) : (
              <div className="divide-y divide-dark-border/50">
                {data.headToHead.map((m) => {
                  const p1Flag =
                    m.p1Side === "home" ? m.homeFlag : m.awayFlag;
                  const p2Flag =
                    m.p2Side === "home" ? m.homeFlag : m.awayFlag;
                  const p1Team =
                    m.p1Side === "home" ? m.homeTeam : m.awayTeam;
                  const p2Team =
                    m.p2Side === "home" ? m.homeTeam : m.awayTeam;
                  const p1Score =
                    m.p1Side === "home" ? m.homeScore : m.awayScore;
                  const p2Score =
                    m.p2Side === "home" ? m.homeScore : m.awayScore;

                  return (
                    <div key={m.matchId} className="px-4 py-3">
                      <div className="flex items-center justify-between text-xs text-cream/40 mb-1">
                        <span>{m.stage}</span>
                        <span>
                          {m.status === "finished"
                            ? "FT"
                            : m.status === "live"
                              ? `LIVE ${m.homeScore ?? 0}-${m.awayScore ?? 0}`
                              : new Date(m.kickoff).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 items-center">
                        <div className="flex items-center gap-2">
                          <span>{p1Flag}</span>
                          <span
                            className={`text-sm font-medium ${m.p1Won === true ? "text-wc-gold" : m.p1Won === false ? "text-cream/50" : "text-cream"}`}
                          >
                            {p1Team}
                          </span>
                        </div>
                        <div className="text-center font-bold text-lg">
                          {p1Score !== null && p2Score !== null ? (
                            <>
                              <span
                                className={
                                  m.p1Won === true
                                    ? "text-wc-gold"
                                    : "text-cream/60"
                                }
                              >
                                {p1Score}
                              </span>
                              <span className="text-cream/30 mx-1">-</span>
                              <span
                                className={
                                  m.p2Won === true
                                    ? "text-wc-gold"
                                    : "text-cream/60"
                                }
                              >
                                {p2Score}
                              </span>
                            </>
                          ) : (
                            <span className="text-cream/30 text-sm">vs</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 justify-end">
                          <span
                            className={`text-sm font-medium ${m.p2Won === true ? "text-wc-gold" : m.p2Won === false ? "text-cream/50" : "text-cream"}`}
                          >
                            {p2Team}
                          </span>
                          <span>{p2Flag}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Prediction Comparison */}
          <div className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
            <div className="px-4 py-2 border-b border-dark-border bg-dark-border/30">
              <h3 className="font-serif font-bold text-wc-gold">
                Prediction Accuracy
              </h3>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-3 items-center gap-4">
                <div className="text-center">
                  <div className="text-xs text-cream/40 mb-1">
                    {data.player1.name}
                  </div>
                  <div
                    className={`text-2xl font-bold ${goldIfLeader(data.player1.predictions.accuracy, data.player2.predictions.accuracy, 1)}`}
                  >
                    {data.player1.predictions.accuracy}%
                  </div>
                  <div className="text-xs text-cream/40">
                    {data.player1.predictions.correct}/
                    {data.player1.predictions.total}
                  </div>
                </div>
                <div className="text-center">
                  {/* Visual bar comparison */}
                  <div className="space-y-1">
                    <div className="h-2 bg-dark-border rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${data.player1.predictions.accuracy}%`,
                          backgroundColor: data.player1.color,
                        }}
                      />
                    </div>
                    <div className="h-2 bg-dark-border rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${data.player2.predictions.accuracy}%`,
                          backgroundColor: data.player2.color,
                        }}
                      />
                    </div>
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-cream/40 mb-1">
                    {data.player2.name}
                  </div>
                  <div
                    className={`text-2xl font-bold ${goldIfLeader(data.player1.predictions.accuracy, data.player2.predictions.accuracy, 2)}`}
                  >
                    {data.player2.predictions.accuracy}%
                  </div>
                  <div className="text-xs text-cream/40">
                    {data.player2.predictions.correct}/
                    {data.player2.predictions.total}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* HEAD-TO-HEAD MATCHES (from /api/h2h) */}
          {h2hData && (
            <div className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
              <div className="px-4 py-2 border-b border-dark-border bg-dark-border/30">
                <h3 className="font-serif font-bold text-wc-gold">
                  Head-to-Head Match History
                </h3>
                <p className="text-xs text-cream/40">
                  Detailed match-by-match with points earned
                </p>
              </div>

              {/* Summary Banner */}
              {(h2hData.h2h.summary.p1Wins > 0 ||
                h2hData.h2h.summary.p2Wins > 0 ||
                h2hData.h2h.summary.draws > 0) && (
                <div className="px-4 py-3 border-b border-dark-border bg-dark-border/20">
                  <div className="text-center text-sm font-medium">
                    {h2hData.h2h.summary.p1Wins > h2hData.h2h.summary.p2Wins ? (
                      <span>
                        <span style={{ color: h2hData.h2h.player1.color }}>
                          {h2hData.h2h.player1.name}
                        </span>
                        <span className="text-cream/60">
                          {" "}leads{" "}
                        </span>
                        <span className="text-wc-gold font-bold">
                          {h2hData.h2h.summary.p1Wins}-{h2hData.h2h.summary.p2Wins}
                        </span>
                        <span className="text-cream/60">
                          {" "}in head-to-head matches
                          {h2hData.h2h.summary.draws > 0 &&
                            ` (${h2hData.h2h.summary.draws} ${h2hData.h2h.summary.draws === 1 ? "draw" : "draws"})`}
                        </span>
                      </span>
                    ) : h2hData.h2h.summary.p2Wins > h2hData.h2h.summary.p1Wins ? (
                      <span>
                        <span style={{ color: h2hData.h2h.player2.color }}>
                          {h2hData.h2h.player2.name}
                        </span>
                        <span className="text-cream/60">
                          {" "}leads{" "}
                        </span>
                        <span className="text-wc-gold font-bold">
                          {h2hData.h2h.summary.p2Wins}-{h2hData.h2h.summary.p1Wins}
                        </span>
                        <span className="text-cream/60">
                          {" "}in head-to-head matches
                          {h2hData.h2h.summary.draws > 0 &&
                            ` (${h2hData.h2h.summary.draws} ${h2hData.h2h.summary.draws === 1 ? "draw" : "draws"})`}
                        </span>
                      </span>
                    ) : (
                      <span className="text-cream/60">
                        Tied at{" "}
                        <span className="text-wc-gold font-bold">
                          {h2hData.h2h.summary.p1Wins}-{h2hData.h2h.summary.p2Wins}
                        </span>
                        {h2hData.h2h.summary.draws > 0 &&
                          ` with ${h2hData.h2h.summary.draws} ${h2hData.h2h.summary.draws === 1 ? "draw" : "draws"}`}
                      </span>
                    )}
                  </div>
                  {/* Points comparison */}
                  <div className="flex justify-center gap-6 mt-1 text-xs text-cream/40">
                    <span>
                      <span style={{ color: h2hData.h2h.player1.color }}>
                        {h2hData.h2h.player1.name}
                      </span>
                      :{" "}
                      <span className="font-bold text-cream/70">
                        {h2hData.h2h.player1.totalH2HPoints} pts
                      </span>
                    </span>
                    <span>
                      <span style={{ color: h2hData.h2h.player2.color }}>
                        {h2hData.h2h.player2.name}
                      </span>
                      :{" "}
                      <span className="font-bold text-cream/70">
                        {h2hData.h2h.player2.totalH2HPoints} pts
                      </span>
                    </span>
                  </div>
                </div>
              )}

              {h2hData.h2h.matches.length === 0 ? (
                <div className="p-6 text-center text-cream/40 text-sm">
                  No direct matchups yet
                </div>
              ) : (
                <div className="divide-y divide-dark-border/50">
                  {h2hData.h2h.matches.map((m) => (
                    <div key={m.matchId} className="px-4 py-3">
                      <div className="flex items-center justify-between text-xs text-cream/40 mb-1">
                        <span>{m.stage}</span>
                        <span>
                          {m.status === "finished"
                            ? "FT"
                            : m.status === "live"
                              ? `LIVE`
                              : new Date(m.kickoff).toLocaleDateString(
                                  undefined,
                                  { month: "short", day: "numeric" }
                                )}
                        </span>
                      </div>
                      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                        <div className="flex items-center gap-2">
                          <span>{m.p1Flag}</span>
                          <div>
                            <span
                              className={`text-sm font-medium ${
                                m.p1Won === true
                                  ? "text-wc-gold"
                                  : m.p1Won === false
                                    ? "text-cream/50"
                                    : "text-cream"
                              }`}
                            >
                              {m.p1TeamName}
                            </span>
                            {m.status === "finished" && (
                              <div className="text-[10px] text-cream/40">
                                {m.p1Points} pts
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-center font-bold text-lg min-w-[60px]">
                          {m.homeScore !== null && m.awayScore !== null ? (
                            <>
                              <span
                                className={
                                  m.p1Won === true
                                    ? "text-wc-gold"
                                    : "text-cream/60"
                                }
                              >
                                {m.p1Side === "home"
                                  ? m.homeScore
                                  : m.awayScore}
                              </span>
                              <span className="text-cream/30 mx-1">-</span>
                              <span
                                className={
                                  m.p2Won === true
                                    ? "text-wc-gold"
                                    : "text-cream/60"
                                }
                              >
                                {m.p2Side === "home"
                                  ? m.homeScore
                                  : m.awayScore}
                              </span>
                            </>
                          ) : (
                            <span className="text-cream/30 text-sm">vs</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 justify-end">
                          <div className="text-right">
                            <span
                              className={`text-sm font-medium ${
                                m.p2Won === true
                                  ? "text-wc-gold"
                                  : m.p2Won === false
                                    ? "text-cream/50"
                                    : "text-cream"
                              }`}
                            >
                              {m.p2TeamName}
                            </span>
                            {m.status === "finished" && (
                              <div className="text-[10px] text-cream/40 text-right">
                                {m.p2Points} pts
                              </div>
                            )}
                          </div>
                          <span>{m.p2Flag}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
