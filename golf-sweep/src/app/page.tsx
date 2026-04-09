"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface LeaderboardEntry {
  player: { name: string; slug: string; color: string | null };
  golfer: { name: string; flagEmoji: string | null };
  position: string | null;
  scoreToPar: number | null;
  thru: string | null;
  openingOdds: string | null;
  openingOddsDecimal: number | null;
  currentOdds: string | null;
  currentOddsDecimal: number | null;
  points: number;
}

interface LeaderboardData {
  entries: LeaderboardEntry[];
  tournament: { name: string; status: string } | null;
}

function formatScore(s: number | null): string {
  if (s === null) return "-";
  if (s === 0) return "E";
  return s > 0 ? `+${s}` : String(s);
}
function scoreColor(s: number | null): string {
  if (s === null) return "text-cream/40";
  if (s <= -3) return "text-red-500";
  if (s < 0) return "text-red-400";
  if (s === 0) return "text-gray-400";
  if (s <= 2) return "text-white";
  return "text-gray-500";
}

function getBanter(leader: string, worst: string): string {
  const lines = [
    { text: "Rory charging 🔥", cond: () => leader.includes("McIlroy") },
    { text: "Rahm in the pine straw 💀", cond: () => worst.includes("Rahm") },
    { text: "Stuart looking like a genius 🧠", cond: () => leader.includes("Lowry") },
    { text: "Scheffler doing Scheffler things 🤖", cond: () => leader.includes("Scheffler") },
    { text: "Rose always there, never quite there 🫠", cond: () => leader.includes("Rose") },
    { text: "Bobby Mac grinding it out 🏴󠁧󠁢󠁳󠁣󠁴󠁿", cond: () => leader.includes("MacIntyre") },
    { text: "Fitz level, Yorkshire grit required 😐", cond: () => leader.includes("Fitzpatrick") },
    { text: "Åberg showing the Swedes how it's done 🇸🇪", cond: () => leader.includes("berg") },
    { text: "Rahm in free-fall 📉", cond: () => worst.includes("Rahm") && true },
  ];
  const matched = lines.filter((l) => l.cond());
  if (matched.length > 0) return matched[Math.floor(Math.random() * matched.length)].text;
  return "⛳ Major Sweep 2026 — live from Augusta";
}

