"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
} from "recharts";

interface HoleData {
  holeNumber: number;
  cumulativeToPar: number;
  holePar: number;
  holeScore: number;
  round: number;
}

interface PlayerHoleByHole {
  player: { name: string; color: string };
  golfer: { name: string; flagEmoji: string | null };
  holes: HoleData[];
}

export default function HoleByHolePage() {
  const [players, setPlayers] = useState<PlayerHoleByHole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      // Trigger leaderboard poll first to ensure data freshness
      await fetch("/api/leaderboard");
      const res = await fetch("/api/hole-by-hole");
      const data = await res.json();
      setPlayers(data.players ?? []);
      setLoading(false);
    }
    load();
  }, []);

  // Find the max hole count across all players
  const maxHole = Math.max(
    ...players.map((p) => p.holes.length),
    0
  );

  // Build unified chart data — one entry per sequential hole number
  const chartData: Array<Record<string, unknown>> = [];
  for (let h = 1; h <= maxHole; h++) {
    const point: Record<string, unknown> = { hole: h };
    for (const p of players) {
      const holeEntry = p.holes.find((hd) => hd.holeNumber === h);
      if (holeEntry) {
        point[p.player.name] = holeEntry.cumulativeToPar;
      }
    }
    chartData.push(point);
  }

  // Round boundary markers (after holes 18, 36, 54)
  const roundBoundaries = [18, 36, 54].filter((b) => b < maxHole);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 text-center text-cream/40">
        Loading hole-by-hole data...
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="font-serif text-2xl md:text-3xl font-bold mb-2">
        Hole-by-Hole
      </h1>
      <p className="text-cream/50 text-sm mb-6">
        Cumulative score-to-par through every hole of the tournament.
      </p>

      {players.length === 0 ? (
        <div className="bg-dark-card border border-dark-border rounded-xl p-8 text-center text-cream/40">
          Hole-by-hole data will appear once scorecards are available from the
          live tournament.
        </div>
      ) : (
        <div className="bg-dark-card border border-dark-border rounded-xl p-4">
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis
                dataKey="hole"
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                tickFormatter={(v) => String(v)}
                interval={Math.max(Math.floor(maxHole / 18) - 1, 0) * 3 + 2}
              />
              <YAxis
                reversed
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                domain={["auto", "auto"]}
                tickFormatter={(v: number) =>
                  v === 0 ? "E" : v > 0 ? `+${v}` : String(v)
                }
              />
              <Tooltip
                contentStyle={{
                  background: "#1a1a1a",
                  border: "1px solid #2a2a2a",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelFormatter={(v) => `Hole ${v}`}
                formatter={(value: unknown, name: unknown) => {
                  const v = Number(value);
                  return [
                    v === 0 ? "E" : v > 0 ? `+${v}` : String(v),
                    String(name),
                  ];
                }}
              />
              <ReferenceLine
                y={0}
                stroke="#9ca3af"
                strokeDasharray="3 3"
                label={{ value: "E", fill: "#9ca3af", fontSize: 10 }}
              />
              {/* Round boundary markers */}
              {roundBoundaries.map((boundary, i) => (
                <ReferenceLine
                  key={boundary}
                  x={boundary}
                  stroke="#4a4a4a"
                  strokeDasharray="6 3"
                  label={{
                    value: `R${i + 1}|R${i + 2}`,
                    fill: "#6b7280",
                    fontSize: 9,
                    position: "top",
                  }}
                />
              ))}
              {players.map((p) => (
                <Line
                  key={p.player.name}
                  dataKey={p.player.name}
                  name={p.player.name}
                  stroke={p.player.color}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-4 justify-center">
            {players.map((p) => (
              <span
                key={p.player.name}
                className="flex items-center gap-1.5 text-xs"
              >
                <span
                  className="w-3 h-3 rounded-full inline-block"
                  style={{ backgroundColor: p.player.color }}
                />
                <span className="text-cream/80">
                  {p.player.name}
                </span>
                <span className="text-cream/40">
                  ({p.golfer.flagEmoji} {p.golfer.name})
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
