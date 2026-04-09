"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatScore, scoreClass, getBanterLine } from "@/lib/banter";

interface LeaderboardEntry {
  player: { name: string; slug: string; color: string | null };
  golfer: { name: string; flagEmoji: string | null };
  position: string | null;
  scoreToPar: number | null;
  thru: string | null;
  points: number;
}

interface LeaderboardData {
  entries: LeaderboardEntry[];
  tournament: { name: string; status: string; lastPolledAt: string | null } | null;
}

export default function HomePage() {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/leaderboard");
      const json = await res.json();
      if (json.entries?.length === 0 && !json.tournament) {
        // Try seed
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
  const banter = leader && worst
    ? getBanterLine(leader.golfer.name, worst.golfer.name)
    : "The Masters awaits...";
  const isLive = data?.tournament?.status === "live";

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
        <p className="text-xl text-gold font-serif italic">
          Major Sweep 2026
        </p>
      </div>

      {seeding && (
        <div className="text-center py-8 text-cream/60">
          Setting up the sweep... calling Slash Golf API...
        </div>
      )}

      {/* Tournament card */}
      {data?.tournament && (
        <div className="bg-dark-card border border-dark-border rounded-xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            {isLive && (
              <span className="live-dot inline-block w-3 h-3 rounded-full bg-augusta-light" />
            )}
            <h2 className="font-serif text-2xl font-bold">
              {data.tournament.name}
            </h2>
            {isLive && (
              <span className="text-xs bg-augusta/20 text-augusta-light px-2 py-0.5 rounded-full uppercase tracking-wider">
                Live
              </span>
            )}
          </div>

          {/* Banter strip */}
          <div className="bg-dark rounded-lg px-4 py-2 mb-4 text-center text-sm italic text-cream/70">
            {banter}
          </div>

          {/* Sweep leader */}
          {leader && (
            <div className="flex items-center justify-between">
              <div>
                <span className="text-cream/50 text-sm">Sweep leader</span>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className="w-3 h-3 rounded-full inline-block"
                    style={{ backgroundColor: leader.player.color ?? "#006747" }}
                  />
                  <span className="font-bold text-lg">
                    {leader.player.name}
                  </span>
                  <span className="text-cream/50">
                    ({leader.golfer.name} {leader.golfer.flagEmoji})
                  </span>
                </div>
                <div className="flex gap-4 mt-1 text-sm text-cream/60">
                  <span>Pos: {leader.position ?? "-"}</span>
                  <span className={scoreClass(leader.scoreToPar)}>
                    {formatScore(leader.scoreToPar)}
                  </span>
                  <span>Thru: {leader.thru ?? "-"}</span>
                </div>
              </div>
              <Link
                href="/leaderboard"
                className="bg-augusta hover:bg-augusta-light text-cream px-6 py-3 rounded-lg font-bold text-sm transition-colors"
              >
                View Leaderboard
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Quick standings */}
      {data?.entries && data.entries.length > 0 && (
        <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
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
              }}
            >
              <div className="flex items-center gap-3">
                <span className="text-cream/40 text-sm w-5">{i + 1}</span>
                <div>
                  <span className="font-bold">{entry.player.name}</span>
                  <span className="text-cream/50 text-sm ml-2">
                    {entry.golfer.name} {entry.golfer.flagEmoji}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-cream/60">{entry.position ?? "-"}</span>
                <span className={`font-mono font-bold ${scoreClass(entry.scoreToPar)}`}>
                  {formatScore(entry.scoreToPar)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
