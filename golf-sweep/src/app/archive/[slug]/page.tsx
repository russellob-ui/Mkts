"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from "recharts";
import { timeAgo } from "@/lib/banter";

export default function ArchiveDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [leaderboard, setLeaderboard] = useState<unknown[]>([]);
  const [trajectories, setTrajectories] = useState<unknown[]>([]);
  const [banter, setBanter] = useState<unknown[]>([]);
  const [tournament, setTournament] = useState<{ name: string; status: string } | null>(null);
  const [tournamentId, setTournamentId] = useState<number | null>(null);

  useEffect(() => {
    // Find tournament by slug
    fetch("/api/archive")
      .then((r) => r.json())
      .then((data) => {
        const t = data.tournaments?.find((t: { slug: string }) => t.slug === slug);
        if (t) {
          setTournament({ name: t.name, status: t.status });
          setTournamentId(t.id);
        }
      });
  }, [slug]);

  useEffect(() => {
    if (!tournamentId) return;
    fetch(`/api/trajectory?tournamentId=${tournamentId}`)
      .then((r) => r.json())
      .then((d) => setTrajectories(d.trajectories ?? []));
    fetch(`/api/banter?tournamentId=${tournamentId}&limit=30`)
      .then((r) => r.json())
      .then((d) => setBanter(d.events ?? []));
  }, [tournamentId]);

  if (!tournament) {
    return <div className="max-w-3xl mx-auto px-4 py-8 text-center text-cream/40">Loading...</div>;
  }

  const hasTrajectory = (trajectories as Array<{ snapshots: unknown[] }>).some((t) => t.snapshots?.length > 1);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Hero */}
      <div className="text-center mb-6">
        <h1 className="font-serif text-3xl font-bold">{tournament.name}</h1>
        <div className="text-cream/50 text-sm mt-1">
          {tournament.status === "live" ? (
            <span className="text-augusta-light">LIVE</span>
          ) : tournament.status === "finished" ? (
            "Completed"
          ) : (
            "Upcoming"
          )}
        </div>
      </div>

      {/* Trajectory chart */}
      {hasTrajectory && (
        <div className="bg-dark-card border border-dark-border rounded-xl p-4 mb-6">
          <h3 className="font-serif text-sm font-bold text-cream/60 mb-3">Score Evolution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis dataKey="capturedAt" type="category" allowDuplicatedCategory={false} tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v) => { const d = new Date(v); return `${d.getHours()}:${String(d.getMinutes()).padStart(2,"0")}`; }} />
              <YAxis reversed tick={{ fontSize: 10, fill: "#9ca3af" }} tickFormatter={(v) => v === 0 ? "E" : v > 0 ? `+${v}` : String(v)} />
              <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, fontSize: 11 }} />
              <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="3 3" />
              {(trajectories as Array<{ player: { name: string; slug: string; color: string | null }; snapshots: Array<{ capturedAt: string; totalScoreToPar: number | null }> }>).map((entry) => (
                <Line
                  key={entry.player.slug}
                  data={entry.snapshots.map((s) => ({ capturedAt: s.capturedAt, [entry.player.name]: s.totalScoreToPar }))}
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
        </div>
      )}

      {/* Banter timeline */}
      <div className="mb-6">
        <h3 className="font-serif text-sm font-bold text-cream/60 mb-3">Banter Highlights</h3>
        {(banter as Array<{ id: number; headline: string; detail: string | null; emoji: string | null; createdAt: string; roundNumber: number | null; player: { color: string | null } | null }>).length > 0 ? (
          <div className="space-y-2">
            {(banter as Array<{ id: number; headline: string; detail: string | null; emoji: string | null; createdAt: string; roundNumber: number | null; player: { color: string | null } | null }>).map((e) => (
              <div key={e.id} className="bg-dark-card border border-dark-border rounded-lg p-3" style={{ borderLeft: `3px solid ${e.player?.color ?? "#006747"}` }}>
                <div className="flex items-start gap-2">
                  <span className="text-lg">{e.emoji ?? "⛳"}</span>
                  <div className="flex-1">
                    <span className="font-bold text-xs">{e.headline}</span>
                    {e.detail && <p className="text-[10px] text-cream/40 mt-0.5">{e.detail}</p>}
                  </div>
                  <span className="text-[9px] text-cream/20">{timeAgo(e.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-cream/30 text-sm">No banter events yet</div>
        )}
      </div>

      <div className="text-center">
        <Link href="/archive" className="text-augusta-light hover:text-cream text-sm transition-colors">
          Back to Archive
        </Link>
      </div>
    </div>
  );
}
