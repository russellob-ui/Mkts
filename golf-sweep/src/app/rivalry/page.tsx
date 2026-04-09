"use client";
import { useEffect, useState } from "react";

interface RivalryData {
  playerA: { name: string; color: string | null; totalPoints: number };
  playerB: { name: string; color: string | null; totalPoints: number };
  headToHead: Array<{ tournament: string; aPoints: number; bPoints: number; winner: string }>;
  h2hRecord: { aWins: number; bWins: number; ties: number };
  intensity: number;
}

export default function RivalryPage() {
  const [players, setPlayers] = useState<Array<{ name: string; slug: string }>>([]);
  const [playerA, setPlayerA] = useState("");
  const [playerB, setPlayerB] = useState("");
  const [data, setData] = useState<RivalryData | null>(null);

  useEffect(() => {
    fetch("/api/season").then(r => r.json()).then(d => {
      setPlayers((d.standings ?? []).map((s: { player: { name: string; slug: string } }) => s.player));
    });
  }, []);

  useEffect(() => {
    if (playerA && playerB && playerA !== playerB) {
      fetch(`/api/rivalry?playerA=${playerA}&playerB=${playerB}`)
        .then(r => r.json()).then(setData);
    }
  }, [playerA, playerB]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="font-serif text-2xl font-bold mb-6">Rivalries</h1>

      <div className="flex gap-3 mb-6">
        <select value={playerA} onChange={e => setPlayerA(e.target.value)}
          className="flex-1 bg-dark border border-dark-border rounded-lg px-3 py-2 text-cream text-sm">
          <option value="">Select player...</option>
          {players.map(p => <option key={p.slug} value={p.slug}>{p.name}</option>)}
        </select>
        <span className="self-center text-cream/40 font-bold">vs</span>
        <select value={playerB} onChange={e => setPlayerB(e.target.value)}
          className="flex-1 bg-dark border border-dark-border rounded-lg px-3 py-2 text-cream text-sm">
          <option value="">Select player...</option>
          {players.map(p => <option key={p.slug} value={p.slug}>{p.name}</option>)}
        </select>
      </div>

      {data && (
        <div className="space-y-4">
          {/* Points comparison */}
          <div className="bg-dark-card border border-dark-border rounded-xl p-4">
            <h3 className="text-xs text-cream/40 uppercase mb-2">Season Points</h3>
            <div className="flex items-center justify-between">
              <div className="text-center">
                <div className="font-bold text-lg" style={{ color: data.playerA.color ?? "#006747" }}>{data.playerA.totalPoints}</div>
                <div className="text-xs text-cream/50">{data.playerA.name}</div>
              </div>
              <div className="flex-1 mx-4 h-2 bg-dark-border rounded-full overflow-hidden flex">
                <div className="h-full rounded-l-full" style={{
                  width: `${Math.max(5, (data.playerA.totalPoints / Math.max(data.playerA.totalPoints + data.playerB.totalPoints, 1)) * 100)}%`,
                  backgroundColor: data.playerA.color ?? "#006747"
                }} />
                <div className="h-full rounded-r-full" style={{
                  width: `${Math.max(5, (data.playerB.totalPoints / Math.max(data.playerA.totalPoints + data.playerB.totalPoints, 1)) * 100)}%`,
                  backgroundColor: data.playerB.color ?? "#dc2626"
                }} />
              </div>
              <div className="text-center">
                <div className="font-bold text-lg" style={{ color: data.playerB.color ?? "#dc2626" }}>{data.playerB.totalPoints}</div>
                <div className="text-xs text-cream/50">{data.playerB.name}</div>
              </div>
            </div>
          </div>

          {/* H2H per major */}
          <div className="bg-dark-card border border-dark-border rounded-xl p-4">
            <h3 className="text-xs text-cream/40 uppercase mb-2">Head to Head</h3>
            {data.headToHead.map((h, i) => (
              <div key={i} className="flex justify-between text-sm py-1 border-b border-dark-border/20 last:border-0">
                <span className="text-cream/50">{h.tournament}</span>
                <span>
                  <span style={{ color: h.winner === "A" ? data.playerA.color ?? "#006747" : "inherit" }}>{h.aPoints}</span>
                  <span className="text-cream/20 mx-2">·</span>
                  <span style={{ color: h.winner === "B" ? data.playerB.color ?? "#dc2626" : "inherit" }}>{h.bPoints}</span>
                </span>
              </div>
            ))}
            <div className="mt-2 text-xs text-cream/40">
              H2H Record: {data.h2hRecord.aWins}-{data.h2hRecord.bWins}{data.h2hRecord.ties > 0 ? `-${data.h2hRecord.ties}` : ""}
            </div>
          </div>

          {/* Intensity */}
          <div className="text-center text-sm text-cream/50">
            Rivalry Intensity: {"🔥".repeat(data.intensity)}{"⬛".repeat(5 - data.intensity)}
          </div>
        </div>
      )}

      {!data && playerA && playerB && playerA === playerB && (
        <div className="text-center text-cream/40 text-sm">Pick two different players</div>
      )}
    </div>
  );
}
