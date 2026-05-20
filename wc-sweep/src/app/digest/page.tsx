"use client";

import { useEffect, useState, useCallback } from "react";

interface MatchGoal {
  playerName: string | null;
  minute: number | null;
  teamName: string;
  detail: string | null;
}

interface MatchResult {
  id: number;
  homeTeam: string;
  awayTeam: string;
  homeFlag: string;
  awayFlag: string;
  homeScore: number | null;
  awayScore: number | null;
  homePenalties: number | null;
  awayPenalties: number | null;
  stage: string;
  kickoff: string;
  homeOwner: string | null;
  homeOwnerColor: string | null;
  awayOwner: string | null;
  awayOwnerColor: string | null;
  goals: MatchGoal[];
  redCards: number;
  homeCleanSheet: boolean;
  awayCleanSheet: boolean;
  homeTier: number;
  awayTier: number;
}

interface PlayerPoints {
  name: string;
  color: string;
  points: number;
  breakdown: {
    source: string;
    points: number;
    note: string | null;
    teamName: string;
  }[];
}

interface Standing {
  playerId: number;
  name: string;
  color: string;
  totalPoints: number;
  rank: number;
  previousRank: number;
  movement: number;
}

interface Upset {
  winner: string;
  winnerFlag: string;
  loser: string;
  score: string;
  winnerTierLabel: string;
}

interface CleanSheet {
  team: string;
  flag: string;
  owner: string | null;
  score: string;
  opponent: string;
}

interface RedCard {
  playerName: string | null;
  teamName: string;
  teamFlag: string;
  minute: number | null;
  matchLabel: string;
}

interface DigestData {
  date: string;
  headline: string;
  matches: MatchResult[];
  pointsByPlayer: PlayerPoints[];
  biggestEarner: PlayerPoints | null;
  standings: Standing[];
  upsets: Upset[];
  cleanSheets: CleanSheet[];
  redCards: RedCard[];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function movementArrow(m: number): string {
  if (m > 0) return "↑"; // up arrow
  if (m < 0) return "↓"; // down arrow
  return "→"; // right arrow (no change)
}

function movementColor(m: number): string {
  if (m > 0) return "text-green-400";
  if (m < 0) return "text-red-400";
  return "text-cream/40";
}

export default function DigestPage() {
  const [date, setDate] = useState<string>(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split("T")[0];
  });
  const [data, setData] = useState<DigestData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDigest = useCallback(async () => {
    try {
      const res = await fetch(`/api/digest?date=${date}`);
      if (res.ok) {
        const json: DigestData = await res.json();
        setData(json);
      }
    } catch {
      // silently fail
    }
  }, [date]);

  useEffect(() => {
    setLoading(true);
    loadDigest().finally(() => setLoading(false));
  }, [loadDigest]);

  const hasTalkingPoints =
    data &&
    (data.upsets.length > 0 ||
      data.cleanSheets.length > 0 ||
      data.redCards.length > 0);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-1">
        <h1 className="font-serif text-3xl font-bold tracking-tight">
          Daily <span className="text-wc-gold">Digest</span>
        </h1>
        <p className="text-cream/40 text-xs uppercase tracking-widest">
          World Cup Sweep 2026
        </p>
      </div>

