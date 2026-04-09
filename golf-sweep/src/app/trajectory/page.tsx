"use client";

import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
  BarChart, Bar, Cell, CartesianGrid, Legend,
} from "recharts";

interface Snapshot {
  totalScoreToPar: number | null;
  roundScoreToPar: number | null;
  position: string | null;
  positionNumeric: number | null;
  thru: string | null;
  roundNumber: number;
  capturedAt: string;
}

interface TrajectoryEntry {
  player: { name: string; slug: string; color: string | null };
  golfer: { name: string; flagEmoji: string | null };
  snapshots: Snapshot[];
}

type Tab = "evolution" | "bars" | "position" | "heatmap";

export default function TrajectoryPage() {
  const [data, setData] = useState<TrajectoryEntry[]>([]);
  const [heatmapData, setHeatmapData] = useState<Array<{
    player: { name: string; color: string | null };
    golfer: { name: string; flagEmoji: string | null };
    rounds: Record<number, number | null>;
    totalToPar: number | null;
    position: string | null;
  }>>([]);
  const [tab, setTab] = useState<Tab>("evolution");
  const [tournamentId, setTournamentId] = useState(1);

  useEffect(() => {
    async function load() {
      // Trigger a leaderboard fetch first — this ensures tables exist
      // and writes score snapshots if scores are stale
      await fetch("/api/leaderboard");

      // Now fetch trajectory + heatmap data
      const [trajRes, heatRes] = await Promise.all([
        fetch(`/api/trajectory?tournamentId=${tournamentId}`),
        fetch(`/api/heatmap?tournamentId=${tournamentId}`),
      ]);
      const trajData = await trajRes.json();
      const heatData = await heatRes.json();
      setData(trajData.trajectories ?? []);
      setHeatmapData(heatData.heatmap ?? []);
    }
    load();
  }, [tournamentId]);

  const tabs: { key: Tab; label: string }[] = [
    { key: "evolution", label: "Evolution" },
    { key: "bars", label: "Round Bars" },
    { key: "position", label: "Position" },
    { key: "heatmap", label: "Heatmap" },
  ];

  const hasSnapshots = data.some((d) => d.snapshots.length > 1);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="font-serif text-2xl font-bold mb-4">Trajectory</h1>

      {/* Sub-tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${
              tab === t.key
                ? "bg-augusta text-cream"
                : "bg-dark-card text-cream/60 hover:bg-dark-border"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!hasSnapshots && tab !== "heatmap" && (
        <div className="bg-dark-card border border-dark-border rounded-xl p-8 text-center text-cream/40">
          Trajectory will appear once the tournament is underway and scores are being polled.
        </div>
      )}

      {/* Evolution */}
      {tab === "evolution" && hasSnapshots && (
        <div className="bg-dark-card border border-dark-border rounded-xl p-4">
          <ResponsiveContainer width="100%" height={350}>
            <LineChart>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis
                dataKey="capturedAt"
                type="category"
                allowDuplicatedCategory={false}
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                tickFormatter={(v) => {
                  const d = new Date(v);
                  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
                }}
              />
              <YAxis
                reversed
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                domain={["auto", "auto"]}
                tickFormatter={(v) => (v === 0 ? "E" : v > 0 ? `+${v}` : String(v))}
              />
              <Tooltip
                contentStyle={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, fontSize: 12 }}
                labelFormatter={(v) => new Date(v as string).toLocaleTimeString()}
                formatter={(value: unknown, name: unknown) => {
                  const v = Number(value);
                  return [v === 0 ? "E" : v > 0 ? `+${v}` : v, String(name)];
                }}
              />
              <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="3 3" label={{ value: "E", fill: "#9ca3af", fontSize: 10 }} />
              {data.map((entry) => (
                <Line
                  key={entry.player.slug}
                  data={entry.snapshots.map((s) => ({
                    capturedAt: s.capturedAt,
                    [entry.player.name]: s.totalScoreToPar,
                  }))}
                  dataKey={entry.player.name}
                  name={entry.player.name}
                  stroke={entry.player.color ?? "#006747"}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-3 justify-center">
            {data.map((e) => (
              <span key={e.player.slug} className="flex items-center gap-1 text-xs">
                <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: e.player.color ?? "#006747" }} />
                {e.player.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Round Bars */}
      {tab === "bars" && (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((r) => {
            const roundData = heatmapData
              .filter((d) => d.rounds[r] != null)
              .map((d) => ({
                name: d.player.name,
                score: d.rounds[r]!,
                color: d.player.color ?? "#006747",
              }))
              .sort((a, b) => a.score - b.score);

            return (
              <div key={r} className="bg-dark-card border border-dark-border rounded-xl p-4">
                <h3 className="font-bold text-sm mb-2">Round {r}</h3>
                {roundData.length === 0 ? (
                  <div className="text-cream/40 text-sm">Round {r} — not yet started</div>
                ) : (
                  <ResponsiveContainer width="100%" height={roundData.length * 40 + 20}>
                    <BarChart data={roundData} layout="vertical" margin={{ left: 60 }}>
                      <XAxis type="number" tick={{ fontSize: 10, fill: "#9ca3af" }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#f5f1e8" }} width={55} />
                      <Tooltip
                        contentStyle={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8 }}
                        formatter={(v: unknown) => { const n = Number(v); return [n === 0 ? "E" : n > 0 ? `+${n}` : n, "Score"]; }}
                      />
                      <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                        {roundData.map((d, i) => (
                          <Cell key={i} fill={d.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Position Race */}
      {tab === "position" && hasSnapshots && (
        <div className="bg-dark-card border border-dark-border rounded-xl p-4">
          <ResponsiveContainer width="100%" height={350}>
            <LineChart>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis
                dataKey="round"
                type="category"
                allowDuplicatedCategory={false}
                tick={{ fontSize: 11, fill: "#9ca3af" }}
              />
              <YAxis
                reversed
                domain={[1, "auto"]}
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                label={{ value: "Position", angle: -90, position: "insideLeft", fill: "#9ca3af", fontSize: 10 }}
              />
              <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8 }} />
              {data.map((entry) => {
                // Get end-of-round positions
                const roundEndPositions: Array<{ round: string; [key: string]: unknown }> = [];
                for (let r = 1; r <= 4; r++) {
                  const roundSnaps = entry.snapshots.filter((s) => s.roundNumber === r);
                  const last = roundSnaps[roundSnaps.length - 1];
                  if (last?.positionNumeric) {
                    roundEndPositions.push({
                      round: `R${r}`,
                      [entry.player.name]: last.positionNumeric,
                    });
                  }
                }

                return (
                  <Line
                    key={entry.player.slug}
                    data={roundEndPositions}
                    dataKey={entry.player.name}
                    name={entry.player.name}
                    stroke={entry.player.color ?? "#006747"}
                    strokeWidth={2}
                    dot={{ r: 5, fill: entry.player.color ?? "#006747" }}
                    connectNulls
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Heatmap */}
      {tab === "heatmap" && (
        <div className="bg-dark-card border border-dark-border rounded-xl p-4 overflow-x-auto">
          <table className="w-full text-sm" style={{ fontVariantNumeric: "tabular-nums" }}>
            <thead>
              <tr className="text-xs text-cream/40 uppercase">
                <th className="text-left py-2 pr-2">Player</th>
                <th className="text-center w-14 py-2">R1</th>
                <th className="text-center w-14 py-2">R2</th>
                <th className="text-center w-14 py-2">R3</th>
                <th className="text-center w-14 py-2">R4</th>
                <th className="text-center w-14 py-2">Tot</th>
                <th className="text-center w-10 py-2">Pos</th>
              </tr>
            </thead>
            <tbody>
              {heatmapData.map((row) => (
                <tr key={row.player.name} className="border-t border-dark-border/30">
                  <td className="py-2 pr-2">
                    <div className="font-bold text-xs">{row.player.name}</div>
                    <div className="text-[10px] text-cream/40">{row.golfer.flagEmoji} {row.golfer.name}</div>
                  </td>
                  {[1, 2, 3, 4].map((r) => {
                    const score = row.rounds[r];
                    return (
                      <td key={r} className="text-center py-2">
                        <div
                          className="w-12 h-12 mx-auto rounded-md flex items-center justify-center font-mono font-bold text-sm"
                          style={{ backgroundColor: heatColor(score) }}
                        >
                          {score != null ? (score === 0 ? "E" : score > 0 ? `+${score}` : score) : "—"}
                        </div>
                      </td>
                    );
                  })}
                  <td className="text-center py-2 font-mono font-bold">
                    {row.totalToPar != null
                      ? row.totalToPar === 0 ? "E" : row.totalToPar > 0 ? `+${row.totalToPar}` : row.totalToPar
                      : "—"}
                  </td>
                  <td className="text-center py-2 text-cream/60 text-xs">{row.position ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function heatColor(score: number | null): string {
  if (score === null) return "#1a1a1a";
  if (score <= -4) return "#dc2626";
  if (score === -3) return "#ef4444";
  if (score === -2) return "#f87171";
  if (score === -1) return "#fca5a5";
  if (score === 0) return "#374151";
  if (score === 1) return "#93c5fd";
  if (score === 2) return "#60a5fa";
  if (score === 3) return "#3b82f6";
  return "#1e40af";
}
