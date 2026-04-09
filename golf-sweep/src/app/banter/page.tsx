"use client";

import { useEffect, useState } from "react";
import { timeAgo } from "@/lib/banter";

interface BanterEvent {
  id: number;
  eventType: string;
  headline: string;
  detail: string | null;
  emoji: string | null;
  importance: number;
  roundNumber: number | null;
  source: string;
  player: { name: string; color: string | null } | null;
  createdAt: string;
}

export default function BanterPage() {
  const [events, setEvents] = useState<BanterEvent[]>([]);
  const [filter, setFilter] = useState<"all" | "big">("all");

  async function fetchData() {
    // Trigger leaderboard first to ensure tables + snapshots + banter generation
    await fetch("/api/leaderboard");

    const minImportance = filter === "big" ? 7 : 0;
    const res = await fetch(`/api/banter?tournamentId=1&minImportance=${minImportance}`);
    const json = await res.json();
    setEvents(json.events ?? []);
  }

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [filter]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="font-serif text-2xl font-bold mb-4">Banter Feed</h1>

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1.5 rounded-full text-xs font-bold ${filter === "all" ? "bg-augusta text-cream" : "bg-dark-card text-cream/60"}`}
        >
          All
        </button>
        <button
          onClick={() => setFilter("big")}
          className={`px-3 py-1.5 rounded-full text-xs font-bold ${filter === "big" ? "bg-augusta text-cream" : "bg-dark-card text-cream/60"}`}
        >
          Big moments only
        </button>
      </div>

      {/* Feed */}
      <div className="space-y-3">
        {events.map((event) => (
          <div
            key={event.id}
            className="bg-dark-card border border-dark-border rounded-xl p-4"
            style={{
              borderLeft: `4px solid ${event.player?.color ?? "#006747"}`,
            }}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">{event.emoji ?? "⛳"}</span>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <span className="font-bold text-sm">{event.headline}</span>
                  <span className="text-[10px] text-cream/30 whitespace-nowrap ml-2">
                    {timeAgo(event.createdAt)}
                    {event.roundNumber && ` · R${event.roundNumber}`}
                  </span>
                </div>
                {event.detail && (
                  <p className="text-xs text-cream/50 mt-1">{event.detail}</p>
                )}
              </div>
            </div>
          </div>
        ))}

        {events.length === 0 && (
          <div className="bg-dark-card border border-dark-border rounded-xl p-8 text-center text-cream/40">
            Tournament not yet underway. Banter will appear once Round 1 starts and scores are polled.
          </div>
        )}
      </div>
    </div>
  );
}
