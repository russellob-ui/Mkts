"use client";

import { useState, useEffect, useCallback } from "react";

interface PlayerRow {
  id: number;
  name: string;
  slug: string;
  avatarEmoji: string | null;
  color: string | null;
  teamCount: number;
}

interface HealthCheck {
  name: string;
  status: "pass" | "warn" | "fail";
  detail: string;
}

interface HealthResult {
  status: "healthy" | "warning" | "critical";
  checks: HealthCheck[];
  timestamp: string;
}

const STATUS_COLORS: Record<string, string> = {
  pass: "bg-green-600",
  warn: "bg-yellow-500",
  fail: "bg-red-600",
  healthy: "text-green-400",
  warning: "text-yellow-400",
  critical: "text-red-400",
};

export default function AdminPage() {
  // Players
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [playersLoading, setPlayersLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newPasscode, setNewPasscode] = useState("");
  const [newColor, setNewColor] = useState("#d4a843");
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [playerError, setPlayerError] = useState("");

  // Setup actions
  const [seedResult, setSeedResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [seedLoading, setSeedLoading] = useState(false);
  const [syncResult, setSyncResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [drawResult, setDrawResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [drawLoading, setDrawLoading] = useState(false);

  // Health
  const [health, setHealth] = useState<HealthResult | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);

  const loadPlayers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/players");
      if (res.ok) {
        const data = await res.json();
        setPlayers(data.players ?? []);
      }
    } catch {
      // ignore
    } finally {
      setPlayersLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlayers();
  }, [loadPlayers]);

  async function addPlayer(e: React.FormEvent) {
    e.preventDefault();
    setPlayerError("");
    setAddingPlayer(true);
    try {
      const res = await fetch("/api/admin/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          passcode: newPasscode,
          color: newColor,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPlayerError(data.error ?? "Failed to add player");
      } else {
        setNewName("");
        setNewPasscode("");
        setNewColor("#d4a843");
        loadPlayers();
      }
    } catch {
      setPlayerError("Network error");
    } finally {
      setAddingPlayer(false);
    }
  }

  async function runSetupAction(
    url: string,
    setLoading: (v: boolean) => void,
    setResult: (v: { ok: boolean; msg: string } | null) => void,
    confirmMsg: string
  ) {
    if (!window.confirm(confirmMsg)) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(url, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setResult({ ok: true, msg: data.message ?? "Done" });
      } else {
        setResult({ ok: false, msg: data.error ?? `Failed (${res.status})` });
      }
    } catch (err) {
      setResult({ ok: false, msg: String(err) });
    } finally {
      setLoading(false);
    }
  }

  async function runHealthCheck() {
    setHealthLoading(true);
    setHealth(null);
    try {
      const res = await fetch("/api/health-check");
      if (res.ok) {
        const data: HealthResult = await res.json();
        setHealth(data);
      } else {
        setHealth({
          status: "critical",
          checks: [{ name: "Request", status: "fail", detail: `HTTP ${res.status}` }],
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err) {
      setHealth({
        status: "critical",
        checks: [{ name: "Request", status: "fail", detail: String(err) }],
        timestamp: new Date().toISOString(),
      });
    } finally {
      setHealthLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
      <h1 className="font-serif text-2xl font-bold">
        <span className="text-wc-gold">Admin</span> Dashboard
      </h1>

      {/* ---- Players Section ---- */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-cream/60 uppercase tracking-wider">
          Players
        </h2>

        {playersLoading ? (
          <div className="text-cream/40 text-sm">Loading players...</div>
        ) : players.length === 0 ? (
          <div className="bg-dark-card border border-dark-border rounded-lg p-4 text-cream/40 text-sm">
            No players yet.
          </div>
        ) : (
          <div className="space-y-2">
            {players.map((p) => (
              <div
                key={p.id}
                className="bg-dark-card border border-dark-border rounded-lg p-3 flex items-center gap-3"
              >
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: p.color ?? "#888" }}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{p.name}</div>
                  <div className="text-xs text-cream/40">{p.slug}</div>
                </div>
                <div className="text-xs text-cream/50">
                  {p.teamCount} team{p.teamCount !== 1 ? "s" : ""}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add player form */}
        <form
          onSubmit={addPlayer}
          className="bg-dark-card border border-dark-border rounded-lg p-4 space-y-3"
        >
          <h3 className="text-sm font-semibold text-cream/80">Add Player</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
              className="bg-dark border border-dark-border rounded-lg px-3 py-2 text-sm text-cream placeholder:text-cream/30 focus:outline-none focus:border-wc-gold"
            />
            <input
              type="text"
              placeholder="Passcode"
              value={newPasscode}
              onChange={(e) => setNewPasscode(e.target.value)}
              required
              className="bg-dark border border-dark-border rounded-lg px-3 py-2 text-sm text-cream placeholder:text-cream/30 focus:outline-none focus:border-wc-gold"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-cream/50">Color:</label>
            <input
              type="color"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              className="w-8 h-8 rounded border border-dark-border cursor-pointer bg-transparent"
            />
            <span className="text-xs text-cream/40 font-mono">{newColor}</span>
          </div>
          {playerError && (
            <div className="text-red-400 text-xs">{playerError}</div>
          )}
          <button
            type="submit"
            disabled={addingPlayer}
            className="bg-wc-gold text-dark font-semibold text-sm px-4 py-2 rounded-lg hover:bg-wc-gold/90 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {addingPlayer ? "Adding..." : "Add Player"}
          </button>
        </form>
      </section>

      {/* ---- Tournament Setup Section ---- */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-cream/60 uppercase tracking-wider">
          Tournament Setup
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Seed Teams */}
          <div className="bg-dark-card border border-dark-border rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold">Seed Teams</h3>
            <p className="text-xs text-cream/40">
              Populate 48 World Cup teams from seed data.
            </p>
            <button
              type="button"
              onClick={() =>
                runSetupAction(
                  "/api/admin/seed-teams",
                  setSeedLoading,
                  setSeedResult,
                  "Seed all 48 teams? This may overwrite existing team data."
                )
              }
              disabled={seedLoading}
              className="bg-wc-blue text-cream font-semibold text-xs px-3 py-2 rounded-lg hover:bg-wc-blue/80 disabled:opacity-50 transition-colors cursor-pointer w-full"
            >
              {seedLoading ? "Seeding..." : "Seed Teams"}
            </button>
            {seedResult && (
              <div
                className={`text-xs ${
                  seedResult.ok ? "text-green-400" : "text-red-400"
                }`}
              >
                {seedResult.msg}
              </div>
            )}
          </div>

          {/* Sync Fixtures */}
          <div className="bg-dark-card border border-dark-border rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold">Sync Fixtures</h3>
            <p className="text-xs text-cream/40">
              Pull match fixtures from API-Football.
            </p>
            <button
              type="button"
              onClick={() =>
                runSetupAction(
                  "/api/admin/sync-fixtures",
                  setSyncLoading,
                  setSyncResult,
                  "Sync all fixtures from API-Football?"
                )
              }
              disabled={syncLoading}
              className="bg-wc-blue text-cream font-semibold text-xs px-3 py-2 rounded-lg hover:bg-wc-blue/80 disabled:opacity-50 transition-colors cursor-pointer w-full"
            >
              {syncLoading ? "Syncing..." : "Sync Fixtures"}
            </button>
            {syncResult && (
              <div
                className={`text-xs ${
                  syncResult.ok ? "text-green-400" : "text-red-400"
                }`}
              >
                {syncResult.msg}
              </div>
            )}
          </div>

          {/* Run Draw */}
          <div className="bg-dark-card border border-dark-border rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold">Run Draw</h3>
            <p className="text-xs text-cream/40">
              Randomly assign teams to players.
            </p>
            <button
              type="button"
              onClick={() =>
                runSetupAction(
                  "/api/draw/start",
                  setDrawLoading,
                  setDrawResult,
                  "Start the draw? This will assign teams to players."
                )
              }
              disabled={drawLoading}
              className="bg-wc-red text-cream font-semibold text-xs px-3 py-2 rounded-lg hover:bg-wc-red/80 disabled:opacity-50 transition-colors cursor-pointer w-full"
            >
              {drawLoading ? "Drawing..." : "Run Draw"}
            </button>
            {drawResult && (
              <div
                className={`text-xs ${
                  drawResult.ok ? "text-green-400" : "text-red-400"
                }`}
              >
                {drawResult.msg}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ---- Health Check Section ---- */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-cream/60 uppercase tracking-wider">
          Health Check
        </h2>
        <button
          type="button"
          onClick={runHealthCheck}
          disabled={healthLoading}
          className="bg-wc-green text-cream font-semibold text-sm px-4 py-2 rounded-lg hover:bg-wc-green/80 disabled:opacity-50 transition-colors cursor-pointer"
        >
          {healthLoading ? "Checking..." : "Run Health Check"}
        </button>

        {health && (
          <div className="bg-dark-card border border-dark-border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className={`font-semibold text-sm ${STATUS_COLORS[health.status] ?? "text-cream"}`}>
                {health.status.toUpperCase()}
              </span>
              <span className="text-xs text-cream/40">
                {new Date(health.timestamp).toLocaleTimeString("en-GB")}
              </span>
            </div>
            <div className="space-y-2">
              {health.checks.map((check, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span
                    className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${
                      STATUS_COLORS[check.status] ?? "bg-gray-500"
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{check.name}</div>
                    <div className="text-xs text-cream/40 break-words">
                      {check.detail}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
