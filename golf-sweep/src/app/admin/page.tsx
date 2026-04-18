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
  const [tournamentList, setTournamentList] = useState<Array<{ id: number; name: string; status: string }>>([]);
  const [activateResult, setActivateResult] = useState("");

  // Passcode manager
  const [playerList, setPlayerList] = useState<Array<{ id: number; name: string; hasPasscode: boolean; passcodePreview: string }>>([]);
  const [passcodeEdits, setPasscodeEdits] = useState<Record<number, string>>({});
  const [passcodeResult, setPasscodeResult] = useState("");
  const [bulkPasscode, setBulkPasscode] = useState("");

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

      // Ensure all 4 tournaments exist (self-heal if seed was partial)
      fetch("/api/seed", { method: "POST" })
        .then(() => fetch("/api/season"))
        .then((r) => r.json())
        .then((d) => {
          if (d.tournaments) {
            setTournamentList(d.tournaments);
          }
        })
        .catch(() => {});

      // Load players for passcode manager
      fetch("/api/admin/set-passcode", {
        headers: { "x-admin-passcode": passcode },
      })
        .then((r) => r.json())
        .then((d) => setPlayerList(d.players ?? []))
        .catch(() => {});
    }
  }, [authed, passcode]);

  async function setPlayerPasscode(playerId: number) {
    const newPasscode = passcodeEdits[playerId];
    if (!newPasscode || !/^\d{4}$/.test(newPasscode)) {
      setPasscodeResult("Passcode must be exactly 4 digits");
      return;
    }
    try {
      const res = await fetch("/api/admin/set-passcode", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-passcode": passcode,
        },
        body: JSON.stringify({ playerId, newPasscode }),
      });
      const json = await res.json();
      if (json.error) {
        setPasscodeResult(`Error: ${json.error}`);
      } else {
        setPasscodeResult(`Updated ${playerList.find((p) => p.id === playerId)?.name}'s passcode`);
        // Clear the input + reload list
        setPasscodeEdits((prev) => ({ ...prev, [playerId]: "" }));
        const res2 = await fetch("/api/admin/set-passcode", {
          headers: { "x-admin-passcode": passcode },
        });
        const json2 = await res2.json();
        setPlayerList(json2.players ?? []);
      }
    } catch (err) {
      setPasscodeResult(`Error: ${err}`);
    }
  }

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

      {/* Activate Tournament */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-4">
        <h2 className="font-bold mb-2">Tournament Activation</h2>
        <p className="text-xs text-cream/40 mb-3">
          Flip an upcoming tournament to live, create rounds, and look up Slash Golf ID.
        </p>
        <div className="space-y-2">
          {tournamentList.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold flex-1">{t.name}</span>
              <span className={`text-xs px-2 py-0.5 rounded ${
                t.status === "live" ? "bg-green-600/30 text-green-400" :
                t.status === "finished" ? "bg-cream/10 text-cream/40" :
                "bg-gold/20 text-gold"
              }`}>
                {t.status}
              </span>
              {t.status === "upcoming" && (
                <button
                  onClick={async () => {
                    if (!confirm(`Activate "${t.name}"? This will set it to live.`)) return;
                    setActivateResult("");
                    try {
                      const res = await fetch("/api/admin/activate-tournament", {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          "x-admin-passcode": passcode,
                        },
                        body: JSON.stringify({ tournamentId: t.id }),
                      });
                      const json = await res.json();
                      setActivateResult(JSON.stringify(json, null, 2));
                      // Refresh tournament list
                      const res2 = await fetch("/api/season");
                      const json2 = await res2.json();
                      if (json2.tournaments) setTournamentList(json2.tournaments);
                    } catch (err) {
                      setActivateResult(`Error: ${err}`);
                    }
                  }}
                  className="bg-augusta hover:bg-augusta-light text-cream px-3 py-1 rounded text-xs font-bold transition-colors"
                >
                  Activate
                </button>
              )}
            </div>
          ))}
        </div>
        {activateResult && (
          <pre className="mt-3 text-xs text-cream/60 overflow-auto max-h-32 whitespace-pre-wrap">
            {activateResult}
          </pre>
        )}
      </div>

      {/* Passcode Manager */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-4">
        <h2 className="font-bold mb-1">Player Passcodes</h2>
        <p className="text-xs text-cream/40 mb-3">
          Set 4-digit passcodes for each player. Duplicates are allowed — chat verifies player+passcode together.
        </p>

        {/* Bulk set — one passcode for everyone */}
        <div className="bg-dark/50 border border-dark-border rounded-lg p-3 mb-3">
          <div className="text-xs text-cream/50 mb-2">Set same passcode for ALL players:</div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              placeholder="1234"
              value={bulkPasscode}
              onChange={(e) => setBulkPasscode(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="bg-dark border border-dark-border rounded px-2 py-1 text-cream text-sm w-20 text-center font-mono"
            />
            <button
              onClick={async () => {
                if (bulkPasscode.length !== 4) {
                  setPasscodeResult("Must be 4 digits");
                  return;
                }
                let count = 0;
                for (const p of playerList) {
                  const res = await fetch("/api/admin/set-passcode", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "x-admin-passcode": passcode },
                    body: JSON.stringify({ playerId: p.id, newPasscode: bulkPasscode }),
                  });
                  if (res.ok) count++;
                }
                setPasscodeResult(`Set ${count}/${playerList.length} players to ${bulkPasscode}`);
                setBulkPasscode("");
                // Refresh list
                const res2 = await fetch("/api/admin/set-passcode", {
                  headers: { "x-admin-passcode": passcode },
                });
                const json2 = await res2.json();
                setPlayerList(json2.players ?? []);
              }}
              disabled={bulkPasscode.length !== 4}
              className="bg-gold/80 hover:bg-gold disabled:opacity-30 text-dark px-4 py-1 rounded text-xs font-bold transition-colors"
            >
              Set All
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {playerList.map((p) => (
            <div key={p.id} className="flex items-center gap-2">
              <span className="text-sm font-bold flex-1">{p.name}</span>
              <span className="text-xs text-cream/40 w-12">
                {p.hasPasscode ? p.passcodePreview : "—"}
              </span>
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                placeholder="1234"
                value={passcodeEdits[p.id] ?? ""}
                onChange={(e) =>
                  setPasscodeEdits((prev) => ({
                    ...prev,
                    [p.id]: e.target.value.replace(/\D/g, "").slice(0, 4),
                  }))
                }
                className="bg-dark border border-dark-border rounded px-2 py-1 text-cream text-sm w-16 text-center font-mono"
              />
              <button
                onClick={() => setPlayerPasscode(p.id)}
                disabled={!passcodeEdits[p.id] || passcodeEdits[p.id].length !== 4}
                className="bg-augusta hover:bg-augusta-light disabled:opacity-30 text-cream px-3 py-1 rounded text-xs font-bold transition-colors"
              >
                Set
              </button>
            </div>
          ))}
        </div>
        {passcodeResult && (
          <div className="mt-3 text-xs text-cream/60">{passcodeResult}</div>
        )}
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
