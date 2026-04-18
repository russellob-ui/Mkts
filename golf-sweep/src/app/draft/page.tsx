"use client";

import { useState, useEffect } from "react";

interface TournamentInfo {
  id: number;
  name: string;
  status: string;
  startDate?: string;
}

function formatTournamentDate(dateStr?: string): string {
  if (!dateStr) return "TBD";
  try {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function getDraftDate(startDate?: string): string {
  if (!startDate) return "TBD";
  try {
    const d = new Date(startDate + "T00:00:00");
    d.setDate(d.getDate() - 1);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "TBD";
  }
}

export default function DraftPage() {
  const [upcomingTournaments, setUpcomingTournaments] = useState<TournamentInfo[]>([]);
  const [nextTournament, setNextTournament] = useState<TournamentInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/season")
      .then((r) => r.json())
      .then((data) => {
        if (data.tournaments) {
          const upcoming = data.tournaments
            .filter((t: TournamentInfo) => t.status === "upcoming" || t.status === "live");
          setUpcomingTournaments(upcoming);
          setNextTournament(upcoming[0] ?? null);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="font-serif text-2xl md:text-3xl font-bold mb-6">
        Snake Draft
      </h1>

      <div className="bg-dark-card border border-dark-border rounded-xl p-8 text-center">
        <div className="text-4xl mb-4">🐍</div>
        <h2 className="font-serif text-xl font-bold mb-2">
          Draft Not Active
        </h2>
        {loading ? (
          <p className="text-cream/40">Loading tournament data...</p>
        ) : (
          <>
            <p className="text-cream/60 mb-4">
              {nextTournament ? (
                <>
                  The snake draft will open <strong>24 hours before the {nextTournament.name}</strong> on{" "}
                  <span className="text-augusta-light font-bold">
                    {getDraftDate(nextTournament.startDate)}
                  </span>.
                </>
              ) : (
                <>No upcoming tournaments scheduled.</>
              )}
            </p>
            <p className="text-cream/40 text-sm mb-6">
              Draft order = reverse of current season standings. Whoever is last picks first.
              Each player picks one golfer — no duplicates allowed.
            </p>

            {upcomingTournaments.length > 0 && (
              <div className="bg-dark rounded-lg p-4 text-left max-w-md mx-auto">
                <h3 className="font-bold text-sm text-cream/60 mb-3">Upcoming Drafts</h3>
                <div className="space-y-2 text-sm">
                  {upcomingTournaments.map((t) => (
                    <div key={t.id} className="flex justify-between">
                      <span>{t.name}</span>
                      <span className="text-cream/40">
                        {getDraftDate(t.startDate)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="mt-6 bg-dark-card border border-dark-border rounded-xl p-4">
        <h3 className="font-serif text-sm font-bold mb-2 text-cream/60">How the Snake Draft Works</h3>
        <ol className="text-sm text-cream/50 space-y-1 list-decimal list-inside">
          <li>Draft order is reverse of season standings (last place picks first)</li>
          <li>Each player picks one golfer for the major</li>
          <li>No two players can pick the same golfer</li>
          <li>You have 4 hours to make your pick when it&apos;s your turn</li>
          <li>If you don&apos;t pick in time, auto-pick selects the highest-odds golfer available</li>
        </ol>
      </div>
    </div>
  );
}
