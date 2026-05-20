"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Award {
  name: string;
  emoji: string;
  winnerId: number | null;
  winnerName: string | null;
  value: string;
  description: string;
}

export default function YearbookPage() {
  const [awards, setAwards] = useState<Award[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/yearbook");
        if (res.ok) {
          const data = await res.json();
          setAwards(data.awards ?? []);
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
  }, []);

  const champion = awards.find((a) => a.name === "Champion");
  const spoon = awards.find((a) => a.name === "Wooden Spoon");
  const rest = awards.filter(
    (a) => a.name !== "Champion" && a.name !== "Wooden Spoon"
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
      <Link href="/" className="text-cream/40 text-sm hover:text-cream/70">
        &larr; Back
      </Link>

      <div className="text-center space-y-2">
        <h1 className="font-serif text-3xl font-bold">
          <span className="text-wc-gold">WC Sweep 2026</span>
          <span className="text-cream"> &mdash; The Awards</span>
        </h1>
        <p className="text-cream/40 text-sm">
          End of tournament honours
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-cream/40">Loading...</div>
      ) : error ? (
        <div className="bg-dark-card border border-red-500 rounded-lg p-6 text-center text-red-400">
          Error: {error}
        </div>
      ) : (
        <>
          {/* Champion - hero card */}
          {champion && (
            <div
              className="relative overflow-hidden rounded-xl border-2 border-wc-gold/50 p-6 text-center"
              style={{
                background:
                  "linear-gradient(135deg, rgba(212,168,67,0.15) 0%, rgba(20,20,32,1) 60%)",
              }}
            >
              <div className="text-6xl mb-3">{champion.emoji}</div>
              <div
                className="font-serif text-2xl font-bold tracking-wide mb-1"
                style={{ color: "#d4a843" }}
              >
                {champion.name}
              </div>
              <div className="text-3xl font-bold text-cream mb-1">
                {champion.winnerName ?? "TBD"}
              </div>
              <div className="text-lg text-wc-gold font-mono">
                {champion.value}
              </div>
              <div className="text-sm text-cream/40 mt-2">
                {champion.description}
              </div>
            </div>
          )}

          {/* Rest of awards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {rest.map((award) => (
              <div
                key={award.name}
                className="bg-dark-card border border-dark-border rounded-lg p-5 hover:border-wc-gold/30 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="text-4xl shrink-0">{award.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <div
                      className="font-serif text-base font-bold tracking-wide"
                      style={{ color: "#d4a843" }}
                    >
                      {award.name}
                    </div>
                    <div className="text-lg font-semibold text-cream truncate">
                      {award.winnerName ?? "TBD"}
                    </div>
                    <div className="text-sm text-wc-gold font-mono mt-0.5">
                      {award.value}
                    </div>
                    <div className="text-xs text-cream/40 mt-1">
                      {award.description}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Wooden Spoon - special styling */}
          {spoon && (
            <div
              className="rounded-xl border border-red-900/50 p-5 text-center"
              style={{
                background:
                  "linear-gradient(135deg, rgba(139,0,0,0.1) 0%, rgba(20,20,32,1) 60%)",
              }}
            >
              <div className="text-4xl mb-2">{spoon.emoji}</div>
              <div
                className="font-serif text-lg font-bold tracking-wide mb-1"
                style={{ color: "#b91c1c" }}
              >
                {spoon.name}
              </div>
              <div className="text-xl font-semibold text-cream/70">
                {spoon.winnerName ?? "TBD"}
              </div>
              <div className="text-sm text-red-400/70 font-mono mt-0.5">
                {spoon.value}
              </div>
              <div className="text-xs text-cream/30 mt-1">
                {spoon.description}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
