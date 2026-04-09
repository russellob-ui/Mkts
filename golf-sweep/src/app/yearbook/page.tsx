"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface YearbookPlayer {
  player: { name: string; slug: string; color: string | null; avatarEmoji: string | null };
  totalPoints: number;
  rank: number;
}

export default function YearbookPage() {
  const [players, setPlayers] = useState<YearbookPlayer[]>([]);

  useEffect(() => {
    fetch("/api/yearbook?year=2026").then(r => r.json()).then(d => {
      const sorted = (d.players ?? [])
        .sort((a: YearbookPlayer, b: YearbookPlayer) => b.totalPoints - a.totalPoints)
        .map((p: YearbookPlayer, i: number) => ({ ...p, rank: i + 1 }));
      setPlayers(sorted);
    });
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="font-serif text-3xl font-bold mb-2 text-center">The 2026 Yearbook</h1>
      <p className="text-center text-cream/40 text-sm mb-8">Major Sweep — The Definitive Record</p>

      <div className="grid grid-cols-2 gap-3">
        {players.map(p => (
          <Link key={p.player.slug} href={`/yearbook/${p.player.slug}`}
            className="bg-dark-card border border-dark-border rounded-xl p-4 hover:bg-dark-border/20 transition-colors text-center"
            style={{ borderTop: `3px solid ${p.player.color ?? "#006747"}` }}>
            <div className="text-2xl mb-1">{p.player.avatarEmoji ?? "🏌️"}</div>
            <div className="font-bold text-sm">{p.player.name}</div>
            <div className="text-gold font-mono text-lg font-bold mt-1">{p.totalPoints}</div>
            <div className="text-[10px] text-cream/30 uppercase">
              {p.rank === 1 ? "🏆 Champion" : `#${p.rank}`}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