      {/* Date Selector */}
      <div className="flex justify-center">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="bg-dark-card border border-dark-border rounded-lg px-3 py-2 text-cream text-sm focus:outline-none focus:border-wc-gold"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-cream/40">
          Loading digest...
        </div>
      ) : !data || data.matches.length === 0 ? (
        <div className="bg-dark-card border border-dark-border rounded-lg p-8 text-center">
          <div className="font-serif text-xl text-cream/50">
            No matches on {formatDate(date)}
          </div>
          <p className="text-cream/30 text-sm mt-2">
            Try selecting a different date
          </p>
        </div>
      ) : (
        <>
          {/* HEADLINE */}
          <section className="bg-dark-card border border-wc-gold/30 rounded-lg p-5 text-center">
            <div className="text-xs text-cream/40 uppercase tracking-widest mb-2">
              {formatDate(date)}
            </div>
            <h2 className="font-serif text-xl font-bold leading-tight text-cream">
              {data.headline}
            </h2>
          </section>

          {/* RESULTS */}
          <section>
            <h2 className="text-xs font-semibold text-cream/50 uppercase tracking-wider mb-3">
              Results
            </h2>
            <div className="space-y-2">
              {data.matches.map((m) => (
                <div
                  key={m.id}
                  className="bg-dark-card border border-dark-border rounded-lg p-3"
                >
                  <div className="flex items-center justify-between text-xs text-cream/40 mb-2">
                    <span>{m.stage}</span>
                    <span>FT</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-lg">{m.homeFlag}</span>
                      <div>
                        <div className="font-semibold text-sm">
                          {m.homeTeam}
                        </div>
                        {m.homeOwner && (
                          <div
                            className="text-xs"
                            style={{ color: m.homeOwnerColor ?? "#ffffff" }}
                          >
                            {m.homeOwner}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-xl font-bold px-4 font-mono">
                      {m.homeScore ?? 0} - {m.awayScore ?? 0}
                      {m.homePenalties != null && m.awayPenalties != null && (
                        <div className="text-xs text-cream/40 font-normal text-center">
                          ({m.homePenalties}-{m.awayPenalties} pens)
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-1 justify-end text-right">
                      <div>
                        <div className="font-semibold text-sm">
                          {m.awayTeam}
                        </div>
                        {m.awayOwner && (
                          <div
                            className="text-xs"
                            style={{ color: m.awayOwnerColor ?? "#ffffff" }}
                          >
                            {m.awayOwner}
                          </div>
                        )}
                      </div>
                      <span className="text-lg">{m.awayFlag}</span>
                    </div>
                  </div>
                  {/* Goal scorers */}
                  {m.goals.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-dark-border/50 space-y-0.5">
                      {m.goals.map((g, i) => (
                        <div
                          key={i}
                          className="text-xs text-cream/50 flex items-center gap-1"
                        >
                          <span>&#9917;</span>
                          <span>
                            {g.playerName ?? "Unknown"} {g.minute ? `${g.minute}'` : ""}
                          </span>
                          {g.detail === "Own Goal" && (
                            <span className="text-red-400">(OG)</span>
                          )}
                          {g.detail === "Penalty" && (
                            <span className="text-wc-gold">(P)</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* MOVERS & SHAKERS */}
          {data.pointsByPlayer.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-cream/50 uppercase tracking-wider mb-3">
                Movers &amp; Shakers
              </h2>
              <div className="bg-dark-card border border-dark-border rounded-lg divide-y divide-dark-border/50">
                {data.pointsByPlayer.map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2">
                      {i === 0 && (
                        <span className="text-wc-gold text-sm">&#9733;</span>
                      )}
                      <span
                        className="font-semibold text-sm"
                        style={{ color: p.color }}
                      >
                        {p.name}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-wc-gold font-bold text-sm">
                        +{p.points.toFixed(1)}
                      </span>
                      <div className="text-xs text-cream/30">
                        {p.breakdown
                          .map((b) => b.teamName)
                          .filter((v, idx, a) => a.indexOf(v) === idx)
                          .join(", ")}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* STANDINGS UPDATE */}
          <section>
            <h2 className="text-xs font-semibold text-cream/50 uppercase tracking-wider mb-3">
              Standings Update
            </h2>
            <div className="bg-dark-card border border-dark-border rounded-lg divide-y divide-dark-border/50">
              {data.standings.map((s) => (
                <div
                  key={s.playerId}
                  className="flex items-center gap-3 px-3 py-2.5"
                >
                  <span className="text-sm font-bold text-cream/30 w-5 text-center">
                    {s.rank}
                  </span>
                  <span
                    className={`text-sm font-bold w-5 text-center ${movementColor(s.movement)}`}
                  >
                    {movementArrow(s.movement)}
                    {Math.abs(s.movement) > 0 && (
                      <span className="text-xs">{Math.abs(s.movement)}</span>
                    )}
                  </span>
                  <span
                    className="font-semibold text-sm flex-1"
                    style={{ color: s.color }}
                  >
                    {s.name}
                  </span>
                  <span className="text-sm font-bold text-wc-gold">
                    {s.totalPoints.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* TALKING POINTS */}
          {hasTalkingPoints && (
            <section>
              <h2 className="text-xs font-semibold text-cream/50 uppercase tracking-wider mb-3">
                Talking Points
              </h2>
              <div className="bg-dark-card border border-dark-border rounded-lg p-4 space-y-2">
                {data.upsets.map((u, i) => (
                  <div key={`u${i}`} className="flex items-start gap-2 text-sm">
                    <span className="shrink-0">&#128165;</span>
                    <span className="text-cream/80">
                      <span className="font-semibold">Upset!</span>{" "}
                      {u.winnerFlag} {u.winner} ({u.winnerTierLabel}) beat{" "}
                      {u.loser} {u.score}
                    </span>
                  </div>
                ))}
                {data.cleanSheets.map((cs, i) => (
                  <div key={`cs${i}`} className="flex items-start gap-2 text-sm">
                    <span className="shrink-0">&#129502;</span>
                    <span className="text-cream/80">
                      {cs.flag} {cs.team} kept a clean sheet vs {cs.opponent} ({cs.score})
                      {cs.owner && (
                        <span className="text-cream/50"> — {cs.owner}</span>
                      )}
                    </span>
                  </div>
                ))}
                {data.redCards.map((rc, i) => (
                  <div key={`rc${i}`} className="flex items-start gap-2 text-sm">
                    <span className="shrink-0">&#129529;</span>
                    <span className="text-cream/80">
                      {rc.teamFlag} {rc.playerName ?? "Unknown"} ({rc.teamName})
                      sent off {rc.minute ? `at ${rc.minute}'` : ""} in{" "}
                      {rc.matchLabel}
                    </span>
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
