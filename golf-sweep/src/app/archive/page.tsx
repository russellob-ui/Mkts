"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface TournamentInfo {
  id: number;
  name: string;
  slug: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string;
  sweepWinner: { player: string; golfer: string; points: number } | null;
}

export default function ArchivePage() {
  const [tournaments, setTournaments] = useState<TournamentInfo[]>([]);

  useEffect(() => {
    fetch("/api/archive")
      .then((r) => r.json())
      .then((d) => setTournaments(d.tournaments ?? []));
  }, []);

  const statusBadge = (status: string) => {
    if (status === "finished") return <span className="text-xs bg-cream/10 text-cream/60 px-2 py-0.5 rounded-full">Finished</span>;
    if (status === "live") return <span className="text-xs bg-augusta/20 text-augusta-light px-2 py-0.5 rounded-full">LIVE</span>;
    return <span className="text-xs bg-dark-border text-cream/40 px-2 py-0.5 rounded-full">Upcoming</span>;
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="font-serif text-2xl font-bold mb-6">Archive</h1>

      <div className="space-y-4">
        {tournaments.map((t) => (
          <Link
            key={t.id}
            href={t.slug ? `/archive/${t.slug}` : "#"}
            className="block bg-dark-card border border-dark-border rounded-xl p-5 hover:bg-dark-border/20 transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-serif text-lg font-bold">{t.name}</h2>
              {statusBadge(t.status)}
            </div>
            <div className="text-sm text-cream/50">
              {t.startDate && t.endDate
                ? `${formatDate(t.startDate)} – ${formatDate(t.endDate)}`
                : "Dates TBC"}
            </div>
            {t.sweepWinner && (
              <div className="mt-2 text-sm">
                <span className="text-gold">🏆 Winner: {t.sweepWinner.player}</span>
                <span className="text-cream/50"> ({t.sweepWinner.golfer}) — {t.sweepWinner.points} pts</span>
              </div>
            )}
            {t.status === "upcoming" && t.name.includes("PGA") && (
              <div className="mt-2 text-xs text-cream/40">Snake draft opens 24h before</div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

function formatDate(d: string): string {
  try {
    return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  } catch { return d; }
}
