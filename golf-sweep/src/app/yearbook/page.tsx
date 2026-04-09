"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface YearbookPlayer {
  rank: number;
  player: {
    id: number;
    name: string;
    slug: string;
    avatarEmoji: string | null;
    color: string | null;
  };
  totalPoints: number;
}

function rankBadge(rank: number): string {
  switch (rank) {
    case 1:
      return "\u{1f947}";
    case 2:
      return "\u{1f948}";
    case 3:
      return "\u{1f949}";
    case 8:
      return "\u{1f944}";
    default:
      return "";
  }
}

export default function YearbookIndexPage() {
  const [players, setPlayers] = useState<YearbookPlayer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/season")
      .then((r) => r.json())
      .then((d) => {
        if (d.standings) {
          const sorted = d.standings
            .map(
              (
                s: {
                  player: YearbookPlayer["player"];
                  total: number;
                },
                i: number
              ) => ({
                rank: i + 1,
                player: s.player,
                totalPoints: s.total,
              })
            )
            .sort(
              (a: YearbookPlayer, b: YearbookPlayer) => a.rank - b.rank
            );
          setPlayers(sorted);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 text-center text-cream/40">
        Loading yearbook...
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="text-center mb-8">
        <h1 className="font-serif text-3xl md:text-4xl font-bold mb-2">
          Yearbook
        </h1>
        <p className="text-cream/50 text-sm">
          The class of 2026. Eight friends, four majors, one season.
        </p>
      </div>

      {players.length === 0 ? (
        <div className="bg-dark-card border border-dark-border rounded-xl p-8 text-center text-cream/40">
          No season data yet. Complete a tournament to populate the yearbook.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {players.map((entry) => (
            <Link
              key={entry.player.slug}
              href={`/yearbook/${entry.player.slug}`}
              className="bg-dark-card border border-dark-border rounded-xl p-5 text-center hover:border-augusta/50 transition-all group"
              style={{
                borderTop: `4px solid ${entry.player.color ?? "#006747"}`,
              }}
            >
              {/* Rank badge */}
              <div className="text-2xl mb-2">
                {rankBadge(entry.rank)}
              </div>

              {/* Avatar */}
              <div className="text-4xl mb-2">
                {entry.player.avatarEmoji ?? "\u26f3"}
              </div>

              {/* Name */}
              <div className="font-serif font-bold text-sm group-hover:text-augusta-light transition-colors">
                {entry.player.name}
              </div>

              {/* Points */}
              <div className="text-gold font-mono font-bold text-lg mt-1">
                {entry.totalPoints}
              </div>
              <div className="text-[10px] text-cream/30 mt-0.5">points</div>

              {/* Rank number */}
              <div
                className="mt-2 inline-block px-2 py-0.5 rounded-full text-xs font-bold"
                style={{
                  backgroundColor: `${entry.player.color ?? "#006747"}20`,
                  color: entry.player.color ?? "#006747",
                }}
              >
                #{entry.rank}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
