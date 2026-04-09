"use client";

import { useEffect, useState } from "react";

interface RecordEntry {
  id: number;
  recordType: string;
  player: { name: string; avatarEmoji: string | null } | null;
  golfer: { name: string } | null;
  tournament: { name: string } | null;
  season: { year: number } | null;
  scope: string;
  numericValue: number | null;
  displayValue: string | null;
  description: string;
  setAt: string;
  supersededAt: string | null;
}

const NAMED_AWARDS: Record<
  string,
  { title: string; emoji: string; description: string }
> = {
  green_jacket: {
    title: "The Green Jacket",
    emoji: "🧥",
    description: "Season champion — most points overall",
  },
  wooden_spoon: {
    title: "The Wooden Spoon",
    emoji: "🥄",
    description: "Last place finisher — forfeit awaits",
  },
  stuart_award: {
    title: "The Stuart Award",
    emoji: "🧠",
    description: "Best single tournament performance",
  },
  matt_h_award: {
    title: "The Matt H Award",
    emoji: "💀",
    description: "Worst single tournament performance",
  },
  sunday_choke: {
    title: "The Sunday Choke",
    emoji: "😰",
    description: "Biggest final round collapse",
  },
  comeback_kid: {
    title: "The Comeback Kid",
    emoji: "🔥",
    description: "Biggest position gain across a tournament",
  },
  pundit: {
    title: "The Pundit",
    emoji: "🔮",
    description: "Best prediction accuracy",
  },
  prophet: {
    title: "The Prophet",
    emoji: "📜",
    description: "Most correct hot takes",
  },
  main_character: {
    title: "The Main Character",
    emoji: "🎬",
    description: "Most banter events generated",
  },
};

export default function RecordsPage() {
  const [records, setRecords] = useState<RecordEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/records")
      .then((r) => r.json())
      .then((d) => {
        setRecords(d.records ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const currentRecords = records.filter((r) => !r.supersededAt);
  const historicRecords = records.filter((r) => r.supersededAt);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center text-cream/40">
        Loading records...
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="font-serif text-2xl md:text-3xl font-bold mb-2">
        Records &amp; Streaks
      </h1>
      <p className="text-cream/50 text-sm mb-8">
        The all-time hall of fame (and shame).
      </p>

      {/* Named Awards */}
      <div className="mb-10">
        <h2 className="font-serif text-lg font-bold mb-4">Named Awards</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Object.entries(NAMED_AWARDS).map(([key, award]) => {
            const record = currentRecords.find((r) => r.recordType === key);
            return (
              <div
                key={key}
                className="bg-dark-card border border-dark-border rounded-xl p-5 text-center"
              >
                <span className="text-4xl">{award.emoji}</span>
                <h3 className="font-serif font-bold text-gold mt-2">
                  {award.title}
                </h3>
                <p className="text-xs text-cream/40 mt-1">
                  {award.description}
                </p>

                {record ? (
                  <div className="mt-3">
                    <div className="font-bold text-lg">
                      {record.player?.avatarEmoji ?? ""}{" "}
                      {record.player?.name ?? "TBD"}
                    </div>
                    {record.displayValue && (
                      <div className="text-gold text-sm font-mono">
                        {record.displayValue}
                      </div>
                    )}
                    {record.tournament && (
                      <div className="text-xs text-cream/40 mt-1">
                        {record.tournament.name}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-3 text-cream/30 text-sm">
                    Not yet awarded
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Current Records */}
      <div className="mb-10">
        <h2 className="font-serif text-lg font-bold mb-4">
          🏆 Current Records
        </h2>

        {currentRecords.filter((r) => !NAMED_AWARDS[r.recordType]).length ===
        0 ? (
          <div className="bg-dark-card border border-dark-border rounded-xl p-8 text-center text-cream/40">
            No records set yet. Play some tournaments to set records!
          </div>
        ) : (
          <div className="space-y-3">
            {currentRecords
              .filter((r) => !NAMED_AWARDS[r.recordType])
              .map((record) => (
                <div
                  key={record.id}
                  className="bg-dark-card border border-dark-border rounded-xl p-4 flex items-center gap-4"
                >
                  <div className="text-3xl">🏆</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm">
                      {record.description}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-sm text-cream/60">
                      <span>
                        {record.player?.avatarEmoji ?? ""}{" "}
                        {record.player?.name ?? "Unknown"}
                      </span>
                      {record.tournament && (
                        <>
                          <span className="text-cream/20">at</span>
                          <span>{record.tournament.name}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    {record.displayValue && (
                      <div className="text-gold font-mono font-bold text-lg">
                        {record.displayValue}
                      </div>
                    )}
                    <div className="text-[10px] text-cream/30">
                      {record.scope === "all_time" ? "All-Time" : "Season"}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Record History */}
      {historicRecords.length > 0 && (
        <div>
          <h2 className="font-serif text-lg font-bold mb-4 text-cream/60">
            Record History
          </h2>
          <p className="text-cream/40 text-xs mb-3">
            Superseded records — previous holders.
          </p>

          <div className="space-y-2">
            {historicRecords.map((record) => (
              <div
                key={record.id}
                className="bg-dark-card/50 border border-dark-border/50 rounded-lg p-3 flex items-center gap-3 opacity-60"
              >
                <div className="text-xl">📜</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-cream/60">
                    {record.description}
                  </div>
                  <div className="text-xs text-cream/40">
                    {record.player?.name ?? "Unknown"}
                    {record.displayValue && (
                      <span className="ml-2 text-cream/30">
                        ({record.displayValue})
                      </span>
                    )}
                    {record.tournament && (
                      <span className="ml-2">
                        at {record.tournament.name}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-[10px] text-cream/20">
                  Superseded{" "}
                  {record.supersededAt
                    ? new Date(record.supersededAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })
                    : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
