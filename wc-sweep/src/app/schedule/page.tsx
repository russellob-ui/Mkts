"use client";

import { useEffect, useState } from "react";

interface Team {
  name: string;
  flag: string;
}

interface ScheduleMatch {
  id: number;
  homeTeam: Team;
  awayTeam: Team;
  kickoff: string;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  homePenalties: number | null;
  awayPenalties: number | null;
  minute: number | null;
  stage: string;
  groupLetter: string | null;
  homeOwner: string | null;
  awayOwner: string | null;
  venue: string | null;
  city: string | null;
}

interface ScheduleDate {
  date: string;
  matches: ScheduleMatch[];
}

type FilterTab = "all" | "group" | "knockouts" | "my-teams";

function formatDateHeader(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  if (diff < 0) return "";
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function isKnockout(stage: string): boolean {
  const s = stage.toLowerCase();
  return (
    s.includes("round of") ||
    s.includes("quarter") ||
    s.includes("semi") ||
    s.includes("final") ||
    s.includes("r32") ||
    s.includes("r16") ||
    s.includes("qf") ||
    s.includes("sf") ||
    s.includes("3rd") ||
    s.includes("third")
  );
}

function stageBadgeColor(stage: string): string {
  const s = stage.toLowerCase();
  if (s.includes("group")) return "bg-wc-blue/40 text-blue-300";
  if (s.includes("32") || s.includes("r32")) return "bg-emerald-900/40 text-emerald-300";
  if (s.includes("16") || s.includes("r16")) return "bg-teal-900/40 text-teal-300";
  if (s.includes("quarter") || s.includes("qf")) return "bg-amber-900/40 text-amber-300";
  if (s.includes("semi") || s.includes("sf")) return "bg-orange-900/40 text-orange-300";
  if (s.includes("final")) return "bg-wc-gold/30 text-wc-gold";
  if (s.includes("3rd") || s.includes("third")) return "bg-zinc-700/40 text-zinc-300";
  return "bg-dark-border text-cream/60";
}

export default function SchedulePage() {
  const [dates, setDates] = useState<ScheduleDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [selectedPlayer, setSelectedPlayer] = useState<string>("");
  const [playerNames, setPlayerNames] = useState<string[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/schedule");
        if (res.ok) {
          const data = await res.json();
          setDates(data.dates ?? []);

          // Collect unique player names for "My Teams" filter
          const names = new Set<string>();
          for (const d of data.dates ?? []) {
            for (const m of d.matches) {
              if (m.homeOwner) names.add(m.homeOwner);
              if (m.awayOwner) names.add(m.awayOwner);
            }
          }
          setPlayerNames(Array.from(names).sort());
        }
      } catch {
        // API not ready
      } finally {
        setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, []);

  // Filter logic
  const filteredDates = dates
    .map((d) => ({
      ...d,
      matches: d.matches.filter((m) => {
        if (filter === "group") return !isKnockout(m.stage);
        if (filter === "knockouts") return isKnockout(m.stage);
        if (filter === "my-teams" && selectedPlayer) {
          return (
            m.homeOwner === selectedPlayer || m.awayOwner === selectedPlayer
          );
        }
        return true;
      }),
    }))
    .filter((d) => d.matches.length > 0);

  const tabs: { key: FilterTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "group", label: "Group Stage" },
    { key: "knockouts", label: "Knockouts" },
    { key: "my-teams", label: "My Teams" },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      <h1 className="font-serif text-2xl font-bold text-wc-gold">
        Match Schedule
      </h1>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilter(tab.key)}
            className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
              filter === tab.key
                ? "bg-wc-gold text-dark"
                : "bg-dark-card border border-dark-border text-cream/60 hover:text-cream"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Player selector for My Teams */}
      {filter === "my-teams" && (
        <select
          value={selectedPlayer}
          onChange={(e) => setSelectedPlayer(e.target.value)}
          className="w-full bg-dark-card border border-dark-border rounded-lg px-3 py-2 text-sm text-cream"
        >
          <option value="">Select a player...</option>
          {playerNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      )}

      {loading ? (
        <div className="text-center py-12 text-cream/40">Loading schedule...</div>
      ) : filteredDates.length === 0 ? (
        <div className="bg-dark-card border border-dark-border rounded-lg p-6 text-center text-cream/40">
          {filter === "my-teams" && !selectedPlayer
            ? "Select a player to see their matches"
            : "No matches found"}
        </div>
      ) : (
        <div className="space-y-6">
          {filteredDates.map((d) => (
            <section key={d.date}>
              <h2 className="font-serif text-lg text-wc-gold mb-3">
                {formatDateHeader(d.date)}
              </h2>
              <div className="space-y-2">
                {d.matches.map((m) => (
                  <div
                    key={m.id}
                    className="bg-dark-card border border-dark-border rounded-lg p-3"
                  >
                    {/* Top row: stage badge + status */}
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${stageBadgeColor(
                          m.stage
                        )}`}
                      >
                        {m.stage}
                        {m.groupLetter ? ` ${m.groupLetter}` : ""}
                      </span>
                      {m.status === "live" ? (
                        <span className="flex items-center gap-1 text-red-400 font-medium">
                          <span className="live-dot inline-block w-2 h-2 rounded-full bg-red-500" />
                          {m.minute}&apos;
                        </span>
                      ) : m.status === "finished" ? (
                        <span className="text-cream/50">FT</span>
                      ) : (
                        <span className="text-cream/50">
                          {new Date(m.kickoff).toLocaleTimeString("en-GB", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                    </div>

                    {/* Match row */}
                    <div className="flex items-center justify-between">
                      {/* Home team */}
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-lg shrink-0">
                          {m.homeTeam.flag}
                        </span>
                        <div className="min-w-0">
                          <div className="font-semibold text-sm truncate">
                            {m.homeTeam.name}
                          </div>
                          {m.homeOwner && (
                            <div className="text-xs text-cream/40 truncate">
                              {m.homeOwner}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Score / vs */}
                      <div className="px-3 text-center shrink-0">
                        {m.status === "finished" || m.status === "live" ? (
                          <div className="text-xl font-bold font-mono">
                            <span
                              className={
                                m.status === "finished" ? "text-cream" : ""
                              }
                            >
                              {m.homeScore ?? 0}
                            </span>
                            <span className="text-cream/40 mx-1">-</span>
                            <span
                              className={
                                m.status === "finished" ? "text-cream" : ""
                              }
                            >
                              {m.awayScore ?? 0}
                            </span>
                            {m.homePenalties != null &&
                              m.awayPenalties != null && (
                                <div className="text-[10px] text-cream/40 font-normal">
                                  ({m.homePenalties}-{m.awayPenalties} pens)
                                </div>
                              )}
                          </div>
                        ) : (
                          <span className="text-cream/30 text-sm font-medium">
                            vs
                          </span>
                        )}
                      </div>

                      {/* Away team */}
                      <div className="flex items-center gap-2 flex-1 min-w-0 justify-end text-right">
                        <div className="min-w-0">
                          <div className="font-semibold text-sm truncate">
                            {m.awayTeam.name}
                          </div>
                          {m.awayOwner && (
                            <div className="text-xs text-cream/40 truncate">
                              {m.awayOwner}
                            </div>
                          )}
                        </div>
                        <span className="text-lg shrink-0">
                          {m.awayTeam.flag}
                        </span>
                      </div>
                    </div>

                    {/* Venue */}
                    {m.venue && (
                      <div className="text-[10px] text-cream/30 mt-1.5 text-center">
                        {m.venue}
                        {m.city ? `, ${m.city}` : ""}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
