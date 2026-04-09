"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface AlternateResult {
  golferName: string;
  golferFlag: string | null;
  actualPlayer: string;
  position: string | null;
  pointsWouldEarn: number;
}

interface PlayerAnalysis {
  player: { name: string; slug: string; color: string | null };
  golfer: { name: string; flagEmoji: string | null };
  actualPoints: number;
  alternates: AlternateResult[];
  bestAlternate: AlternateResult | null;
}

export default function WhatCouldHaveBeenPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [data, setData] = useState<PlayerAnalysis[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);

  useEffect(() => {
    // Find tournament ID from slug
    fetch("/api/archive")
      .then((r) => r.json())
      .then((archiveData) => {
        const t = archiveData.tournaments?.find((t: { slug: string }) => t.slug === slug);
        if (t) {
          fetch(`/api/what-could-have-been?tournamentId=${t.id}`)
            .then((r) => r.json())
            .then((d) => setData(d.analysis ?? []));
        }
      });
  }, [slug]);

  const filtered = selectedPlayer
    ? data.filter((d) => d.player.slug === selectedPlayer)
    : data;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="font-serif text-2xl font-bold mb-2">What Could Have Been</h1>
      <p className="text-cream/50 text-sm mb-6">How would you have done with a different pick?</p>

      {/* Player filter */}
      <select
        value={selectedPlayer ?? ""}
        onChange={(e) => setSelectedPlayer(e.target.value || null)}
        className="bg-dark border border-dark-border rounded-lg px-3 py-2 text-cream text-sm mb-4 w-full"
      >
        <option value="">All players</option>
        {data.map((d) => (
          <option key={d.player.slug} value={d.player.slug}>
            {d.player.name}
          </option>
        ))}
      </select>

      {filtered.map((analysis) => (
        <div
          key={analysis.player.slug}
          className="bg-dark-card border border-dark-border rounded-xl p-4 mb-4"
          style={{ borderLeft: `4px solid ${analysis.player.color ?? "#006747"}` }}
        >
          <div className="flex justify-between items-start mb-3">
            <div>
              <div className="font-bold">{analysis.player.name}</div>
              <div className="text-xs text-cream/50">
                Picked {analysis.golfer.flagEmoji} {analysis.golfer.name} — earned{" "}
                <span className="text-gold font-bold">{analysis.actualPoints} pts</span>
              </div>
            </div>
          </div>

          <div className="text-xs text-cream/40 mb-2">If they had picked instead:</div>
          <div className="space-y-1">
            {analysis.alternates
              .sort((a, b) => b.pointsWouldEarn - a.pointsWouldEarn)
              .map((alt, i) => {
                const diff = alt.pointsWouldEarn - analysis.actualPoints;
                return (
                  <div key={i} className="flex justify-between items-center text-sm py-1">
                    <span>
                      {alt.golferFlag} {alt.golferName}
                      <span className="text-cream/30 text-xs ml-1">({alt.actualPlayer}&apos;s pick)</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="font-mono">{alt.pointsWouldEarn} pts</span>
                      {diff > 0 && <span className="text-red-400 text-xs">+{diff} 📈</span>}
                      {diff < 0 && <span className="text-gray-500 text-xs">{diff} 📉</span>}
                      {diff === 0 && <span className="text-cream/30 text-xs">➡️</span>}
                    </span>
                  </div>
                );
              })}
          </div>

          {analysis.bestAlternate && (
            <div className="mt-3 pt-2 border-t border-dark-border/30 text-xs text-cream/40">
              Best available: {analysis.bestAlternate.golferFlag} {analysis.bestAlternate.golferName} ({analysis.bestAlternate.pointsWouldEarn} pts)
            </div>
          )}
        </div>
      ))}

      {data.length === 0 && (
        <div className="bg-dark-card border border-dark-border rounded-xl p-8 text-center text-cream/40">
          Analysis available after the tournament finishes.
        </div>
      )}

      <div className="text-center mt-4">
        <Link href={`/archive/${slug}`} className="text-augusta-light hover:text-cream text-sm">
          Back to {slug}
        </Link>
      </div>
    </div>
  );
}