export default function HomePage() {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/leaderboard");
      const json = await res.json();
      if (json.entries?.length === 0 && !json.tournament) {
        setSeeding(true);
        await fetch("/api/seed", { method: "POST" });
        const res2 = await fetch("/api/leaderboard");
        const json2 = await res2.json();
        setData(json2);
        setSeeding(false);
      } else {
        setData(json);
      }
    }
    load();
  }, []);

  const leader = data?.entries?.[0];
  const worst = data?.entries?.[data.entries.length - 1];
  const banter = leader && worst ? getBanter(leader.golfer.name, worst.golfer.name) : "";
  const isLive = data?.tournament?.status === "live";

  // Find biggest odds mover
  const oddsMover = data?.entries?.reduce<LeaderboardEntry | null>((best, e) => {
    if (!e.openingOddsDecimal || !e.currentOddsDecimal) return best;
    const movement = e.openingOddsDecimal - e.currentOddsDecimal;
    if (!best) return movement > 0 ? e : best;
    const bestMovement = (best.openingOddsDecimal ?? 0) - (best.currentOddsDecimal ?? 0);
    return movement > bestMovement ? e : best;
  }, null);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Hero */}
      <div className="text-center py-12">
        <h1 className="font-serif text-4xl md:text-6xl font-bold text-cream mb-2">
          LONDON BANTER
        </h1>
        <h1 className="font-serif text-4xl md:text-6xl font-bold text-augusta-light mb-4">
          &amp; WOODY
        </h1>
        <p className="text-xl text-gold font-serif italic">Major Sweep 2026</p>
      </div>

      {seeding && (
        <div className="text-center py-8 text-cream/60">Setting up the sweep...</div>
      )}

      {/* Tournament card */}
      {data?.tournament && (
        <div className="bg-dark-card border border-dark-border rounded-xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            {isLive && <span className="live-dot inline-block w-3 h-3 rounded-full bg-augusta-light" />}
            <h2 className="font-serif text-2xl font-bold">{data.tournament.name}</h2>
            {isLive && (
              <span className="text-xs bg-augusta/20 text-augusta-light px-2 py-0.5 rounded-full uppercase tracking-wider">
                Live
              </span>
            )}
          </div>

          {banter && (
            <div className="bg-dark rounded-lg px-4 py-2 mb-4 text-center text-sm italic text-cream/70">
              {banter}
            </div>
          )}

          {/* Sweep leader */}
          {leader && (
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-cream/50 text-sm">🏆 Currently leading</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: leader.player.color ?? "#006747" }} />
                  <span className="font-bold text-lg">{leader.player.name}</span>
                  <span className="text-cream/50">
                    with {leader.golfer.name} {leader.golfer.flagEmoji}
                  </span>
                  <span className={`font-mono font-bold ${scoreColor(leader.scoreToPar)}`}>
                    ({formatScore(leader.scoreToPar)})
                  </span>
                </div>
              </div>
              <Link href="/leaderboard" className="bg-augusta hover:bg-augusta-light text-cream px-6 py-3 rounded-lg font-bold text-sm transition-colors">
                View Leaderboard
              </Link>
            </div>
          )}

          {/* Odds mover */}
          {oddsMover && oddsMover.currentOdds && (
            <div className="bg-dark rounded-lg px-4 py-2 text-sm">
              <span className="text-cream/50">📈 Odds mover: </span>
              <span className="font-bold">{oddsMover.golfer.name}</span>
              <span className="text-cream/50"> from </span>
              <span className="text-cream/40">{oddsMover.openingOdds}</span>
              <span className="text-cream/50"> to </span>
              <span className="text-red-400 font-bold">{oddsMover.currentOdds}</span>
            </div>
          )}
        </div>
      )}

      {/* Quick standings */}
      {data?.entries && data.entries.length > 0 && (
        <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden mb-6">
          <div className="p-4 border-b border-dark-border">
            <h3 className="font-serif text-lg font-bold">Quick Standings</h3>
          </div>
          {data.entries.map((entry, i) => (
            <Link
              key={entry.player.slug}
              href={`/player/${entry.player.slug}`}
              className="flex items-center justify-between px-4 py-3 border-b border-dark-border/50 last:border-0 hover:bg-dark-border/20 transition-colors"
              style={{
                borderLeft: `3px solid ${entry.player.color ?? "#006747"}`,
                backgroundColor: `${entry.player.color ?? "#006747"}08`,
              }}
            >
              <div className="flex items-center gap-3">
                <span className="text-cream/40 text-sm w-5">{i + 1}</span>
                <div>
                  <span className="font-bold">{entry.player.name}</span>
                  <span className="text-cream/50 text-sm ml-2">
                    {entry.golfer.name} {entry.golfer.flagEmoji}
                  </span>
                  <span className="text-cream/30 text-xs ml-1">({entry.openingOdds})</span>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-cream/60">{entry.position ?? "-"}</span>
                <span className={`font-mono font-bold ${scoreColor(entry.scoreToPar)}`}>
                  {formatScore(entry.scoreToPar)}
                </span>
                {entry.currentOdds && (
                  <span className="text-xs text-cream/40">{entry.currentOdds}</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Secondary nav */}
      <div className="flex gap-3 justify-center mb-8">
        <Link href="/season" className="bg-dark-card border border-dark-border px-5 py-2 rounded-lg text-sm hover:bg-dark-border/30 transition-colors">
          Season Standings
        </Link>
        <Link href="/draft" className="bg-dark-card border border-dark-border px-5 py-2 rounded-lg text-sm hover:bg-dark-border/30 transition-colors">
          Snake Draft
        </Link>
      </div>
    </div>
  );
}
