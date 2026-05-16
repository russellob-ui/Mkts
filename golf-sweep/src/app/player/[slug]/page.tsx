"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { formatScore, scoreClass } from "@/lib/banter";

interface ScorecardHoleData {
  holeId: number;
  holeScore: number;
  par: number;
}

interface ScorecardRoundData {
  roundId: number;
  roundComplete: boolean;
  totalShots: number;
  holes: ScorecardHoleData[];
  analysis: { eagles: number; birdies: number; bogeys: number; doubles: number };
}

interface PickDetail {
  tournament: { id: number; name: string; status: string };
  golfer: { name: string; country: string | null; flagEmoji: string | null };
  openingOdds: string | null;
  result: { position: string | null; scoreToPar: number | null; madeCut: boolean | null } | null;
  roundScores: Record<number, { scoreToPar: number | null; thru: string | null }>;
  scorecard?: ScorecardRoundData[];
  points: Array<{ source: string; points: number; note: string | null }>;
  totalPoints: number;
}

interface PlayerData {
  player: { name: string; slug: string; color: string | null; avatarEmoji: string | null };
  picks: PickDetail[];
  totalPoints: number;
}

function holeBg(holeScore: number, par: number): string {
  if (holeScore === 0 || par === 0) return "bg-dark";
  const diff = holeScore - par;
  if (diff <= -2) return "bg-yellow-600/80"; // eagle or better — gold
  if (diff === -1) return "bg-red-400/60"; // birdie — red/pink
  if (diff === 0) return "bg-gray-600/40"; // par — grey
  if (diff === 1) return "bg-blue-300/40"; // bogey — light blue
  return "bg-blue-700/60"; // double+ — dark blue
}

function ScorecardGrid({ round }: { round: ScorecardRoundData }) {
  const front = round.holes.filter((h) => h.holeId >= 1 && h.holeId <= 9).sort((a, b) => a.holeId - b.holeId);
  const back = round.holes.filter((h) => h.holeId >= 10 && h.holeId <= 18).sort((a, b) => a.holeId - b.holeId);
  const frontPar = front.reduce((s, h) => s + h.par, 0);
  const backPar = back.reduce((s, h) => s + h.par, 0);
  const frontScore = front.reduce((s, h) => s + h.holeScore, 0);
  const backScore = back.reduce((s, h) => s + h.holeScore, 0);
  const totalScore = frontScore + backScore;

  const renderNine = (holes: ScorecardHoleData[], label: string, parTotal: number, scoreTotal: number) => (
    <div className="overflow-x-auto">
      <table className="w-full text-[10px] font-mono" style={{ fontVariantNumeric: "tabular-nums" }}>
        <thead>
          <tr className="text-cream/40">
            <th className="text-left px-1 py-0.5 w-8">Hole</th>
            {holes.map((h) => (
              <th key={h.holeId} className="text-center px-1 py-0.5 w-7">{h.holeId}</th>
            ))}
            <th className="text-center px-1 py-0.5 w-10 font-bold">{label}</th>
          </tr>
        </thead>
        <tbody>
          <tr className="text-cream/50">
            <td className="px-1 py-0.5">Par</td>
            {holes.map((h) => (
              <td key={h.holeId} className="text-center px-1 py-0.5">{h.par}</td>
            ))}
            <td className="text-center px-1 py-0.5 font-bold">{parTotal}</td>
          </tr>
          <tr>
            <td className="px-1 py-0.5 text-cream/60">Score</td>
            {holes.map((h) => (
              <td key={h.holeId} className="text-center px-1 py-0.5">
                <span className={`inline-block w-5 h-5 leading-5 rounded text-[10px] font-bold ${holeBg(h.holeScore, h.par)}`}>
                  {h.holeScore || "-"}
                </span>
              </td>
            ))}
            <td className="text-center px-1 py-0.5 font-bold">{scoreTotal}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="bg-dark rounded-lg p-2 border border-dark-border/30">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold text-cream/70">
          Round {round.roundId}
          {round.roundComplete && <span className="ml-1 text-cream/40">(F)</span>}
        </span>
        <span className="text-xs font-mono text-cream/50">
          Total: {totalScore}
        </span>
      </div>
      {front.length > 0 && renderNine(front, "OUT", frontPar, frontScore)}
      {back.length > 0 && renderNine(back, "IN", backPar, backScore)}
      {front.length > 0 && back.length > 0 && (
        <div className="text-right text-xs font-mono font-bold text-cream/70 mt-1 pr-1">
          TOTAL: {totalScore} ({totalScore - frontPar - backPar >= 0 ? "+" : ""}{totalScore - frontPar - backPar})
        </div>
      )}
    </div>
  );
}

export default function PlayerPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [data, setData] = useState<PlayerData | null>(null);
  const [copied, setCopied] = useState(false);
  const [expandedScorecard, setExpandedScorecard] = useState<Record<number, boolean>>({});

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

          {/* Expandable Scorecard */}
          {pick.scorecard && pick.scorecard.length > 0 && (
            <div className="mb-3">
              <button
                onClick={() =>
                  setExpandedScorecard((prev) => ({
                    ...prev,
                    [pick.tournament.id]: !prev[pick.tournament.id],
                  }))
                }
                className="text-xs text-augusta-light hover:text-cream transition-colors flex items-center gap-1"
              >
                <span
                  className="inline-block transition-transform"
                  style={{
                    transform: expandedScorecard[pick.tournament.id]
                      ? "rotate(90deg)"
                      : "rotate(0deg)",
                  }}
                >
                  &#9654;
                </span>
                {expandedScorecard[pick.tournament.id]
                  ? "Hide scorecard"
                  : "Show scorecard"}
              </button>
              {expandedScorecard[pick.tournament.id] && (
                <div className="mt-2 space-y-3">
                  {pick.scorecard.map((round) => (
                    <ScorecardGrid
                      key={round.roundId}
                      round={round}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

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
                        : p.source === "eagle_bonus"
                          ? "Eagle Bonus"
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
