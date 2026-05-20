"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Player {
  playerId: number;
  playerName: string;
}

interface UpcomingMatch {
  id: number;
  homeTeam: string;
  awayTeam: string;
  homeFlag: string;
  awayFlag: string;
  kickoff: string;
  stage: string;
}

interface WildcardStatus {
  hasUsed: boolean;
  usedOnMatchId: number | null;
  matchName: string | null;
}

export default function WildcardsPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [wildcardStatus, setWildcardStatus] = useState<WildcardStatus | null>(
    null
  );
  const [upcomingMatches, setUpcomingMatches] = useState<UpcomingMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [confirmMatchId, setConfirmMatchId] = useState<number | null>(null);
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Load player list from leaderboard
  useEffect(() => {
    async function loadPlayers() {
      try {
        const res = await fetch("/api/leaderboard");
        if (res.ok) {
          const data = await res.json();
          const lb = data.leaderboard ?? [];
          setPlayers(
            lb.map((p: { playerId: number; playerName: string }) => ({
              playerId: p.playerId,
              playerName: p.playerName,
            }))
          );
        }
      } catch {
        // ignore
      }
    }
    loadPlayers();

    // Restore from localStorage
    const saved = typeof window !== "undefined"
      ? localStorage.getItem("wc_sweep_player_id")
      : null;
    if (saved) {
      setSelectedPlayerId(parseInt(saved, 10));
    }
  }, []);

  // Load upcoming matches
  useEffect(() => {
    async function loadMatches() {
      try {
        const res = await fetch("/api/matches?status=scheduled&limit=20");
        if (res.ok) {
          const data = await res.json();
          setUpcomingMatches(data.matches ?? []);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    loadMatches();
  }, []);

  // Load wildcard status when player selected
  useEffect(() => {
    if (!selectedPlayerId) return;

    async function loadStatus() {
      try {
        const res = await fetch(`/api/wildcards?playerId=${selectedPlayerId}`);
        if (res.ok) {
          const data = await res.json();
          setWildcardStatus(data);
        }
      } catch {
        // ignore
      }
    }
    loadStatus();

    // Persist
    if (typeof window !== "undefined") {
      localStorage.setItem(
        "wc_sweep_player_id",
        String(selectedPlayerId)
      );
    }
  }, [selectedPlayerId]);

  async function activateWildcard(matchId: number) {
    if (!selectedPlayerId) return;
    setActivating(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/wildcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: selectedPlayerId,
          matchId,
          passcode,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccessMsg(data.message ?? "Wildcard activated!");
        setWildcardStatus({
          hasUsed: true,
          usedOnMatchId: matchId,
          matchName: null,
        });
        setConfirmMatchId(null);
        setPasscode("");
      } else {
        setError(data.error ?? "Failed to activate");
      }
    } catch {
      setError("Network error");
    } finally {
      setActivating(false);
    }
  }

  function formatKickoff(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <Link href="/" className="text-cream/40 text-sm hover:text-cream/70">
        &larr; Back
      </Link>

      <div className="text-center space-y-2">
        <h1 className="font-serif text-3xl font-bold">
          <span className="text-wc-gold">Power</span>
          <span className="text-cream">-Ups</span>
        </h1>
        <p className="text-cream/40 text-sm">
          One-time abilities to boost your score
        </p>
      </div>

      {/* Player selector */}
      <div>
        <label className="block text-sm text-cream/60 mb-1">
          Select your name
        </label>
        <select
          value={selectedPlayerId ?? ""}
          onChange={(e) =>
            setSelectedPlayerId(
              e.target.value ? parseInt(e.target.value, 10) : null
            )
          }
          className="w-full bg-dark-card border border-dark-border rounded-lg px-3 py-2 text-cream text-sm focus:outline-none focus:border-wc-gold/50"
        >
          <option value="">Choose player...</option>
          {players.map((p) => (
            <option key={p.playerId} value={p.playerId}>
              {p.playerName}
            </option>
          ))}
        </select>
      </div>

      {selectedPlayerId && (
        <>
          {/* Wildcard card */}
          {wildcardStatus?.hasUsed ? (
            <div className="rounded-xl border border-dark-border p-6 text-center bg-dark-card">
              <div className="text-5xl mb-3">{"🃏"}</div>
              <div className="font-serif text-xl font-bold text-cream/50 mb-2">
                DOUBLE POINTS
              </div>
              <div className="inline-block bg-wc-gold/20 border border-wc-gold/40 text-wc-gold text-xs font-bold px-3 py-1 rounded-full mb-3">
                LOCKED IN
              </div>
              {wildcardStatus.matchName && (
                <div className="text-sm text-cream/60 mt-2">
                  Used on: {wildcardStatus.matchName}
                </div>
              )}
              {wildcardStatus.usedOnMatchId && !wildcardStatus.matchName && (
                <div className="text-sm text-cream/60 mt-2">
                  Used on Match #{wildcardStatus.usedOnMatchId}
                </div>
              )}
            </div>
          ) : (
            <>
              <div
                className="rounded-xl border-2 border-transparent p-6 text-center relative overflow-hidden"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(147,51,234,0.25) 0%, rgba(212,168,67,0.25) 50%, rgba(147,51,234,0.25) 100%)",
                  borderImage:
                    "linear-gradient(135deg, #9333ea, #d4a843, #9333ea) 1",
                }}
              >
                <div className="text-6xl mb-3">{"🃏"}</div>
                <div
                  className="font-serif text-2xl font-bold mb-2"
                  style={{
                    background: "linear-gradient(90deg, #d4a843, #9333ea)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  DOUBLE POINTS
                </div>
                <p className="text-sm text-cream/60 max-w-md mx-auto">
                  Choose one match &mdash; all points from that match will be
                  doubled! Use wisely, you only get one.
                </p>
              </div>

              {/* Success message */}
              {successMsg && (
                <div className="bg-green-900/30 border border-green-500/40 rounded-lg p-4 text-center text-green-400 text-sm">
                  {successMsg}
                </div>
              )}

              {/* Error message */}
              {error && (
                <div className="bg-red-900/30 border border-red-500/40 rounded-lg p-4 text-center text-red-400 text-sm">
                  {error}
                </div>
              )}

              {/* Upcoming matches to use wildcard on */}
              <section>
                <h2 className="text-sm font-semibold text-cream/60 uppercase tracking-wider mb-3">
                  Upcoming Matches
                </h2>
                <div className="space-y-2">
                  {upcomingMatches.length === 0 && !loading && (
                    <div className="text-center text-cream/40 py-4 text-sm">
                      No upcoming matches available
                    </div>
                  )}
                  {loading && (
                    <div className="text-center text-cream/40 py-4 text-sm">
                      Loading matches...
                    </div>
                  )}
                  {upcomingMatches.map((m) => (
                    <div
                      key={m.id}
                      className="bg-dark-card border border-dark-border rounded-lg px-4 py-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">
                            {m.homeFlag} {m.homeTeam}{" "}
                            <span className="text-cream/40">vs</span>{" "}
                            {m.awayTeam} {m.awayFlag}
                          </div>
                          <div className="text-xs text-cream/40 mt-0.5">
                            {m.stage} &middot; {formatKickoff(m.kickoff)}
                          </div>
                        </div>
                        <div className="shrink-0 ml-3">
                          {confirmMatchId === m.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="password"
                                placeholder="Passcode"
                                value={passcode}
                                onChange={(e) => setPasscode(e.target.value)}
                                className="w-24 bg-dark border border-dark-border rounded px-2 py-1 text-xs text-cream focus:outline-none focus:border-wc-gold/50"
                              />
                              <button
                                onClick={() => activateWildcard(m.id)}
                                disabled={activating || !passcode}
                                className="bg-wc-gold text-dark text-xs font-bold px-3 py-1 rounded hover:bg-wc-gold/90 disabled:opacity-50 cursor-pointer"
                              >
                                {activating ? "..." : "CONFIRM"}
                              </button>
                              <button
                                onClick={() => {
                                  setConfirmMatchId(null);
                                  setPasscode("");
                                  setError(null);
                                }}
                                className="text-cream/40 text-xs hover:text-cream cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setConfirmMatchId(m.id);
                                setError(null);
                                setSuccessMsg(null);
                              }}
                              className="text-xs font-bold px-3 py-1.5 rounded border border-wc-gold/50 text-wc-gold hover:bg-wc-gold/10 transition-colors cursor-pointer"
                            >
                              USE HERE
                            </button>
                          )}
                        </div>
                      </div>
                      {confirmMatchId === m.id && (
                        <div className="mt-2 text-xs text-amber-400/80 bg-amber-900/20 border border-amber-500/20 rounded px-3 py-2">
                          Are you sure? This cannot be undone! Enter your
                          passcode to confirm.
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
