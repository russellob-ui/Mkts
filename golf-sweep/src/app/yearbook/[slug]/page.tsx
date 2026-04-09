"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface YearbookData {
  player: { name: string; slug: string; color: string | null; avatarEmoji: string | null };
  totalPoints: number;
  rank: number;
  picks: Array<{ tournament: string; golfer: string; position: string | null; points: number }>;
  pointsBreakdown: Record<string, number>;
  awards: string[];
}

export default function YearbookPlayerPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [data, setData] = useState<YearbookData | null>(null);

  useEffect(() => {
    fetch(`/api/yearbook?year=2026`).then(r => r.json()).then(d => {
      const all = d.players ?? [];
      const sorted = all.sort((a: { totalPoints: number }, b: { totalPoints: number }) => b.totalPoints - a.totalPoints);
      const idx = sorted.findIndex((p: { player: { slug: string } }) => p.player.slug === slug);
      if (idx >= 0) setData({ ...sorted[idx], rank: idx + 1 });
    });
  }, [slug]);

  if (!data) return <div className="max-w-3xl mx-auto px-4 py-8 text-center text-cream/40">Loading yearbook...</div>;

  const accentColor = data.player.color ?? "#006747";

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Hero */}
      <div className="text-center py-8" style={{ borderBottom: `2px solid ${accentColor}` }}>
        <div className="text-4xl mb-2">{data.player.avatarEmoji ?? "🏌️"}</div>
        <h1 className="font-serif text-3xl font-bold">{data.player.name}</h1>
        <div className="text-cream/50 text-sm mt-1">
          {data.rank === 1 ? "🏆 Season Champion" : `#${data.rank} of 8`}
        </div>
        <div className="text-gold text-4xl font-serif font-bold mt-3">{data.totalPoints}</div>
        <div className="text-cream/30 text-xs uppercase">Total Points</div>
      </div>

      {/* Picks */}
      <div className="py-6" style={{ borderBottom: `1px solid ${accentColor}30` }}>
        <h2 className="font-serif text-lg font-bold mb-3">The Picks</h2>
        {data.picks?.map((pick, i) => (
          <div key={i} className="flex justify-between text-sm py-1.5 border-b border-dark-border/20 last:border-0">
            <span>{pick.tournament} · {pick.golfer}</span>
            <span className="text-cream/50">{pick.position ?? "-"} · <span className="text-gold">{pick.points} pts</span></span>
          </div>
        ))}
      </div>

      {/* Points breakdown */}
      <div className="py-6" style={{ borderBottom: `1px solid ${accentColor}30` }}>
        <h2 className="font-serif text-lg font-bold mb-3">Points Breakdown</h2>
        {Object.entries(data.pointsBreakdown ?? {}).map(([source, pts]) => (
          <div key={source} className="flex justify-between text-sm py-1">
            <span className="text-cream/60 capitalize">{source.replace(/_/g, " ")}</span>
            <span className="font-mono text-gold">{pts}</span>
          </div>
        ))}
        <div className="flex justify-between text-sm py-1 mt-2 border-t border-dark-border font-bold">
          <span>TOTAL</span>
          <span className="text-gold">{data.totalPoints}</span>
        </div>
      </div>

      {/* Awards */}
      {data.awards?.length > 0 && (
        <div className="py-6" style={{ borderBottom: `1px solid ${accentColor}30` }}>
          <h2 className="font-serif text-lg font-bold mb-3">Awards Won</h2>
          {data.awards.map((award, i) => (
            <div key={i} className="text-sm py-1">🏅 {award}</div>
          ))}
        </div>
      )}

      {/* Share */}
      <div className="py-6 text-center">
        <button
          onClick={() => { navigator.clipboard.writeText(window.location.href); }}
          className="bg-augusta hover:bg-augusta-light text-cream px-6 py-2 rounded-lg font-bold text-sm transition-colors"
        >
          Share This Page
        </button>
      </div>

      <div className="text-center">
        <Link href="/yearbook" className="text-augusta-light hover:text-cream text-sm">Back to Yearbook</Link>
      </div>
    </div>
  );
}
