"use client";

import { useEffect, useState } from "react";

interface Achievement {
  id: string;
  name: string;
  emoji: string;
  description: string;
  unlockedAt: string | null;
}

interface PlayerAchievements {
  playerId: number;
  playerName: string;
  slug: string;
  color: string;
  avatarEmoji: string;
  achievements: Achievement[];
}

const ALL_ACHIEVEMENT_IDS = [
  "first_blood",
  "giant_killer",
  "clean_sheet_king",
  "prophet",
  "underdog_whisperer",
  "goal_machine",
  "red_mist",
  "swept",
  "heartbreak",
  "perfect_day",
  "century_club",
  "last_man_standing",
];

export default function AchievementsPage() {
  const [data, setData] = useState<PlayerAchievements[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"players" | "trophies">("trophies");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/achievements");
        if (res.ok) {
          const json = await res.json();
          setData(json.players ?? []);
          setError(null);
        } else {
          setError(`API returned ${res.status}`);
        }
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, []);

  // Build achievement index: for each achievement, who has unlocked it
  const achievementIndex: Record<
    string,
    { def: Achievement; unlockedBy: { playerName: string; color: string; unlockedAt: string }[] }
  > = {};

  for (const player of data) {
    for (const ach of player.achievements) {
      if (!achievementIndex[ach.id]) {
        achievementIndex[ach.id] = {
          def: ach,
          unlockedBy: [],
        };
      }
      if (ach.unlockedAt) {
        achievementIndex[ach.id].unlockedBy.push({
          playerName: player.playerName,
          color: player.color,
          unlockedAt: ach.unlockedAt,
        });
      }
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="font-serif text-3xl font-bold">
          <span className="text-wc-gold">Trophy</span> Case
        </h1>
        <p className="text-cream/50 text-sm">
          Achievements unlocked during the tournament
        </p>
      </div>

      {/* View Toggle */}
      <div className="flex justify-center gap-2">
        <button
          onClick={() => setView("trophies")}
          className={`px-4 py-1.5 text-sm rounded-lg transition-colors cursor-pointer ${
            view === "trophies"
              ? "bg-wc-gold text-dark font-bold"
              : "bg-dark-card border border-dark-border text-cream/60 hover:text-cream"
          }`}
        >
          By Achievement
        </button>
        <button
          onClick={() => setView("players")}
          className={`px-4 py-1.5 text-sm rounded-lg transition-colors cursor-pointer ${
            view === "players"
              ? "bg-wc-gold text-dark font-bold"
              : "bg-dark-card border border-dark-border text-cream/60 hover:text-cream"
          }`}
        >
          By Player
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-cream/40">Loading...</div>
      ) : error ? (
        <div className="bg-dark-card border border-red-500 rounded-lg p-6 text-center text-red-400">
          Error: {error}
        </div>
      ) : view === "trophies" ? (
        /* ---- Trophy View ---- */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ALL_ACHIEVEMENT_IDS.map((id) => {
            const entry = achievementIndex[id];
            if (!entry) return null;
            const unlocked = entry.unlockedBy.length > 0;

            return (
              <div
                key={id}
                className={`bg-dark-card border rounded-lg overflow-hidden transition-all ${
                  unlocked
                    ? "border-wc-gold/50 shadow-[0_0_12px_rgba(212,168,67,0.15)]"
                    : "border-dark-border opacity-50"
                }`}
              >
                <div className="p-4 text-center">
                  <div
                    className={`text-4xl mb-2 ${unlocked ? "" : "grayscale"}`}
                  >
                    {entry.def.emoji}
                  </div>
                  <h3
                    className={`font-serif font-bold text-lg ${
                      unlocked ? "text-wc-gold" : "text-cream/40"
                    }`}
                  >
                    {entry.def.name}
                  </h3>
                  <p className="text-xs text-cream/50 mt-1">
                    {entry.def.description}
                  </p>
                </div>
                <div className="border-t border-dark-border/50 px-4 py-2">
                  {unlocked ? (
                    <div className="space-y-1">
                      {entry.unlockedBy.map((u, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between text-sm"
                        >
                          <span
                            className="font-medium"
                            style={{ color: u.color }}
                          >
                            {u.playerName}
                          </span>
                          <span className="text-xs text-cream/30">
                            {new Date(u.unlockedAt).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-cream/30 text-center py-1">
                      Locked
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ---- Player View ---- */
        <div className="space-y-4">
          {data
            .sort(
              (a, b) =>
                b.achievements.filter((x) => x.unlockedAt).length -
                a.achievements.filter((x) => x.unlockedAt).length
            )
            .map((player) => {
              const unlocked = player.achievements.filter(
                (a) => a.unlockedAt
              );
              const locked = player.achievements.filter(
                (a) => !a.unlockedAt
              );

              return (
                <div
                  key={player.playerId}
                  className="bg-dark-card border border-dark-border rounded-lg overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-dark-border bg-dark-border/30 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">
                        {player.avatarEmoji || "\u{1F3C6}"}
                      </span>
                      <h3
                        className="font-serif font-bold"
                        style={{ color: player.color }}
                      >
                        {player.playerName}
                      </h3>
                    </div>
                    <span className="text-sm text-wc-gold font-bold">
                      {unlocked.length}/{player.achievements.length}
                    </span>
                  </div>
                  <div className="p-4">
                    {/* Unlocked */}
                    {unlocked.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {unlocked.map((ach) => (
                          <div
                            key={ach.id}
                            className="bg-dark-border/40 border border-wc-gold/30 rounded-lg px-3 py-2 text-center min-w-[80px]"
                            title={`${ach.name}: ${ach.description}`}
                          >
                            <div className="text-2xl">{ach.emoji}</div>
                            <div className="text-xs text-wc-gold font-medium mt-0.5">
                              {ach.name}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Locked */}
                    {locked.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {locked.map((ach) => (
                          <div
                            key={ach.id}
                            className="bg-dark-border/20 border border-dark-border rounded-lg px-3 py-2 text-center min-w-[80px] opacity-40"
                            title={`${ach.name}: ${ach.description}`}
                          >
                            <div className="text-2xl grayscale">
                              {ach.emoji}
                            </div>
                            <div className="text-xs text-cream/40 font-medium mt-0.5">
                              {ach.name}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {unlocked.length === 0 && (
                      <p className="text-sm text-cream/30 text-center">
                        No achievements unlocked yet
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
