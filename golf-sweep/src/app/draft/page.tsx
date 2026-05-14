"use client";

import { useEffect, useState, useCallback } from "react";
import { formatScore, scoreClass } from "@/lib/banter";

interface PlayerInfo {
  id: number;
  name: string;
  slug: string;
  color: string | null;
  avatarEmoji: string | null;
}

interface PickInfo {
  player: PlayerInfo;
  golfer: { id: number; name: string; flagEmoji: string | null };
}

interface FieldEntry {
  name: string;
  position: string;
  scoreToPar: number;
  thru: string;
  taken: boolean;
  takenBy: string | null;
}

interface DraftStatus {
  tournament: { id: number; name: string; status: string } | null;
  picksMade: PickInfo[];
  waiting: PlayerInfo[];
  field: FieldEntry[];
}

export default function DraftPage() {
  const [status, setStatus] = useState<DraftStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Player selection + auth
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerInfo | null>(null);
  const [passcode, setPasscode] = useState("");

  // Search/filter
  const [search, setSearch] = useState("");

  // Pick state
  const [picking, setPicking] = useState(false);
  const [pickResult, setPickResult] = useState<{
    success: boolean;
    golferName?: string;
    error?: string;
  } | null>(null);

  const allPlayers = [
    ...(status?.picksMade.map((p) => p.player) ?? []),
    ...(status?.waiting ?? []),
  ].sort((a, b) => a.name.localeCompare(b.name));

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/draft/status");
      if (!res.ok) {
        const json = await res.json();
        setError(json.error ?? "Failed to load draft status");
        return;
      }
      const json: DraftStatus = await res.json();
      setStatus(json);
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 15_000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Check if selected player already picked
  const myPick = status?.picksMade.find(
    (p) => p.player.id === selectedPlayer?.id
  );

  async function handlePick(golferName: string) {
    if (!selectedPlayer || !status?.tournament) return;

    setPicking(true);
    setPickResult(null);

    try {
      const res = await fetch("/api/draft/pick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: selectedPlayer.id,
          passcode,
          golferName,
          tournamentId: status.tournament.id,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setPickResult({ success: false, error: json.error });
      } else {
        setPickResult({ success: true, golferName: json.pick.golfer.name });
        // Refresh the status
        await fetchStatus();
      }
    } catch (err) {
      setPickResult({ success: false, error: String(err) });
    } finally {
      setPicking(false);
    }
  }

  // Filter field by search
  const filteredField = (status?.field ?? []).filter((f) =>
    search
      ? f.name.toLowerCase().includes(search.toLowerCase())
      : true
  );

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center text-cream/60">
        Loading draft...
      </div>
    );
  }

  if (error && !status) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center text-red-400">
        {error}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="font-serif text-3xl md:text-4xl font-bold text-cream mb-1">
          Pick Your Golfer
        </h1>
        <p className="text-cream/50 text-sm">
          {status?.tournament?.name ?? "Tournament"} — First come, first served
        </p>
      </div>

      {/* Player selector + passcode (if not yet picked) */}
      {!myPick && (
        <div className="bg-dark-card border border-dark-border rounded-xl p-4 mb-6">
          <h2 className="font-serif text-lg font-bold mb-3">Who are you?</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            {allPlayers.map((p) => {
              const hasPicked = status?.picksMade.some(
                (pm) => pm.player.id === p.id
              );
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedPlayer(p)}
                  disabled={hasPicked}
                  className={`px-3 py-2 rounded-lg text-sm font-bold transition-colors border ${
                    selectedPlayer?.id === p.id
                      ? "border-augusta-light bg-augusta/30 text-cream"
                      : hasPicked
                        ? "border-dark-border bg-dark text-cream/30 cursor-not-allowed"
                        : "border-dark-border bg-dark hover:bg-dark-border text-cream/80"
                  }`}
                  style={{
                    borderLeftColor: p.color ?? "#006747",
                    borderLeftWidth: "3px",
                  }}
                >
                  {p.name}
                  {hasPicked && " ✓"}
                </button>
              );
            })}
          </div>

          {selectedPlayer && (
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="Enter your passcode"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                className="flex-1 bg-dark border border-dark-border rounded-lg px-4 py-2 text-cream text-sm"
              />
            </div>
          )}

          {pickResult && !pickResult.success && (
            <div className="mt-3 bg-red-900/30 border border-red-800/50 rounded-lg px-4 py-2 text-sm text-red-300">
              {pickResult.error}
            </div>
          )}
        </div>
      )}

      {/* Confirmation after picking */}
      {(myPick || pickResult?.success) && (
        <div className="bg-augusta/20 border border-augusta/40 rounded-xl p-6 mb-6 text-center">
          <div className="text-3xl mb-2">⛳</div>
          <h2 className="font-serif text-2xl font-bold text-augusta-light mb-1">
            Pick Locked In!
          </h2>
          <p className="text-cream/70">
            {selectedPlayer?.name ?? myPick?.player.name} &rarr;{" "}
            <span className="font-bold text-cream">
              {pickResult?.golferName ?? myPick?.golfer.name}
            </span>
          </p>
        </div>
      )}

      {/* Draft status: who picked, who's waiting */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-4 mb-6">
        <h3 className="font-serif text-sm font-bold text-cream/60 mb-3">
          Draft Status ({status?.picksMade.length ?? 0}/{allPlayers.length} picked)
        </h3>

        {/* Picks made */}
        {(status?.picksMade ?? []).map((pm) => (
          <div
            key={pm.player.id}
            className="flex items-center justify-between py-2 border-b border-dark-border/40 last:border-0"
            style={{ borderLeft: `3px solid ${pm.player.color ?? "#006747"}`, paddingLeft: "12px" }}
          >
            <span className="font-bold text-sm">{pm.player.name}</span>
            <span className="text-sm text-cream/60">
              {pm.golfer.flagEmoji} {pm.golfer.name}
            </span>
          </div>
        ))}

        {/* Waiting */}
        {(status?.waiting ?? []).map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between py-2 border-b border-dark-border/40 last:border-0"
            style={{ borderLeft: `3px solid ${p.color ?? "#006747"}`, paddingLeft: "12px" }}
          >
            <span className="font-bold text-sm text-cream/40">{p.name}</span>
            <span className="text-xs text-cream/30 italic">waiting...</span>
          </div>
        ))}
      </div>

      {/* Leaderboard / field — only show if player hasn't picked yet (or always for reference) */}
      <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-dark-border flex items-center justify-between">
          <h3 className="font-serif text-lg font-bold">
            {status?.tournament?.name} Field
          </h3>
          <span className="text-xs text-cream/40">
            {filteredField.length} golfers
          </span>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-dark-border">
          <input
            type="text"
            placeholder="Search golfers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-dark border border-dark-border rounded-lg px-4 py-2 text-cream text-sm"
          />
        </div>

        {/* Header row */}
        <div className="grid grid-cols-[40px_1fr_60px_50px_80px] gap-1 px-4 py-2 text-xs text-cream/40 uppercase tracking-wider border-b border-dark-border">
          <span>Pos</span>
          <span>Player</span>
          <span className="text-right">Score</span>
          <span className="text-right">Thru</span>
          <span className="text-right">Action</span>
        </div>

        {/* Golfer rows */}
        {filteredField.map((f) => {
          const canPick =
            selectedPlayer &&
            passcode &&
            !myPick &&
            !pickResult?.success &&
            !f.taken;

          return (
            <div
              key={f.name}
              className={`grid grid-cols-[40px_1fr_60px_50px_80px] gap-1 items-center px-4 py-3 border-b border-dark-border/40 last:border-0 ${
                f.taken ? "opacity-50" : ""
              }`}
            >
              {/* Position */}
              <span className="text-sm font-mono font-bold text-cream/80">
                {f.position || "-"}
              </span>

              {/* Name + taken info */}
              <div className="min-w-0">
                <span className="text-sm font-bold truncate block">
                  {f.name}
                </span>
                {f.taken && (
                  <span className="text-xs text-cream/40">
                    Picked by {f.takenBy}
                  </span>
                )}
              </div>

              {/* Score */}
              <span
                className={`text-right font-mono font-bold ${scoreClass(f.scoreToPar)}`}
              >
                {formatScore(f.scoreToPar)}
              </span>

              {/* Thru */}
              <span className="text-right text-sm text-cream/60">
                {f.thru || "-"}
              </span>

              {/* Pick button */}
              <div className="text-right">
                {f.taken ? (
                  <span className="text-xs text-cream/30">Taken</span>
                ) : canPick ? (
                  <button
                    onClick={() => handlePick(f.name)}
                    disabled={picking}
                    className="bg-augusta hover:bg-augusta-light disabled:opacity-50 text-cream px-3 py-1 rounded-lg text-xs font-bold transition-colors"
                  >
                    {picking ? "..." : "Pick"}
                  </button>
                ) : (
                  <span className="text-xs text-cream/20">-</span>
                )}
              </div>
            </div>
          );
        })}

        {filteredField.length === 0 && (
          <div className="px-4 py-8 text-center text-cream/40 text-sm">
            {search ? "No golfers match your search" : "Loading field..."}
          </div>
        )}
      </div>
    </div>
  );
}
