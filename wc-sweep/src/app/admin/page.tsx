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

interface InviteCode {
  id: number;
  code: string;
  used: boolean;
  usedBy: string | null;
  createdAt: string;
  usedAt: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  pass: "bg-green-600",
  warn: "bg-yellow-500",
  fail: "bg-red-600",
  healthy: "text-green-400",
  warning: "text-yellow-400",
  critical: "text-red-400",
};

const VERIFY_STORAGE_KEY = "wc_admin_verified";
const VERIFY_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

function getStoredVerification(): { verified: boolean; passcode: string; playerName: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(VERIFY_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (Date.now() - data.timestamp > VERIFY_EXPIRY_MS) {
      localStorage.removeItem(VERIFY_STORAGE_KEY);
      return null;
    }
    return { verified: true, passcode: data.passcode, playerName: data.playerName };
  } catch {
    return null;
  }
}

function storeVerification(passcode: string, playerName: string) {
  localStorage.setItem(
    VERIFY_STORAGE_KEY,
    JSON.stringify({ passcode, playerName, timestamp: Date.now() })
  );
}

export default function AdminPage() {
  // Auth gate
  const [verified, setVerified] = useState(false);
  const [commissionerName, setCommissionerName] = useState("");
  const [storedPasscode, setStoredPasscode] = useState("");
  const [gatePasscode, setGatePasscode] = useState("");
  const [gateLoading, setGateLoading] = useState(false);
  const [gateError, setGateError] = useState("");
  const [checkingStored, setCheckingStored] = useState(true);

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
  const [seedMatchesResult, setSeedMatchesResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [seedMatchesLoading, setSeedMatchesLoading] = useState(false);
  const [syncResult, setSyncResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [drawResult, setDrawResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [drawLoading, setDrawLoading] = useState(false);

  // Health
  const [health, setHealth] = useState<HealthResult | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);

  // Invite Codes
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [newCode, setNewCode] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Notifications
  const [notifStats, setNotifStats] = useState<{
    withEmail: number;
    withPhone: number;
    withPush: number;
  }>({ withEmail: 0, withPhone: 0, withPush: 0 });
  const [digestSending, setDigestSending] = useState(false);
  const [digestResult, setDigestResult] = useState<string | null>(null);
  const [pushTitle, setPushTitle] = useState("");
  const [pushBody, setPushBody] = useState("");
  const [pushSending, setPushSending] = useState(false);
  const [pushResult, setPushResult] = useState<string | null>(null);

  // Check stored verification on mount
  useEffect(() => {
    async function checkStored() {
      const stored = getStoredVerification();
      if (stored) {
        try {
          const res = await fetch("/api/admin/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ passcode: stored.passcode }),
          });
          const data = await res.json();
          if (data.verified) {
            setVerified(true);
            setCommissionerName(data.playerName);
            setStoredPasscode(stored.passcode);
          } else {
            localStorage.removeItem(VERIFY_STORAGE_KEY);
          }
        } catch {
          // Stored creds invalid, continue to gate
        }
      }
      setCheckingStored(false);
    }
    checkStored();
  }, []);

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

  const loadInviteCodes = useCallback(async () => {
    setInviteLoading(true);
    try {
      const res = await fetch("/api/invite");
      if (res.ok) {
        const data = await res.json();
        setInviteCodes(data.codes ?? []);
      }
    } catch {
      // ignore
    } finally {
      setInviteLoading(false);
    }
  }, []);

  const loadNotifStats = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/players");
      if (res.ok) {
        const data = await res.json();
        const allP = data.players ?? [];
        setNotifStats({
          withEmail: allP.filter((p: Record<string, unknown>) => p.email).length,
          withPhone: allP.filter((p: Record<string, unknown>) => p.phone).length,
          withPush: allP.filter((p: Record<string, unknown>) => p.pushSubscription).length,
        });
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (verified) {
      loadPlayers();
      loadInviteCodes();
      loadNotifStats();
    }
  }, [verified, loadPlayers, loadInviteCodes, loadNotifStats]);

  async function handleGateSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGateError("");
    setGateLoading(true);

    try {
      const res = await fetch("/api/admin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode: gatePasscode.trim() }),
      });
      const data = await res.json();

      if (data.verified) {
        storeVerification(gatePasscode.trim(), data.playerName);
        setVerified(true);
        setCommissionerName(data.playerName);
        setStoredPasscode(gatePasscode.trim());
      } else {
        setGateError("Access denied. Commissioner passcode required.");
      }
    } catch {
      setGateError("Network error. Please try again.");
    } finally {
      setGateLoading(false);
    }
  }

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
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminPasscode: storedPasscode }),
      });
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

  async function generateInviteCode() {
    setGeneratingCode(true);
    setNewCode(null);
    setCopiedCode(null);
    try {
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminPasscode: storedPasscode }),
      });
      const data = await res.json();
      if (res.ok) {
        setNewCode(data.code);
        loadInviteCodes();
      }
    } catch {
      // ignore
    } finally {
      setGeneratingCode(false);
    }
  }

  async function copyInviteLink(code: string) {
    const url = `${window.location.origin}/join?code=${code}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const el = document.createElement("textarea");
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1500);
    alert(`Copied!\n${url}`);
  }

  // Loading state while checking stored verification
  if (checkingStored) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <div className="text-cream/40 text-sm">Checking access...</div>
      </div>
    );
  }

  // Passcode gate
  if (!verified) {
    return (
      <div className="max-w-sm mx-auto px-4 py-16 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="font-serif text-2xl font-bold">
            <span className="text-wc-gold">Commissioner</span>{" "}
            <span className="text-cream">Access</span>
          </h1>
          <p className="text-cream/40 text-sm">
            Enter your commissioner passcode to continue.
          </p>
        </div>

        <form
          onSubmit={handleGateSubmit}
          className="bg-dark-card border border-dark-border rounded-lg p-6 space-y-4"
        >
          <input
            type="password"
            placeholder="Passcode"
            value={gatePasscode}
            onChange={(e) => setGatePasscode(e.target.value)}
            required
            autoFocus
            className="w-full bg-dark border border-dark-border rounded-lg px-3 py-2.5 text-sm text-cream placeholder:text-cream/30 focus:outline-none focus:border-wc-gold"
          />
          {gateError && (
            <div className="text-red-400 text-sm text-center bg-red-400/10 border border-red-400/20 rounded-lg p-3">
              {gateError}
            </div>
          )}
          <button
            type="submit"
            disabled={gateLoading}
            className="w-full bg-wc-gold text-dark font-semibold text-sm px-4 py-2.5 rounded-lg hover:bg-wc-gold/90 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {gateLoading ? "Verifying..." : "Enter"}
          </button>
        </form>
      </div>
    );
  }

  // Full admin dashboard (verified)
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl font-bold">
          <span className="text-wc-gold">Admin</span> Dashboard
        </h1>
        <div className="text-xs text-cream/40">
          Signed in as <span className="text-wc-gold">{commissionerName}</span>
        </div>
      </div>

      {/* ---- Invite Codes Section ---- */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-cream/60 uppercase tracking-wider">
          Invite Codes
        </h2>

        <div className="bg-dark-card border border-dark-border rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-cream/40">
              Generate codes and share links for friends to join.
            </p>
            <button
              type="button"
              onClick={generateInviteCode}
              disabled={generatingCode}
              className="bg-wc-gold text-dark font-semibold text-xs px-3 py-2 rounded-lg hover:bg-wc-gold/90 disabled:opacity-50 transition-colors cursor-pointer shrink-0"
            >
              {generatingCode ? "Generating..." : "Generate New Code"}
            </button>
          </div>

          {newCode && (
            <div className="bg-wc-gold/10 border border-wc-gold/30 rounded-lg p-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs text-cream/50 mb-1">New invite code:</div>
                <div className="font-mono text-lg font-bold text-wc-gold tracking-widest">
                  {newCode}
                </div>
              </div>
              <button
                type="button"
                onClick={() => copyInviteLink(newCode)}
                className="bg-wc-gold text-dark font-semibold text-xs px-3 py-2 rounded-lg hover:bg-wc-gold/90 transition-colors cursor-pointer shrink-0"
              >
                {copiedCode === newCode ? "Copied!" : "Copy Link"}
              </button>
            </div>
          )}

          {inviteLoading ? (
            <div className="text-cream/40 text-xs">Loading codes...</div>
          ) : inviteCodes.length === 0 ? (
            <div className="text-cream/40 text-xs">No invite codes yet.</div>
          ) : (
            <div className="space-y-1.5">
              {inviteCodes.map((ic) => (
                <div
                  key={ic.id}
                  className="flex items-center justify-between gap-3 py-2 px-3 bg-dark/50 rounded-lg"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        ic.used ? "bg-cream/30" : "bg-green-500"
                      }`}
                    />
                    <span className="font-mono text-sm font-semibold tracking-wider">
                      {ic.code}
                    </span>
                    {ic.used ? (
                      <span className="text-xs text-cream/40 truncate">
                        Used by {ic.usedBy}
                      </span>
                    ) : (
                      <span className="text-xs text-green-400">Available</span>
                    )}
                  </div>
                  {!ic.used && (
                    <button
                      type="button"
                      onClick={() => copyInviteLink(ic.code)}
                      className="text-xs text-wc-gold hover:text-wc-gold/80 transition-colors cursor-pointer shrink-0"
                    >
                      {copiedCode === ic.code ? "Copied!" : "Copy Link"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

          {/* Seed Matches */}
          <div className="bg-dark-card border border-dark-border rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold">Seed Matches</h3>
            <p className="text-xs text-cream/40">
              Generate group stage match schedule.
            </p>
            <button
              type="button"
              onClick={() =>
                runSetupAction(
                  "/api/admin/seed-matches",
                  setSeedMatchesLoading,
                  setSeedMatchesResult,
                  "Seed all group stage matches? This generates the full schedule."
                )
              }
              disabled={seedMatchesLoading}
              className="bg-wc-blue text-cream font-semibold text-xs px-3 py-2 rounded-lg hover:bg-wc-blue/80 disabled:opacity-50 transition-colors cursor-pointer w-full"
            >
              {seedMatchesLoading ? "Seeding..." : "Seed Matches"}
            </button>
            {seedMatchesResult && (
              <div
                className={`text-xs ${
                  seedMatchesResult.ok ? "text-green-400" : "text-red-400"
                }`}
              >
                {seedMatchesResult.msg}
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

      {/* ---- Notifications Section ---- */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-cream/60 uppercase tracking-wider">
          Notifications
        </h2>

        <div className="bg-dark-card border border-dark-border rounded-lg p-4 space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-dark/50 rounded-lg p-3">
              <div className="text-lg font-bold text-wc-gold">{notifStats.withEmail}</div>
              <div className="text-xs text-cream/40">With Email</div>
            </div>
            <div className="bg-dark/50 rounded-lg p-3">
              <div className="text-lg font-bold text-wc-gold">{notifStats.withPhone}</div>
              <div className="text-xs text-cream/40">With Phone</div>
            </div>
            <div className="bg-dark/50 rounded-lg p-3">
              <div className="text-lg font-bold text-wc-gold">{notifStats.withPush}</div>
              <div className="text-xs text-cream/40">Push Subs</div>
            </div>
          </div>

          {/* Send Test Digest */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={async () => {
                setDigestSending(true);
                setDigestResult(null);
                try {
                  const res = await fetch("/api/cron/daily-digest");
                  const data = await res.json();
                  if (res.ok) {
                    setDigestResult(`Sent ${data.sent} emails (${data.errors} errors)`);
                  } else {
                    setDigestResult(data.error ?? "Failed");
                  }
                } catch {
                  setDigestResult("Network error");
                } finally {
                  setDigestSending(false);
                }
              }}
              disabled={digestSending}
              className="w-full bg-wc-blue text-cream font-semibold text-sm px-4 py-2.5 rounded-lg hover:bg-wc-blue/80 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {digestSending ? "Sending Digest..." : "Send Test Digest"}
            </button>
            {digestResult && (
              <div className="text-xs text-center text-cream/60">{digestResult}</div>
            )}
          </div>

          {/* Send Push to All */}
          <div className="space-y-3 border-t border-dark-border pt-4">
            <h3 className="text-sm font-semibold text-cream/80">Send Push to All</h3>
            <input
              type="text"
              placeholder="Title"
              value={pushTitle}
              onChange={(e) => setPushTitle(e.target.value)}
              className="w-full bg-dark border border-dark-border rounded-lg px-3 py-2 text-sm text-cream placeholder:text-cream/30 focus:outline-none focus:border-wc-gold"
            />
            <input
              type="text"
              placeholder="Body"
              value={pushBody}
              onChange={(e) => setPushBody(e.target.value)}
              className="w-full bg-dark border border-dark-border rounded-lg px-3 py-2 text-sm text-cream placeholder:text-cream/30 focus:outline-none focus:border-wc-gold"
            />
            <button
              type="button"
              onClick={async () => {
                if (!pushTitle.trim() || !pushBody.trim()) return;
                setPushSending(true);
                setPushResult(null);
                try {
                  const res = await fetch("/api/push/send", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      title: pushTitle.trim(),
                      body: pushBody.trim(),
                      url: "/",
                    }),
                  });
                  const data = await res.json();
                  if (res.ok) {
                    setPushResult(`Sent to ${data.sent} (${data.errors} errors)`);
                    setPushTitle("");
                    setPushBody("");
                  } else {
                    setPushResult(data.error ?? "Failed");
                  }
                } catch {
                  setPushResult("Network error");
                } finally {
                  setPushSending(false);
                }
              }}
              disabled={pushSending || !pushTitle.trim() || !pushBody.trim()}
              className="w-full bg-wc-red text-cream font-semibold text-sm px-4 py-2.5 rounded-lg hover:bg-wc-red/80 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {pushSending ? "Sending..." : "Send Push Notification"}
            </button>
            {pushResult && (
              <div className="text-xs text-center text-cream/60">{pushResult}</div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
