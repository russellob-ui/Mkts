"use client";

import { useEffect, useState } from "react";

interface Scorer {
  playerName: string;
  teamName: string;
  flagEmoji: string;
  goals: number;
  ownerName: string | null;
  ownerColor: string | null;
}

interface Assister {
  playerName: string;
  teamName: string;
  flagEmoji: string;
  assists: number;
  ownerName: string | null;
  ownerColor: string | null;
}

interface GoldenBootData {
  scorers: Scorer[];
  assists: Assister[];
}

export default function GoldenBootPage() {
  const [data, setData] = useState<GoldenBootData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"goals" | "assists">("goals");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/golden-boot");
        if (res.ok) {
          const json: GoldenBootData = await res.json();
          setData(json);
        }
      } catch {
        // API not ready
      } finally {
        setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Group totals by sweep owner
  const ownerGoalTotals: Record<string, { name: string; color: string; total: number }> = {};
  if (data) {
    for (const s of data.scorers) {
      if (s.ownerName) {
        const key = s.ownerName;
        if (!ownerGoalTotals[key]) {
          ownerGoalTotals[key] = {
            name: s.ownerName,
            color: s.ownerColor ?? "#ffffff",
            total: 0,
          };
        }
        ownerGoalTotals[key].total += s.goals;
      }
    }
  }

  const ownerAssistTotals: Record<string, { name: string; color: string; total: number }> = {};
  if (data) {
    for (const a of data.assists) {
      if (a.ownerName) {
        const key = a.ownerName;
        if (!ownerAssistTotals[key]) {
          ownerAssistTotals[key] = {
            name: a.ownerName,
            color: a.ownerColor ?? "#ffffff",
            total: 0,
          };
        }
        ownerAssistTotals[key].total += a.assists;
      }
    }
  }

  const sortedOwnerGoals = Object.values(ownerGoalTotals).sort(
    (a, b) => b.total - a.total
  );

  const sortedOwnerAssists = Object.values(ownerAssistTotals).sort(
    (a, b) => b.total - a.total
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-1">
        <h1 className="font-serif text-3xl font-bold tracking-tight">
          Golden <span className="text-wc-gold">Boot</span>
        </h1>
        <p className="text-cream/40 text-xs uppercase tracking-widest">
          Top Scorers &amp; Assisters
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-dark-card border border-dark-border rounded-lg p-1">
        <button
          onClick={() => setTab("goals")}
          className={`flex-1 py-2 rounded-md text-sm font-semibold transition-colors ${
            tab === "goals"
              ? "bg-wc-gold/20 text-wc-gold border border-wc-gold/30"
              : "text-cream/50 hover:text-cream/70 border border-transparent"
          }`}
        >
          Goals
        </button>
        <button
          onClick={() => setTab("assists")}
          className={`flex-1 py-2 rounded-md text-sm font-semibold transition-colors ${
            tab === "assists"
              ? "bg-wc-gold/20 text-wc-gold border border-wc-gold/30"
              : "text-cream/50 hover:text-cream/70 border border-transparent"
          }`}
        >
          Assists
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-cream/40">Loading...</div>
      ) : !data ? (
        <div className="text-center py-12 text-cream/40">
          Failed to load data
        </div>
      ) : tab === "goals" ? (
        <>
          {/* Goals Table */}
          {data.scorers.length === 0 ? (
            <div className="bg-dark-card border border-dark-border rounded-lg p-8 text-center text-cream/40">
              No goals scored yet
            </div>
          ) : (
            <div className="bg-dark-card border border-dark-border rounded-lg divide-y divide-dark-border/50">
              {data.scorers.map((s, i) => (
                <div
                  key={`${s.playerName}-${s.teamName}`}
                  className={`flex items-center gap-3 px-3 py-2.5 ${
                    i === 0 ? "bg-wc-gold/5" : ""
                  }`}
                >
                  <span
                    className={`text-sm font-bold w-6 text-center ${
                      i === 0
                        ? "text-wc-gold"
                        : i === 1
                          ? "text-cream/60"
                          : i === 2
                            ? "text-amber-700"
                            : "text-cream/30"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="text-lg">{s.flagEmoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-sm truncate">
                        {s.playerName}
                      </span>
                      {i === 0 && <span title="Golden Boot leader">&#128095;</span>}
                    </div>
                    <div className="text-xs text-cream/40">{s.teamName}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-wc-gold">
                      {s.goals}
                    </div>
                    {s.ownerName && (
                      <div
                        className="text-xs font-medium"
                        style={{ color: s.ownerColor ?? "#ffffff" }}
                      >
                        {s.ownerName}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Owner Summary */}
          {sortedOwnerGoals.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-cream/50 uppercase tracking-wider mb-3">
                Goals by Sweep Player
              </h2>
              <div className="bg-dark-card border border-dark-border rounded-lg divide-y divide-dark-border/50">
                {sortedOwnerGoals.map((o) => (
                  <div
                    key={o.name}
                    className="flex items-center justify-between px-3 py-2.5"
                  >
                    <span
                      className="font-semibold text-sm"
                      style={{ color: o.color }}
                    >
                      {o.name}
                    </span>
                    <span className="text-sm font-bold text-cream/70">
                      {o.total} goal{o.total !== 1 ? "s" : ""}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <>
          {/* Assists Table */}
          {data.assists.length === 0 ? (
            <div className="bg-dark-card border border-dark-border rounded-lg p-8 text-center text-cream/40">
              No assists recorded yet
            </div>
          ) : (
            <div className="bg-dark-card border border-dark-border rounded-lg divide-y divide-dark-border/50">
              {data.assists.map((a, i) => (
                <div
                  key={`${a.playerName}-${a.teamName}`}
                  className={`flex items-center gap-3 px-3 py-2.5 ${
                    i === 0 ? "bg-wc-gold/5" : ""
                  }`}
                >
                  <span
                    className={`text-sm font-bold w-6 text-center ${
                      i === 0
                        ? "text-wc-gold"
                        : i === 1
                          ? "text-cream/60"
                          : i === 2
                            ? "text-amber-700"
                            : "text-cream/30"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="text-lg">{a.flagEmoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">
                      {a.playerName}
                    </div>
                    <div className="text-xs text-cream/40">{a.teamName}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-wc-gold">
                      {a.assists}
                    </div>
                    {a.ownerName && (
                      <div
                        className="text-xs font-medium"
                        style={{ color: a.ownerColor ?? "#ffffff" }}
                      >
                        {a.ownerName}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Owner Summary */}
          {sortedOwnerAssists.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-cream/50 uppercase tracking-wider mb-3">
                Assists by Sweep Player
              </h2>
              <div className="bg-dark-card border border-dark-border rounded-lg divide-y divide-dark-border/50">
                {sortedOwnerAssists.map((o) => (
                  <div
                    key={o.name}
                    className="flex items-center justify-between px-3 py-2.5"
                  >
                    <span
                      className="font-semibold text-sm"
                      style={{ color: o.color }}
                    >
                      {o.name}
                    </span>
                    <span className="text-sm font-bold text-cream/70">
                      {o.total} assist{o.total !== 1 ? "s" : ""}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
