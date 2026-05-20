"use client";

import { useState, useEffect, useRef } from "react";

interface BingoCell {
  text: string;
  completed: boolean;
}

interface PlayerOption {
  id: number;
  name: string;
  slug: string;
  color: string | null;
}

const LS_PLAYER_ID = "wc_sweep_player_id";

export default function BingoPage() {
  const [card, setCard] = useState<BingoCell[][] | null>(null);
  const [players, setPlayers] = useState<PlayerOption[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [completedCount, setCompletedCount] = useState(0);
  const [bingoLines, setBingoLines] = useState(0);
  const [isFullHouse, setIsFullHouse] = useState(false);
  const [points, setPoints] = useState(0);
  const [showBingo, setShowBingo] = useState(false);

  const initializedRef = useRef(false);
  const prevBingoLines = useRef(0);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    try {
      const savedId = localStorage.getItem(LS_PLAYER_ID);
      if (savedId) setSelectedPlayerId(Number(savedId));
    } catch {
      // localStorage unavailable
    }
  }, []);

  useEffect(() => {
    try {
      if (selectedPlayerId !== null)
        localStorage.setItem(LS_PLAYER_ID, String(selectedPlayerId));
    } catch {
      // localStorage unavailable
    }
  }, [selectedPlayerId]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const url = selectedPlayerId
          ? `/api/bingo?playerId=${selectedPlayerId}`
          : "/api/bingo";
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setPlayers(data.players ?? []);
          if (data.card) {
            setCard(data.card);
            setCompletedCount(data.completedCount ?? 0);
            setBingoLines(data.bingoLines ?? 0);
            setIsFullHouse(data.isFullHouse ?? false);
            setPoints(data.points ?? 0);

            // Trigger celebration if new bingo line
            if (data.bingoLines > prevBingoLines.current && prevBingoLines.current >= 0) {
              setShowBingo(true);
              setTimeout(() => setShowBingo(false), 3000);
            }
            prevBingoLines.current = data.bingoLines;
          }
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();

    if (selectedPlayerId) {
      const interval = setInterval(load, 30000);
      return () => clearInterval(interval);
    }
  }, [selectedPlayerId]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Bingo celebration overlay */}
      {showBingo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-dark/80 animate-pulse pointer-events-none">
          <div className="text-center space-y-4">
            <div className="text-7xl font-serif font-black text-wc-gold animate-bounce">
              BINGO!
            </div>
            <div className="text-2xl text-cream/80">
              You got a line!
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="font-serif text-3xl font-bold">
          <span className="text-wc-gold">Match Day</span>{" "}
          <span className="text-cream">Bingo</span>
        </h1>
        <p className="text-cream/50 text-sm">
          Events happen live &middot; +1 per cell &middot; +5 per line &middot; +10 full house
        </p>
      </div>

      {/* Player selector */}
      <div className="bg-dark-card border border-dark-border rounded-lg p-4">
        <label className="block text-xs text-cream/40 mb-1">Player</label>
        <select
          value={selectedPlayerId ?? ""}
          onChange={(e) =>
            setSelectedPlayerId(e.target.value ? Number(e.target.value) : null)
          }
          className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-cream text-sm"
        >
          <option value="">Select player...</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-cream/40">Loading bingo card...</div>
      ) : !selectedPlayerId ? (
        <div className="text-center py-12 text-cream/40">
          Select a player to see your bingo card
        </div>
      ) : !card ? (
        <div className="text-center py-12 text-cream/40">No card available</div>
      ) : (
        <>
          {/* Score bar */}
          <div className="flex items-center justify-between bg-dark-card border border-dark-border rounded-lg px-4 py-3">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-xs text-cream/40">Cells</div>
                <div className="text-lg font-bold text-cream">
                  {completedCount}/16
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-cream/40">Lines</div>
                <div className="text-lg font-bold text-wc-gold">
                  {bingoLines}
                </div>
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-cream/40">Points</div>
              <div className="text-2xl font-black text-wc-gold">{points}</div>
            </div>
            {isFullHouse && (
              <div className="bg-wc-gold/20 text-wc-gold text-xs font-bold px-3 py-1 rounded-full animate-pulse">
                FULL HOUSE!
              </div>
            )}
          </div>

          {/* Bingo grid */}
          <div className="grid grid-cols-4 gap-2">
            {card.flat().map((cell, i) => (
              <div
                key={i}
                className={`relative aspect-square flex items-center justify-center p-2 rounded-lg border text-center transition-all duration-500 ${
                  cell.completed
                    ? "bg-green-900/40 border-green-500/60 shadow-[0_0_12px_rgba(34,197,94,0.3)]"
                    : "bg-dark-card border-dark-border"
                }`}
              >
                <span
                  className={`text-[11px] leading-tight font-medium ${
                    cell.completed ? "text-green-300" : "text-cream/60"
                  }`}
                >
                  {cell.text}
                </span>
                {cell.completed && (
                  <div className="absolute top-1 right-1">
                    <svg
                      className="w-4 h-4 text-green-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 text-xs text-cream/40">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-dark-card border border-dark-border" />
              <span>Pending</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-green-900/40 border border-green-500/60" />
              <span>Completed</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
