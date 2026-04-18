"use client";

import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

interface PlayerTrajectory {
  player: { id: number; name: string; slug: string; color: string | null };
  dataPoints: Array<{
    tournamentName: string;
    cumulativePoints: number;
  }>;
}

interface TournamentInfo {
  name: string;
  status: string;
}

export default function SeasonChartPage() {
  const [players, setPlayers] = useState<PlayerTrajectory[]>([]);
  const [tournaments, setTournaments] = useState<TournamentInfo[]>([]);

  useEffect(() => {
    fetch("/api/season-trajectory")
      .then((r) => r.json())
      .then((d) => {
        setPlayers(d.players ?? []);
        setTournaments(d.tournaments ?? []);
      });
  }, []);

  const hasData = players.some((p) => p.dataPoints.length > 0);

  // Build chart data: one entry per tournament
  const finishedTournaments = tournaments.filter((t) => t.status === "finished");
  const chartData = finishedTournaments.map((t) => {
    const point: Record<string, unknown> = { tournament: shortName(t.name) };
    for (const p of players) {
      const dp = p.dataPoints.find((d) => d.tournamentName === t.name);
      point[p.player.name] = dp?.cumulativePoints ?? null;
    }
    return point;
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="font-serif text-2xl font-bold mb-6">Season Trajectory 2026</h1>

      {!hasData ? (
        <div className="bg-dark-card border border-dark-border rounded-xl p-8 text-center text-cream/40">
          Season trajectory will appear once the first tournament is finished and points are settled.
        </div>
      ) : (
        <div className="bg-dark-card border border-dark-border rounded-xl p-4 mb-6">
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis dataKey="tournament" tick={{ fontSize: 11, fill: "#f5f1e8" }} />
              <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} />
              <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8 }} />
              {players.map((p) => (
                <Line
                  key={p.player.slug}
                  dataKey={p.player.name}
                  name={p.player.name}
                  stroke={p.player.color ?? "#006747"}
                  strokeWidth={2}
                  dot={{ r: 5, fill: p.player.color ?? "#006747" }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 mt-3 justify-center">
            {players.map((p) => (
              <span key={p.player.slug} className="flex items-center gap-1 text-xs">
                <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: p.player.color ?? "#006747" }} />
                {p.player.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function shortName(name: string): string {
  if (name.toLowerCase().includes("masters")) return "Masters";
  if (name.toLowerCase().includes("pga")) return "PGA";
  if (name.toLowerCase().includes("u.s.") || name.toLowerCase().includes("us open")) return "US Open";
  if (name.toLowerCase().includes("open")) return "The Open";
  return name;
}
