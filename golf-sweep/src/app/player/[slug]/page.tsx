"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { formatScore, scoreClass } from "@/lib/banter";

interface PickDetail {
  tournament: { id: number; name: string; status: string };
  golfer: { name: string; country: string | null; flagEmoji: string | null };
  openingOdds: string | null;
  result: { position: string | null; scoreToPar: number | null; madeCut: boolean | null } | null;
  roundScores: Record<number, { scoreToPar: number | null; thru: string | null }>;
  points: Array<{ source: string; points: number; note: string | null }>;
  totalPoints: number;
}

interface PlayerData {
  player: { name: string; slug: string; color: string | null; avatarEmoji: string | null };
  picks: PickDetail[];
  totalPoints: number;
}

export default function PlayerPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [data, setData] = useState<PlayerData | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/player?slug=${slug}`)
      .then((r) => r.json())
      .then(setData);
  }, [slug]);

  function share() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!data) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 text-center text-cream/40">
        Loading...
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span
            className="w-4 h-4 rounded-full inline-block"
            style={{ backgroundColor: data.player.color ?? "#006747" }}
          />
          <h1 className="font-serif text-2xl md:text-3xl font-bold">
            {data.player.name}
          </h1>
        </div>
        <button
          onClick={share}
          className="bg-dark-card border border-dark-border px-4 py-2 rounded-lg text-sm hover:bg-dark-border transition-colors"
        >
          {copied ? "Copied!" : "Share"}
        </button>
      </div>

      {/* Total points */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-6 mb-6 text-center">
        <span className="text-cream/50 text-sm">Total Season Points</span>
        <div className="text-4xl font-bold font-serif text-gold mt-1">
          {data.totalPoints}
        </div>
      </div>

      {/* Picks */}
      {data.picks.map((pick) => (
        <div
          key={pick.tournament.id}
          className="bg-dark-card border border-dark-border rounded-xl p-4 mb-4"
          style={{
            borderLeft: `4px solid ${data.player.color ?? "#006747"}`,
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-serif font-bold">
                {pick.tournament.name}
                {pick.tournament.status === "live" && (
                  <span className="live-dot inline-block w-2 h-2 rounded-full bg-augusta-light ml-2" />
                )}
              </h3>
              <div className="text-sm text-cream/50">
                {pick.golfer.flagEmoji} {pick.golfer.name}
                {pick.openingOdds && (
                  <span className="ml-2 text-cream/30">({pick.openingOdds})</span>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-cream/50">Position</div>
              <div className="font-mono font-bold text-lg">
                {pick.result?.position ?? "-"}
              </div>
            </div>
          </div>

          {/* Round scores */}
          <div className="grid grid-cols-4 gap-2 mb-3">
            {[1, 2, 3, 4].map((r) => (
              <div
                key={r}
                className="bg-dark rounded-lg p-2 text-center"
              >
                <div className="text-xs text-cream/30">R{r}</div>
                <div
                  className={`font-mono font-bold ${scoreClass(pick.roundScores[r]?.scoreToPar ?? null)}`}
                >
                  {pick.roundScores[r]
                    ? formatScore(pick.roundScores[r].scoreToPar)
                    : "-"}
                </div>
                <div className="text-xs text-cream/30">
                  {pick.roundScores[r]?.thru ?? ""}
                </div>
              </div>
            ))}
          </div>

          {/* Points breakdown */}
          {pick.points.length > 0 && (
            <div className="border-t border-dark-border/40 pt-2">
              <div className="text-xs text-cream/40 mb-1">Points</div>
              {pick.points.map((p, i) => (
                <div
                  key={i}
                  className="flex justify-between text-sm py-0.5"
                >
                  <span className="text-cream/60">
                    {p.source === "finish"
                      ? "Finish"
                      : p.source === "rotd"
                        ? "Round of Day"
                        : "Best of Round"}
                    {p.note && (
                      <span className="text-cream/30 ml-1">({p.note})</span>
                    )}
                  </span>
                  <span className="font-mono font-bold text-gold">
                    +{p.points}
                  </span>
                </div>
              ))}
              <div className="flex justify-between text-sm pt-1 border-t border-dark-border/20 mt-1">
                <span className="font-bold">Total</span>
                <span className="font-mono font-bold text-gold">
                  {pick.totalPoints}
                </span>
              </div>
            </div>
          )}
        </div>
      ))}

      <div className="text-center mt-4">
        <Link
          href="/leaderboard"
          className="text-augusta-light hover:text-cream text-sm transition-colors"
        >
          Back to Leaderboard
        </Link>
      </div>
    </div>
  );
}
