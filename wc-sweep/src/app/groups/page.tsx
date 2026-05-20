"use client";

import { useEffect, useState } from "react";

interface GroupTeam {
  teamId: number;
  teamName: string;
  flagEmoji: string;
  ownerName: string | null;
  ownerColor: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
  position: number | null;
  qualified: boolean;
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<Record<string, GroupTeam[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/groups");
        if (res.ok) {
          const data = await res.json();
          setGroups(data.groups ?? {});
        }
      } catch {
        // API not ready yet
      } finally {
        setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, []);

  const sortedLetters = Object.keys(groups).sort();

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="font-serif text-3xl font-bold">
          <span className="text-wc-gold">Group</span> Standings
        </h1>
        <p className="text-cream/50 text-sm">
          FIFA World Cup 2026 &middot; 12 Groups
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-cream/40">Loading...</div>
      ) : sortedLetters.length === 0 ? (
        <div className="bg-dark-card border border-dark-border rounded-lg p-6 text-center text-cream/40">
          No group standings available yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedLetters.map((letter) => (
            <div
              key={letter}
              className="bg-dark-card border border-dark-border rounded-lg overflow-hidden"
            >
              <div className="px-3 py-2 border-b border-dark-border bg-dark-border/30">
                <h2 className="font-serif font-bold text-wc-gold">
                  Group {letter}
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-cream/40 text-xs border-b border-dark-border">
                      <th className="px-2 py-1.5 text-center w-8">#</th>
                      <th className="px-2 py-1.5 text-left">Team</th>
                      <th className="px-1.5 py-1.5 text-center">P</th>
                      <th className="px-1.5 py-1.5 text-center">W</th>
                      <th className="px-1.5 py-1.5 text-center">D</th>
                      <th className="px-1.5 py-1.5 text-center">L</th>
                      <th className="px-1.5 py-1.5 text-center hidden sm:table-cell">
                        GF
                      </th>
                      <th className="px-1.5 py-1.5 text-center hidden sm:table-cell">
                        GA
                      </th>
                      <th className="px-1.5 py-1.5 text-center">GD</th>
                      <th className="px-1.5 py-1.5 text-center font-semibold">
                        Pts
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups[letter].map((team) => (
                      <tr
                        key={team.teamId}
                        className="border-b border-dark-border/50 last:border-0 hover:bg-dark-border/20"
                      >
                        <td className="px-2 py-1.5 text-center text-cream/40">
                          <span className="flex items-center justify-center gap-1">
                            {team.qualified && (
                              <span
                                className="inline-block w-2 h-2 rounded-full bg-green-500"
                                title="Qualified"
                              />
                            )}
                            {team.position ?? "-"}
                          </span>
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-base">{team.flagEmoji}</span>
                            <span
                              className="font-medium truncate"
                              style={{
                                color: team.ownerColor ?? undefined,
                              }}
                              title={
                                team.ownerName
                                  ? `Owner: ${team.ownerName}`
                                  : undefined
                              }
                            >
                              {team.teamName}
                            </span>
                          </div>
                        </td>
                        <td className="px-1.5 py-1.5 text-center text-cream/70">
                          {team.played}
                        </td>
                        <td className="px-1.5 py-1.5 text-center text-cream/70">
                          {team.won}
                        </td>
                        <td className="px-1.5 py-1.5 text-center text-cream/70">
                          {team.drawn}
                        </td>
                        <td className="px-1.5 py-1.5 text-center text-cream/70">
                          {team.lost}
                        </td>
                        <td className="px-1.5 py-1.5 text-center text-cream/70 hidden sm:table-cell">
                          {team.gf}
                        </td>
                        <td className="px-1.5 py-1.5 text-center text-cream/70 hidden sm:table-cell">
                          {team.ga}
                        </td>
                        <td className="px-1.5 py-1.5 text-center text-cream/70">
                          {team.gd > 0 ? `+${team.gd}` : team.gd}
                        </td>
                        <td className="px-1.5 py-1.5 text-center font-bold text-wc-gold">
                          {team.points}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
