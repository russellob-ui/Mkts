"use client";

import { useState, useEffect } from "react";
import { formatScore, timeAgo } from "@/lib/banter";

export default function AdminPage() {
  const [passcode, setPasscode] = useState("");
  const [authed, setAuthed] = useState(false);
  const [pollResult, setPollResult] = useState<string>("");
  const [pollLoading, setPollLoading] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteResult, setPasteResult] = useState("");
  const [roundNumber, setRoundNumber] = useState(1);
  const [lastPollTime, setLastPollTime] = useState<string | null>(null);
  const [overrideGolferId, setOverrideGolferId] = useState("");
  const [overridePosition, setOverridePosition] = useState("");
  const [overrideScore, setOverrideScore] = useState("");
  const [overrideRound, setOverrideRound] = useState("");
  const [overrideRoundScore, setOverrideRoundScore] = useState("");
  const [golfers, setGolfers] = useState<Array<{ id: number; name: string }>>([]);

  function login() {
    setAuthed(true);
  }

  useEffect(() => {
    if (authed) {
      // Load golfers for override
      fetch("/api/leaderboard")
        .then((r) => r.json())
        .then((d) => {
          if (d.entries) {
            setGolfers(d.entries.map((e: { golfer: { id: number; name: string } }) => e.golfer));
          }
          if (d.tournament?.lastPolledAt) {
            setLastPollTime(d.tournament.lastPolledAt);
          }
        });
    }
  }, [authed]);

  async function pollNow() {
    setPollLoading(true);
    setPollResult("");
    try {
      const res = await fetch("/api/cron/poll-scores", {
        headers: {
          "x-admin-passcode": passcode,
        },
      });
      const json = await res.json();
      setPollResult(JSON.stringify(json, null, 2));
      setLastPollTime(new Date().toISOString());
    } catch (err) {
      setPollResult(`Error: ${err}`);
    }
    setPollLoading(false);
  }

  async function pollOddsNow() {
    setPollLoading(true);
    setPollResult("");
    try {
      const res = await fetch("/api/cron/poll-odds", {
        method: "POST",
        headers: { "x-admin-passcode": passcode },
      });
      const json = await res.json();
      setPollResult(JSON.stringify(json, null, 2));
    } catch (err) {
      setPollResult(`Error: ${err}`);
    }
    setPollLoading(false);
  }

  async function pasteScores() {
    try {
      const res = await fetch("/api/admin/paste-scores", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-passcode": passcode,
        },
        body: JSON.stringify({ text: pasteText }),
      });
      const json = await res.json();
      setPasteResult(JSON.stringify(json, null, 2));
    } catch (err) {
      setPasteResult(`Error: ${err}`);
    }
  }

  async function markRoundComplete() {
    try {
      const res = await fetch("/api/admin/mark-round-complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-passcode": passcode,
        },
        body: JSON.stringify({ roundNumber }),
      });
      const json = await res.json();
      setPollResult(JSON.stringify(json, null, 2));
    } catch (err) {
      setPollResult(`Error: ${err}`);
    }
  }

  async function markTournamentFinished() {
    if (!confirm("Are you sure? This will calculate final position points.")) return;
    try {
      const res = await fetch("/api/admin/mark-tournament-finished", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-passcode": passcode,
        },
      });
      const json = await res.json();
      setPollResult(JSON.stringify(json, null, 2));
    } catch (err) {
      setPollResult(`Error: ${err}`);
    }
  }

  async function applyOverride() {
    try {
      const res = await fetch("/api/admin/override", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-passcode": passcode,
        },
        body: JSON.stringify({
          golferId: parseInt(overrideGolferId),
          position: overridePosition || undefined,
          scoreToPar: overrideScore ? parseInt(overrideScore) : undefined,
          roundNumber: overrideRound ? parseInt(overrideRound) : undefined,
          roundScore: overrideRoundScore ? parseInt(overrideRoundScore) : undefined,
        }),
      });
      const json = await res.json();
      setPollResult(JSON.stringify(json, null, 2));
    } catch (err) {
      setPollResult(`Error: ${err}`);
    }
  }

  async function reseed() {
    if (!confirm("This will re-seed only if the database is empty. Continue?")) return;
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      const json = await res.json();
      setPollResult(JSON.stringify(json, null, 2));
    } catch (err) {
      setPollResult(`Error: ${err}`);
    }
  }

  if (!authed) {
    return (
      <div className="max-w-md mx-auto px-4 py-20">
        <h1 className="font-serif text-2xl font-bold mb-4 text-center">Admin</h1>
        <div className="bg-dark-card border border-dark-border rounded-xl p-6">
          <input
            type="password"
            placeholder="Passcode"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
            className="w-full bg-dark border border-dark-border rounded-lg px-4 py-2 mb-3 text-cream"
          />
          <button
            onClick={login}
            className="w-full bg-augusta hover:bg-augusta-light text-cream py-2 rounded-lg font-bold transition-colors"
          >
            Enter
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <h1 className="font-serif text-2xl font-bold">Admin Panel</h1>

      {/* Poll Now */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-4">
        <h2 className="font-bold mb-2">Live Score Polling</h2>
        <div className="text-xs text-cream/40 mb-3">
          Last polled: {timeAgo(lastPollTime)}
        </div>
        <button
          onClick={pollNow}
          disabled={pollLoading}
          className="bg-augusta hover:bg-augusta-light disabled:opacity-50 text-cream px-6 py-2 rounded-lg font-bold transition-colors"
        >
          {pollLoading ? "Polling..." : "Poll Now"}
        </button>
        <button
          onClick={reseed}
          className="ml-3 bg-dark-border hover:bg-cream/20 text-cream px-4 py-2 rounded-lg text-sm transition-colors"
        >
          Re-seed DB
        </button>
      </div>

      {/* Poll Odds */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-4">
        <h2 className="font-bold mb-2">Live Odds Polling</h2>
        <p className="text-xs text-cream/40 mb-3">
          Fetches outright winner odds from The Odds API (requires ODDS_API_KEY env var)
        </p>
        <button
          onClick={pollOddsNow}
          disabled={pollLoading}
          className="bg-augusta hover:bg-augusta-light disabled:opacity-50 text-cream px-6 py-2 rounded-lg font-bold transition-colors"
        >
          {pollLoading ? "Polling..." : "Poll Odds Now"}
        </button>
      </div>

      {/* Round controls */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-4">
        <h2 className="font-bold mb-2">Round Controls</h2>
        <div className="flex items-center gap-3 mb-3">
          <select
            value={roundNumber}
            onChange={(e) => setRoundNumber(parseInt(e.target.value))}
            className="bg-dark border border-dark-border rounded-lg px-3 py-2 text-cream"
          >
            <option value={1}>Round 1</option>
            <option value={2}>Round 2</option>
            <option value={3}>Round 3</option>
            <option value={4}>Round 4</option>
          </select>
          <button
            onClick={markRoundComplete}
            className="bg-gold/80 hover:bg-gold text-dark px-4 py-2 rounded-lg font-bold text-sm transition-colors"
          >
            Mark Round Complete
          </button>
        </div>
        <button
          onClick={markTournamentFinished}
          className="bg-red-600/80 hover:bg-red-600 text-cream px-4 py-2 rounded-lg font-bold text-sm transition-colors"
        >
          Mark Tournament Finished
        </button>
      </div>

      {/* Paste fallback */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-4">
        <h2 className="font-bold mb-2">Paste Scores (Fallback)</h2>
        <p className="text-xs text-cream/40 mb-2">
          Format: &quot;1 BURNS -5 F -5&quot; or &quot;T3 ABERG -3 6 -3&quot;
        </p>
        <textarea
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          rows={6}
          placeholder="Paste leaderboard text here..."
          className="w-full bg-dark border border-dark-border rounded-lg px-3 py-2 text-cream text-sm font-mono mb-2"
        />
        <button
          onClick={pasteScores}
          className="bg-augusta hover:bg-augusta-light text-cream px-4 py-2 rounded-lg font-bold text-sm transition-colors"
        >
          Parse & Update
        </button>
        {pasteResult && (
          <pre className="mt-2 text-xs text-cream/60 overflow-auto max-h-32">
            {pasteResult}
          </pre>
        )}
      </div>

      {/* Manual override */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-4">
        <h2 className="font-bold mb-2">Manual Override</h2>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <select
            value={overrideGolferId}
            onChange={(e) => setOverrideGolferId(e.target.value)}
            className="bg-dark border border-dark-border rounded-lg px-3 py-2 text-cream text-sm col-span-2"
          >
            <option value="">Select golfer...</option>
            {golfers.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <input
            placeholder="Position (e.g. T3)"
            value={overridePosition}
            onChange={(e) => setOverridePosition(e.target.value)}
            className="bg-dark border border-dark-border rounded-lg px-3 py-2 text-cream text-sm"
          />
          <input
            placeholder="Score to par (e.g. -5)"
            value={overrideScore}
            onChange={(e) => setOverrideScore(e.target.value)}
            className="bg-dark border border-dark-border rounded-lg px-3 py-2 text-cream text-sm"
          />
          <input
            placeholder="Round # (1-4)"
            value={overrideRound}
            onChange={(e) => setOverrideRound(e.target.value)}
            className="bg-dark border border-dark-border rounded-lg px-3 py-2 text-cream text-sm"
          />
          <input
            placeholder="Round score to par"
            value={overrideRoundScore}
            onChange={(e) => setOverrideRoundScore(e.target.value)}
            className="bg-dark border border-dark-border rounded-lg px-3 py-2 text-cream text-sm"
          />
        </div>
        <button
          onClick={applyOverride}
          className="bg-gold/80 hover:bg-gold text-dark px-4 py-2 rounded-lg font-bold text-sm transition-colors"
        >
          Apply Override
        </button>
      </div>

      {/* Result output */}
      {pollResult && (
        <div className="bg-dark-card border border-dark-border rounded-xl p-4">
          <h2 className="font-bold mb-2 text-xs text-cream/40">Last Result</h2>
          <pre className="text-xs text-cream/60 overflow-auto max-h-64 whitespace-pre-wrap">
            {pollResult}
          </pre>
        </div>
      )}
    </div>
  );
}
