"use client";

import { useEffect, useState } from "react";

interface Assignment {
  teamId: number;
  playerId: number;
  drawOrder: number;
  teamName: string;
  flagEmoji: string;
  tier: number;
  groupLetter: string;
  playerName: string;
  playerColor: string;
}

interface DrawStatus {
  status: "not_started" | "live" | "complete";
  seed?: string;
  completedAt?: string | null;
  assignments?: Assignment[];
}

const TIER_LABELS: Record<number, string> = {
  1: "T1",
  2: "T2",
  3: "T3",
  4: "T4",
};

const TIER_COLORS: Record<number, string> = {
  1: "tier-1",
  2: "tier-2",
  3: "tier-3",
  4: "tier-4",
};

const TIER_BG: Record<number, string> = {
  1: "bg-yellow-500/15 border-yellow-500/30",
  2: "bg-gray-300/15 border-gray-300/30",
  3: "bg-orange-400/15 border-orange-400/30",
  4: "bg-green-500/15 border-green-500/30",
};

export default function DrawPage() {
  const [data, setData] = useState<DrawStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchStatus() {
    try {
      const res = await fetch("/api/draw/status");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // API not ready
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3_000);
    return () => clearInterval(interval);
  }, []);

  async function runDraw() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/draw/start", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to run draw");
      } else {
        await fetchStatus();
      }
    } catch {
      setError("Network error");
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center text-cream/40">
        Loading...
      </div>
    );
  }

  // Not started
  if (!data || data.status === "not_started") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="font-serif text-3xl font-bold">
            <span className="text-wc-gold">The Draw</span>
          </h1>
          <p className="text-cream/50 text-sm">
            FIFA World Cup 2026 Team Assignment
          </p>
        </div>
        <div className="bg-dark-card border border-dark-border rounded-lg p-8 text-center space-y-4">
          <p className="text-cream/60 text-lg">
            Draw hasn&apos;t started yet
          </p>
          <p className="text-cream/40 text-sm">
            Once the draw is run, teams will be randomly assigned to all
            players.
          </p>
          <button
            onClick={runDraw}
            disabled={running}
            className="px-6 py-3 bg-wc-gold text-dark font-bold rounded-lg hover:bg-wc-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {running ? "Running Draw..." : "Run Draw"}
          </button>
          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}
        </div>
      </div>
    );
  }

  // Complete — show assignments grid
  const assignments = data.assignments ?? [];

  // Group assignments by player
  const playerMap = new Map<
    string,
    { playerName: string; playerColor: string; teams: Assignment[] }
  >();
  for (const a of assignments) {
    const key = String(a.playerId);
    if (!playerMap.has(key)) {
      playerMap.set(key, {
        playerName: a.playerName,
        playerColor: a.playerColor ?? "#ffffff",
        teams: [],
      });
    }
    playerMap.get(key)!.teams.push(a);
  }

  // Sort teams within each player by tier then name
  for (const entry of playerMap.values()) {
    entry.teams.sort((a, b) => a.tier - b.tier || a.teamName.localeCompare(b.teamName));
  }

  const playerEntries = Array.from(playerMap.entries());

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="font-serif text-3xl font-bold">
          <span className="text-wc-gold">The Draw</span>
        </h1>
        <p className="text-cream/50 text-sm">
          {data.seed ? `Seed: ${data.seed}` : "Draw Complete"}
          {data.completedAt &&
            ` · ${new Date(data.completedAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}`}
        </p>
      </div>

      {/* Tier legend */}
      <div className="flex items-center justify-center gap-4 text-xs text-cream/50">
        <span>
          <span className="tier-1 font-bold">T1</span> Gold
        </span>
        <span>
          <span className="tier-2 font-bold">T2</span> Silver
        </span>
        <span>
          <span className="tier-3 font-bold">T3</span> Bronze
        </span>
        <span>
          <span className="tier-4 font-bold">T4</span> Green
        </span>
      </div>

      {/* Player columns — stack on mobile, grid on larger screens */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {playerEntries.map(([playerId, entry]) => {
          const tierCounts: Record<number, number> = {};
          for (const t of entry.teams) {
            tierCounts[t.tier] = (tierCounts[t.tier] ?? 0) + 1;
          }

          return (
            <div
              key={playerId}
              className="bg-dark-card border border-dark-border rounded-lg overflow-hidden"
            >
              {/* Player header */}
              <div
                className="px-4 py-3 border-b border-dark-border flex items-center justify-between"
                style={{ borderLeftColor: entry.playerColor, borderLeftWidth: 3 }}
              >
                <span className="font-semibold text-sm">
                  {entry.playerName}
                </span>
                <span className="text-xs text-cream/40">
                  {entry.teams.length} teams
                </span>
              </div>

              {/* Teams list */}
              <div className="divide-y divide-dark-border/50">
                {entry.teams.map((t) => (
                  <div
                    key={t.teamId}
                    className="px-4 py-2 flex items-center gap-3"
                  >
                    <span className="text-lg leading-none">{t.flagEmoji}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium truncate block">
                        {t.teamName}
                      </span>
                      <span className="text-xs text-cream/40">
                        Group {t.groupLetter}
                      </span>
                    </div>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded border ${TIER_BG[t.tier] ?? ""} ${TIER_COLORS[t.tier] ?? ""}`}
                    >
                      {TIER_LABELS[t.tier] ?? `T${t.tier}`}
                    </span>
                  </div>
                ))}
              </div>

              {/* Tier summary */}
              <div className="px-4 py-2 border-t border-dark-border bg-dark-card/50 flex gap-3 text-xs text-cream/50">
                {[1, 2, 3, 4].map(
                  (tier) =>
                    tierCounts[tier] != null && (
                      <span key={tier}>
                        <span className={TIER_COLORS[tier]}>{TIER_LABELS[tier]}</span>
                        : {tierCounts[tier]}
                      </span>
                    )
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
