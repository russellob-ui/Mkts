"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Standing {
  player: { id: number; name: string; slug: string; color: string | null };
  byTournament: Record<string, number>;
  total: number;
}

interface TournamentInfo {
  id: number;
  name: string;
  status: string;
}

export default function SeasonPage() {
  const [standings, setStandings] = useState<Standing[]>([]);
  const [tournaments, setTournaments] = useState<TournamentInfo[]>([]);

  useEffect(() => {
    fetch("/api/season")
      .then((r) => r.json())
      .then((d) => {
        setStandings(d.standings ?? []);
        setTournaments(d.tournaments ?? []);
      });
  }, []);

  const majorOrder = [
    "The Masters",
    "PGA Championship",
    "U.S. Open",
    "The Open Championship",
  ];

  // Sort tournaments by major order
  const orderedTournaments = majorOrder
    .map((name) => tournaments.find((t) => t.name.includes(name.split(" ")[1] ?? name)) ?? null)
    .filter(Boolean) as TournamentInfo[];

  // Fallback: if no matches, use all tournaments
  const displayTournaments =
    orderedTournaments.length > 0 ? orderedTournaments : tournaments;

  const shortName = (name: string) => {
    if (name.toLowerCase().includes("masters")) return "Masters";
    if (name.toLowerCase().includes("pga")) return "PGA";
    if (name.toLowerCase().includes("u.s.") || name.toLowerCase().includes("us open"))
      return "US Open";
    if (name.toLowerCase().includes("open")) return "The Open";
    return name;
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="font-serif text-2xl md:text-3xl font-bold mb-6">
        Season Standings
      </h1>

      <div className="bg-dark-card border border-dark-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-dark-border text-xs text-cream/40 uppercase tracking-wider">
              <th className="text-left px-4 py-3">#</th>
              <th className="text-left px-4 py-3">Player</th>
              {displayTournaments.map((t) => (
                <th key={t.id} className="text-right px-3 py-3">
                  <span className="flex items-center justify-end gap-1">
                    {shortName(t.name)}
                    {t.status === "live" && (
                      <span className="live-dot inline-block w-2 h-2 rounded-full bg-augusta-light" />
                    )}
                  </span>
                </th>
              ))}
              <th className="text-right px-4 py-3 text-gold">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s, i) => (
              <tr
                key={s.player.slug}
                className="border-b border-dark-border/40 last:border-0 hover:bg-dark-border/20 transition-colors"
                style={{
                  borderLeft: `4px solid ${s.player.color ?? "#006747"}`,
                }}
              >
                <td className="px-4 py-3 text-cream/40">{i + 1}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/player/${s.player.slug}`}
                    className="font-bold hover:text-augusta-light transition-colors"
                  >
                    {s.player.name}
                  </Link>
                </td>
                {displayTournaments.map((t) => {
                  const pts = s.byTournament[t.name] ?? 0;
                  return (
                    <td key={t.id} className="text-right px-3 py-3 font-mono">
                      {pts > 0 ? pts : (
                        <span className="text-cream/20">-</span>
                      )}
                    </td>
                  );
                })}
                <td className="text-right px-4 py-3 font-mono font-bold text-gold">
                  {s.total > 0 ? s.total : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {standings.length === 0 && (
          <div className="px-4 py-8 text-center text-cream/40">
            Loading season standings...
          </div>
        )}
      </div>
    </div>
  );
}
