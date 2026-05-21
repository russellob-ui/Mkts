"use client";

import { useState, useEffect, useCallback } from "react";

interface PlayerOption {
  id: number;
  name: string;
  slug: string;
}

interface TeamOption {
  teamId: number;
  name: string;
  flagEmoji: string;
  tier: number;
  eliminated: boolean;
}

interface Trade {
  id: number;
  proposerPlayerId: number;
  proposerTeamId: number;
  targetPlayerId: number;
  targetTeamId: number;
  status: string;
  proposedAt: string | null;
  resolvedAt: string | null;
  proposerName: string;
  targetName: string;
  proposerTeamName: string;
  proposerTeamFlag: string;
  targetTeamName: string;
  targetTeamFlag: string;
}

const LS_PLAYER_KEY = "wc_sweep_trade_player_id";
const LS_PASSCODE_KEY = "wc_sweep_trade_passcode";

export default function TradesPage() {
  const [players, setPlayers] = useState<PlayerOption[]>([]);
  const [myTeams, setMyTeams] = useState<TeamOption[]>([]);
  const [allAssignments, setAllAssignments] = useState<
    { playerId: number; teamId: number; name: string; flagEmoji: string; tier: number; eliminated: boolean }[]
  >([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [completedCounts, setCompletedCounts] = useState<Record<number, number>>({});

  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [passcode, setPasscode] = useState("");

  const [offerTeamId, setOfferTeamId] = useState<number | null>(null);
  const [targetPlayerId, setTargetPlayerId] = useState<number | null>(null);
  const [targetTeamId, setTargetTeamId] = useState<number | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Restore from localStorage
  useEffect(() => {
    const savedId = localStorage.getItem(LS_PLAYER_KEY);
    const savedPass = localStorage.getItem(LS_PASSCODE_KEY);
    if (savedId) setSelectedPlayerId(Number(savedId));
    if (savedPass) setPasscode(savedPass);
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (selectedPlayerId) localStorage.setItem(LS_PLAYER_KEY, String(selectedPlayerId));
  }, [selectedPlayerId]);
  useEffect(() => {
    if (passcode) localStorage.setItem(LS_PASSCODE_KEY, passcode);
  }, [passcode]);

  const loadData = useCallback(async () => {
    try {
      const [lbRes, tradeRes] = await Promise.all([
        fetch("/api/leaderboard"),
        fetch("/api/trades"),
      ]);
      const lbData = await lbRes.json();
      const tradeData = await tradeRes.json();

      const playerList: PlayerOption[] = lbData.leaderboard.map(
        (p: { playerId: number; playerName: string }) => ({
          id: p.playerId,
          name: p.playerName,
          slug: "",
        })
      );
      setPlayers(playerList);

      // Build full assignment list
      const assignments: typeof allAssignments = [];
      for (const p of lbData.leaderboard) {
        for (const t of p.teams) {
          assignments.push({
            playerId: p.playerId,
            teamId: t.teamId,
            name: t.teamName,
            flagEmoji: t.flagEmoji,
            tier: t.tier,
            eliminated: t.eliminated,
          });
        }
      }
      setAllAssignments(assignments);

      setTrades(tradeData.trades ?? []);
      setCompletedCounts(tradeData.completedCounts ?? {});
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Derive my teams
  useEffect(() => {
    if (!selectedPlayerId) {
      setMyTeams([]);
      return;
    }
    setMyTeams(
      allAssignments
        .filter((a) => a.playerId === selectedPlayerId && !a.eliminated)
        .map((a) => ({
          teamId: a.teamId,
          name: a.name,
          flagEmoji: a.flagEmoji,
          tier: a.tier,
          eliminated: a.eliminated,
        }))
    );
  }, [selectedPlayerId, allAssignments]);

  // Derive target teams
  const targetTeams = targetPlayerId
    ? allAssignments
        .filter((a) => a.playerId === targetPlayerId && !a.eliminated)
        .map((a) => ({
          teamId: a.teamId,
          name: a.name,
          flagEmoji: a.flagEmoji,
          tier: a.tier,
          eliminated: a.eliminated,
        }))
    : [];

  const otherPlayers = players.filter((p) => p.id !== selectedPlayerId);

  const myTradesRemaining = selectedPlayerId
    ? 1 - (completedCounts[selectedPlayerId] ?? 0)
    : 1;

  const pendingTrades = trades.filter((t) => t.status === "pending");
  const historyTrades = trades.filter((t) => t.status !== "pending");

  async function proposeTrade() {
    if (!selectedPlayerId || !offerTeamId || !targetPlayerId || !targetTeamId || !passcode) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposerPlayerId: selectedPlayerId,
          proposerTeamId: offerTeamId,
          targetPlayerId,
          targetTeamId,
          passcode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to propose trade");
      } else {
        setSuccess("Trade proposed!");
        setOfferTeamId(null);
        setTargetPlayerId(null);
        setTargetTeamId(null);
        await loadData();
      }
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  async function respondToTrade(tradeId: number, action: "accept" | "reject") {
    if (!passcode) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tradeId, action, passcode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to respond to trade");
      } else {
        setSuccess(action === "accept" ? "Trade accepted!" : "Trade rejected.");
        await loadData();
      }
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-dark text-cream">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-serif font-bold mb-2">
          <span className="text-wc-gold">Trade</span> Market
        </h1>
        <p className="text-cream/50 text-sm mb-6">
          Swap teams with other players. Each player gets 1 trade per tournament.
        </p>

        {/* Player selector */}
        <div className="bg-dark-card border border-dark-border rounded-xl p-4 mb-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-cream/50 block mb-1">Your name</label>
              <select
                value={selectedPlayerId ?? ""}
                onChange={(e) => {
                  setSelectedPlayerId(e.target.value ? Number(e.target.value) : null);
                  setOfferTeamId(null);
                  setTargetPlayerId(null);
                  setTargetTeamId(null);
                }}
                className="w-full bg-dark border border-dark-border rounded-lg px-3 py-2 text-sm text-cream"
              >
                <option value="">Select...</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-cream/50 block mb-1">Passcode</label>
              <input
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                className="w-full bg-dark border border-dark-border rounded-lg px-3 py-2 text-sm text-cream"
                placeholder="****"
              />
            </div>
          </div>
          {selectedPlayerId && (
            <div className="text-sm">
              <span className={myTradesRemaining > 0 ? "text-green-400" : "text-red-400"}>
                {myTradesRemaining > 0
                  ? `${myTradesRemaining} trade remaining`
                  : "No trades remaining"}
              </span>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-xl px-4 py-3 mb-4 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-900/30 border border-green-700 text-green-300 rounded-xl px-4 py-3 mb-4 text-sm">
            {success}
          </div>
        )}

        {/* Propose a trade */}
        {selectedPlayerId && myTradesRemaining > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-bold text-wc-gold mb-3">Propose a Trade</h2>
            <div className="bg-dark-card border border-dark-border rounded-xl p-4 space-y-3">
              <div>
                <label className="text-xs text-cream/50 block mb-1">You offer</label>
                <select
                  value={offerTeamId ?? ""}
                  onChange={(e) =>
                    setOfferTeamId(e.target.value ? Number(e.target.value) : null)
                  }
                  className="w-full bg-dark border border-dark-border rounded-lg px-3 py-2 text-sm text-cream"
                >
                  <option value="">Select your team...</option>
                  {myTeams.map((t) => (
                    <option key={t.teamId} value={t.teamId}>
                      {t.flagEmoji} {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="text-center text-cream/30 text-xl">&#8693;</div>

              <div>
                <label className="text-xs text-cream/50 block mb-1">Trade with</label>
                <select
                  value={targetPlayerId ?? ""}
                  onChange={(e) => {
                    setTargetPlayerId(e.target.value ? Number(e.target.value) : null);
                    setTargetTeamId(null);
                  }}
                  className="w-full bg-dark border border-dark-border rounded-lg px-3 py-2 text-sm text-cream"
                >
                  <option value="">Select player...</option>
                  {otherPlayers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {targetPlayerId && (
                <div>
                  <label className="text-xs text-cream/50 block mb-1">For their team</label>
                  <select
                    value={targetTeamId ?? ""}
                    onChange={(e) =>
                      setTargetTeamId(e.target.value ? Number(e.target.value) : null)
                    }
                    className="w-full bg-dark border border-dark-border rounded-lg px-3 py-2 text-sm text-cream"
                  >
                    <option value="">Select their team...</option>
                    {targetTeams.map((t) => (
                      <option key={t.teamId} value={t.teamId}>
                        {t.flagEmoji} {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                onClick={proposeTrade}
                disabled={
                  submitting ||
                  !offerTeamId ||
                  !targetPlayerId ||
                  !targetTeamId ||
                  !passcode
                }
                className="w-full bg-wc-gold text-dark font-bold py-3 rounded-lg hover:bg-wc-gold/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                {submitting ? "Proposing..." : "Propose Trade"}
              </button>
            </div>
          </section>
        )}

        {/* Pending trades */}
        <section className="mb-8">
          <h2 className="text-lg font-bold text-wc-gold mb-3">Pending Trades</h2>
          {pendingTrades.length === 0 ? (
            <p className="text-cream/40 text-sm">No pending trades.</p>
          ) : (
            <div className="space-y-3">
              {pendingTrades.map((trade) => {
                const isTarget = trade.targetPlayerId === selectedPlayerId;
                return (
                  <div
                    key={trade.id}
                    className="bg-dark-card border border-dark-border rounded-xl p-4"
                  >
                    <div className="text-sm mb-2">
                      <span className="font-bold text-cream">
                        {trade.proposerName}
                      </span>{" "}
                      <span className="text-cream/50">offers</span>{" "}
                      <span className="text-cream font-semibold">
                        {trade.proposerTeamFlag} {trade.proposerTeamName}
                      </span>{" "}
                      <span className="text-cream/50">for</span>{" "}
                      <span className="font-bold text-cream">
                        {trade.targetName}
                      </span>
                      &apos;s{" "}
                      <span className="text-cream font-semibold">
                        {trade.targetTeamFlag} {trade.targetTeamName}
                      </span>
                    </div>
                    {trade.proposedAt && (
                      <div className="text-xs text-cream/30 mb-2">
                        {new Date(trade.proposedAt).toLocaleDateString()}
                      </div>
                    )}
                    {isTarget && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => respondToTrade(trade.id, "accept")}
                          disabled={submitting}
                          className="flex-1 bg-green-600 text-white font-bold py-2 rounded-lg hover:bg-green-500 disabled:opacity-40 transition-colors cursor-pointer text-sm"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => respondToTrade(trade.id, "reject")}
                          disabled={submitting}
                          className="flex-1 bg-red-600 text-white font-bold py-2 rounded-lg hover:bg-red-500 disabled:opacity-40 transition-colors cursor-pointer text-sm"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Trade history */}
        <section>
          <h2 className="text-lg font-bold text-cream/60 mb-3">Trade History</h2>
          {historyTrades.length === 0 ? (
            <p className="text-cream/40 text-sm">No completed trades yet.</p>
          ) : (
            <div className="space-y-2">
              {historyTrades.map((trade) => (
                <div
                  key={trade.id}
                  className={`bg-dark-card border rounded-xl p-3 text-sm ${
                    trade.status === "accepted"
                      ? "border-green-800/50"
                      : "border-red-800/50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${
                        trade.status === "accepted"
                          ? "bg-green-900/50 text-green-400"
                          : "bg-red-900/50 text-red-400"
                      }`}
                    >
                      {trade.status}
                    </span>
                    <span className="text-cream/70">
                      {trade.proposerName}&apos;s {trade.proposerTeamFlag}{" "}
                      {trade.proposerTeamName} &harr; {trade.targetName}&apos;s{" "}
                      {trade.targetTeamFlag} {trade.targetTeamName}
                    </span>
                  </div>
                  {trade.resolvedAt && (
                    <div className="text-xs text-cream/30 mt-1">
                      {new Date(trade.resolvedAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
