"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface PlayerOption {
  id: number;
  name: string;
  slug: string;
  color: string | null;
  avatarEmoji: string | null;
}

interface CategoryData {
  category: string;
  tally: Record<string, number>;
  leader: { slug: string; name: string; count: number } | null;
  totalVotes: number;
  voterPick: string | null;
}

const LS_PLAYER_ID = "wc_sweep_player_id";
const LS_PASSCODE = "wc_sweep_passcode";

export default function SuperlativesPage() {
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [players, setPlayers] = useState<PlayerOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [voterId, setVoterId] = useState<number | null>(null);
  const [passcode, setPasscode] = useState("");
  const [voting, setVoting] = useState<string | null>(null);
  const [error, setError] = useState("");

  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    try {
      const savedId = localStorage.getItem(LS_PLAYER_ID);
      const savedPass = localStorage.getItem(LS_PASSCODE);
      if (savedId) setVoterId(Number(savedId));
      if (savedPass) setPasscode(savedPass);
    } catch {
      // localStorage unavailable
    }
  }, []);

  useEffect(() => {
    try {
      if (voterId !== null) localStorage.setItem(LS_PLAYER_ID, String(voterId));
      if (passcode) localStorage.setItem(LS_PASSCODE, passcode);
    } catch {
      // localStorage unavailable
    }
  }, [voterId, passcode]);

  const loadData = useCallback(async () => {
    try {
      const url = voterId
        ? `/api/superlatives?voterId=${voterId}`
        : "/api/superlatives";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories ?? []);
        setPlayers(data.players ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [voterId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleVote(category: string, nomineeSlug: string) {
    if (!voterId || !passcode) {
      setError("Select yourself and enter your passcode to vote");
      return;
    }

    setVoting(category);
    setError("");

    try {
      const res = await fetch("/api/superlatives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voterId,
          category,
          nomineePlayerSlug: nomineeSlug,
          passcode,
        }),
      });

      if (res.ok) {
        await loadData();
      } else {
        const data = await res.json();
        setError(data.error ?? "Failed to vote");
      }
    } catch {
      setError("Network error");
    } finally {
      setVoting(null);
    }
  }

  function getEmoji(cat: string): string {
    const match = cat.match(
      /[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27FF}]|[\u{FE00}-\u{FEFF}]/u
    );
    return match ? match[0] : "";
  }

  function getCatTitle(cat: string): string {
    return cat.replace(
      /[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27FF}]|[\u{FE00}-\u{FEFF}]/gu,
      ""
    ).trim();
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center text-cream/40">
        Loading superlatives...
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="font-serif text-3xl font-bold">
          <span className="text-wc-gold">Superlatives</span>
        </h1>
        <p className="text-cream/50 text-sm">
          Vote for your mates &middot; One vote per category &middot; You can change your vote
        </p>
      </div>

      {/* Voter selector */}
      <div className="bg-dark-card border border-dark-border rounded-lg p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="block text-xs text-cream/40 mb-1">You</label>
            <select
              value={voterId ?? ""}
              onChange={(e) =>
                setVoterId(e.target.value ? Number(e.target.value) : null)
              }
              className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-cream text-sm"
            >
              <option value="">Select yourself...</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs text-cream/40 mb-1">Passcode</label>
            <input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Enter your passcode"
              className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-cream text-sm placeholder:text-cream/20"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-wc-red/20 border border-wc-red/40 rounded-lg p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Category cards */}
      <div className="space-y-4">
        {categories.map((cat) => {
          const emoji = getEmoji(cat.category);
          const title = getCatTitle(cat.category);
          const isVoting = voting === cat.category;

          return (
            <div
              key={cat.category}
              className="bg-dark-card border border-dark-border rounded-lg overflow-hidden"
            >
              {/* Category header */}
              <div className="px-4 py-3 border-b border-dark-border bg-dark-border/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{emoji}</span>
                    <h3 className="font-serif font-bold text-cream">{title}</h3>
                  </div>
                  {cat.leader && (
                    <div className="text-right">
                      <div className="text-xs text-cream/40">Leading</div>
                      <div className="text-sm font-bold text-wc-gold">
                        {cat.leader.name}{" "}
                        <span className="text-cream/40 font-normal">
                          ({cat.leader.count})
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Vote buttons */}
              <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                {players.map((p) => {
                  const isSelected = cat.voterPick === p.slug;
                  const voteCount = cat.tally[p.slug] ?? 0;
                  const isLeader =
                    cat.leader?.slug === p.slug && voteCount > 0;

                  return (
                    <button
                      key={p.slug}
                      type="button"
                      onClick={() => handleVote(cat.category, p.slug)}
                      disabled={isVoting}
                      className={`relative flex flex-col items-center gap-1 py-3 px-2 rounded-lg border text-sm transition-all cursor-pointer ${
                        isSelected
                          ? "bg-wc-gold/15 border-wc-gold text-wc-gold"
                          : "bg-dark border-dark-border text-cream/60 hover:border-cream/30 hover:text-cream"
                      } ${isVoting ? "opacity-50" : ""}`}
                    >
                      {isLeader && (
                        <div className="absolute -top-1 -right-1 text-xs">
                          👑
                        </div>
                      )}
                      <span className="font-medium text-xs">{p.name}</span>
                      {voteCount > 0 && (
                        <span className="text-[10px] text-cream/30">
                          {voteCount} vote{voteCount !== 1 ? "s" : ""}
                        </span>
                      )}
                      {isSelected && (
                        <svg
                          className="w-3.5 h-3.5 text-wc-gold"
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
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
