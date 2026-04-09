"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface PickSummary {
  tournament: string;
  golfer: string;
  golferFlag: string | null;
  position: string | null;
  scoreToPar: number | null;
  points: number;
}

interface PointsBreakdown {
  finish: number;
  rotd: number;
  bor: number;
  prediction: number;
  hot_take: number;
  commissioner: number;
}

interface Award {
  title: string;
  emoji: string;
  tournament: string | null;
}

interface YearbookData {
  player: {
    name: string;
    slug: string;
    avatarEmoji: string | null;
    color: string | null;
  };
  rank: number;
  totalPoints: number;
  picks: PickSummary[];
  bestMoment: string | null;
  worstMoment: string | null;
  pointsBreakdown: PointsBreakdown;
  awards: Award[];
  signatureStat: { label: string; value: string } | null;
  rivalries: Array<{
    opponent: string;
    opponentEmoji: string | null;
    intensity: number;
  }>;
  commissionerNote: string | null;
}

function formatScore(s: number | null): string {
  if (s === null) return "-";
  if (s === 0) return "E";
  return s > 0 ? `+${s}` : String(s);
}

export default function YearbookPlayerPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [data, setData] = useState<YearbookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/yearbook/${slug}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [slug]);

  function share() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center text-cream/40">
        Loading yearbook...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center text-cream/40">
        Player not found.
      </div>
    );
  }

  const accentColor = data.player.color ?? "#006747";

  const breakdownItems: Array<{
    key: keyof PointsBreakdown;
    label: string;
    emoji: string;
  }> = [
    { key: "finish", label: "Finish Position", emoji: "\u{1f3c6}" },
    { key: "rotd", label: "Round of the Day", emoji: "\u{1f525}" },
    { key: "bor", label: "Best of Round", emoji: "\u2b50" },
    { key: "prediction", label: "Predictions", emoji: "\u{1f52e}" },
    { key: "hot_take", label: "Hot Takes", emoji: "\u{1f336}\uFE0F" },
    { key: "commissioner", label: "Commissioner", emoji: "\u{1f3a9}" },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Hero */}
      <div
        className="rounded-xl p-8 text-center mb-6 relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${accentColor}30, ${accentColor}10)`,
          borderLeft: `6px solid ${accentColor}`,
        }}
      >
        <button
          onClick={share}
          className="absolute top-4 right-4 bg-dark/50 border border-dark-border px-3 py-1.5 rounded-lg text-xs hover:bg-dark transition-colors"
        >
          {copied ? "Copied!" : "Share"}
        </button>

        <div className="text-5xl mb-3">
          {data.player.avatarEmoji ?? "\u26f3"}
        </div>
        <h1 className="font-serif text-3xl md:text-4xl font-bold mb-1">
          {data.player.name}
        </h1>
        <div className="flex items-center justify-center gap-4 mt-3">
          <div>
            <div className="text-xs text-cream/50">Season Rank</div>
            <div
              className="text-2xl font-bold font-serif"
              style={{ color: accentColor }}
            >
              #{data.rank}
            </div>
          </div>
          <div className="w-px h-10 bg-dark-border" />
          <div>
            <div className="text-xs text-cream/50">Total Points</div>
            <div className="text-2xl font-bold font-mono text-gold">
              {data.totalPoints}
            </div>
          </div>
        </div>
      </div>

      {/* The Picks */}
      <section className="mb-6">
        <h2 className="font-serif text-lg font-bold mb-3">The Picks</h2>
        <div className="space-y-2">
          {data.picks.map((pick) => (
            <div
              key={pick.tournament}
              className="bg-dark-card border border-dark-border rounded-xl p-4 flex items-center justify-between"
              style={{ borderLeft: `4px solid ${accentColor}` }}
            >
              <div>
                <div className="font-bold text-sm">{pick.tournament}</div>
                <div className="text-xs text-cream/50">
                  {pick.golferFlag ?? ""} {pick.golfer}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-cream/60">
                  {pick.position ?? "-"} ({formatScore(pick.scoreToPar)})
                </div>
                <div className="text-gold font-bold font-mono">
                  {pick.points > 0 ? `+${pick.points}` : pick.points}
                </div>
              </div>
            </div>
          ))}
          {data.picks.length === 0 && (
            <div className="text-cream/40 text-sm text-center py-4">
              No picks data available.
            </div>
          )}
        </div>
      </section>

      {/* Best & Worst Moment */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-dark-card border border-dark-border rounded-xl p-5">
          <div className="text-2xl mb-2">{"\u{1f389}"}</div>
          <h3 className="font-serif font-bold text-sm text-augusta-light mb-1">
            Best Moment
          </h3>
          <p className="text-sm text-cream/70">
            {data.bestMoment ?? "Season still in progress..."}
          </p>
        </div>
        <div className="bg-dark-card border border-dark-border rounded-xl p-5">
          <div className="text-2xl mb-2">{"\u{1f629}"}</div>
          <h3 className="font-serif font-bold text-sm text-red-400 mb-1">
            Worst Moment
          </h3>
          <p className="text-sm text-cream/70">
            {data.worstMoment ?? "Nothing too bad... yet."}
          </p>
        </div>
      </div>

      {/* Points Breakdown */}
      <section className="mb-6">
        <h2 className="font-serif text-lg font-bold mb-3">
          Points Breakdown
        </h2>
        <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
          {breakdownItems.map((item) => {
            const val = data.pointsBreakdown[item.key];
            const pct =
              data.totalPoints > 0
                ? Math.round((val / data.totalPoints) * 100)
                : 0;
            return (
              <div
                key={item.key}
                className="flex items-center justify-between px-4 py-3 border-b border-dark-border/40 last:border-0"
              >
                <div className="flex items-center gap-2">
                  <span>{item.emoji}</span>
                  <span className="text-sm">{item.label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-2 bg-dark rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: accentColor,
                      }}
                    />
                  </div>
                  <span className="text-gold font-mono font-bold text-sm w-12 text-right">
                    {val > 0 ? val : 0}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Awards Won */}
      {data.awards.length > 0 && (
        <section className="mb-6">
          <h2 className="font-serif text-lg font-bold mb-3">Awards Won</h2>
          <div className="flex flex-wrap gap-3">
            {data.awards.map((award, i) => (
              <div
                key={i}
                className="bg-dark-card border border-gold/30 rounded-xl px-4 py-3 text-center"
              >
                <div className="text-2xl">{award.emoji}</div>
                <div className="font-bold text-xs text-gold mt-1">
                  {award.title}
                </div>
                {award.tournament && (
                  <div className="text-[10px] text-cream/40">
                    {award.tournament}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Signature Stat */}
      {data.signatureStat && (
        <section className="mb-6">
          <h2 className="font-serif text-lg font-bold mb-3">
            Signature Stat
          </h2>
          <div
            className="bg-dark-card border border-dark-border rounded-xl p-5 text-center"
            style={{ borderTop: `4px solid ${accentColor}` }}
          >
            <div className="text-3xl font-bold text-gold font-mono">
              {data.signatureStat.value}
            </div>
            <div className="text-sm text-cream/50 mt-1">
              {data.signatureStat.label}
            </div>
          </div>
        </section>
      )}

      {/* Rivalries */}
      {data.rivalries.length > 0 && (
        <section className="mb-6">
          <h2 className="font-serif text-lg font-bold mb-3">Rivalries</h2>
          <div className="space-y-2">
            {data.rivalries.map((r, i) => (
              <div
                key={i}
                className="bg-dark-card border border-dark-border rounded-lg px-4 py-3 flex items-center justify-between"
              >
                <span className="font-bold text-sm">
                  {r.opponentEmoji ?? "\u26f3"} {r.opponent}
                </span>
                <span className="text-sm">
                  {Array(Math.max(1, Math.min(5, r.intensity)))
                    .fill("\u{1f525}")
                    .join("")}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Commissioner's Note */}
      {data.commissionerNote && (
        <section className="mb-6">
          <div className="bg-dark-card border-2 border-gold/30 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{"\u{1f3a9}"}</span>
              <h3 className="font-serif font-bold text-gold">
                Commissioner&apos;s Note
              </h3>
            </div>
            <p className="text-sm text-cream/70 italic">
              {data.commissionerNote}
            </p>
          </div>
        </section>
      )}

      {/* Back link */}
      <div className="text-center mt-8">
        <Link
          href="/yearbook"
          className="text-augusta-light hover:text-cream text-sm transition-colors"
        >
          Back to Yearbook
        </Link>
      </div>
    </div>
  );
}
