"use client";
import { useEffect, useState } from "react";
import { formatScore } from "@/lib/banter";

interface ScorecardHole {
  holeId: number;
  holeScore: number;
  par: number;
}

interface ScorecardRound {
  roundId: number;
  roundComplete: boolean;
  totalShots: number;
  holes: ScorecardHole[];
  analysis: { eagles: number; birdies: number; bogeys: number; doubles: number };
}

interface PlayerScorecard {
  player: { name: string; color: string | null };
  golfer: { name: string; flagEmoji: string | null };
  position: string | null;
  scoreToPar: number | null;
  rounds: ScorecardRound[];
}

function holeBg(score: number, par: number): string {
  if (score === 0 || par === 0) return "";
  const d = score - par;
  if (d <= -2) return "bg-yellow-600/80";
  if (d === -1) return "bg-red-400/60";
  if (d === 0) return "bg-gray-600/30";
  if (d === 1) return "bg-blue-300/40";
  return "bg-blue-700/60";
}

function RoundCard({ round, compact }: { round: ScorecardRound; compact?: boolean }) {
  const front = round.holes.filter((h) => h.holeId >= 1 && h.holeId <= 9).sort((a, b) => a.holeId - b.holeId);
  const back = round.holes.filter((h) => h.holeId >= 10 && h.holeId <= 18).sort((a, b) => a.holeId - b.holeId);

  const outPar = front.reduce((s, h) => s + h.par, 0);
  const outScore = front.reduce((s, h) => s + h.holeScore, 0);
  const inPar = back.reduce((s, h) => s + h.par, 0);
  const inScore = back.reduce((s, h) => s + h.holeScore, 0);

  const sz = compact ? "text-[9px]" : "text-[10px]";
  const cellW = compact ? "w-5" : "w-6";
  const cellH = compact ? "h-5" : "h-6";

  const renderNine = (holes: ScorecardHole[], label: string, totalPar: number, totalScore: number) => (
    <div className="flex items-center gap-[1px]">
      <span className={`${cellW} ${cellH} flex items-center justify-center ${sz} text-cream/30 font-bold`}>{label}</span>
      {holes.map((h) => (
        <span
          key={h.holeId}
          className={`${cellW} ${cellH} flex items-center justify-center ${sz} font-mono font-bold rounded-sm ${holeBg(h.holeScore, h.par)}`}
        >
          {h.holeScore || ""}
        </span>
      ))}
      {holes.length < 9 && Array.from({ length: 9 - holes.length }).map((_, i) => (
        <span key={`empty-${i}`} className={`${cellW} ${cellH} flex items-center justify-center ${sz} text-cream/10`}>·</span>
      ))}
      <span className={`${cellW} ${cellH} flex items-center justify-center ${sz} font-mono font-bold text-cream/60 border-l border-dark-border`}>
        {totalScore || ""}
      </span>
    </div>
  );

  return (
    <div className="space-y-[1px]">
      {/* Par row */}
      <div className="flex items-center gap-[1px]">
        <span className={`${cellW} ${cellH} flex items-center justify-center ${sz} text-cream/20`}>P</span>
        {front.map((h) => (
          <span key={h.holeId} className={`${cellW} ${cellH} flex items-center justify-center ${sz} text-cream/20 font-mono`}>{h.par}</span>
        ))}
        {front.length < 9 && Array.from({ length: 9 - front.length }).map((_, i) => (
          <span key={`ep-${i}`} className={`${cellW} ${cellH}`} />
        ))}
        <span className={`${cellW} ${cellH} flex items-center justify-center ${sz} text-cream/20 font-mono border-l border-dark-border`}>{outPar}</span>
      </div>
      {renderNine(front, "O", outPar, outScore)}
      {back.length > 0 && renderNine(back, "I", inPar, inScore)}
      {/* Analysis */}
      <div className={`flex gap-2 ${sz} text-cream/40 pt-1`}>
        {round.analysis.eagles > 0 && <span className="text-gold">{round.analysis.eagles} eagle{round.analysis.eagles > 1 ? "s" : ""}</span>}
        <span className="text-red-400">{round.analysis.birdies} birdie{round.analysis.birdies !== 1 ? "s" : ""}</span>
        <span className="text-blue-300">{round.analysis.bogeys} bogey{round.analysis.bogeys !== 1 ? "s" : ""}</span>
        {round.analysis.doubles > 0 && <span className="text-blue-500">{round.analysis.doubles} dbl+</span>}
        <span className="ml-auto font-mono">{round.totalShots} ({formatScore(round.totalShots - (front.reduce((s, h) => s + h.par, 0) + back.reduce((s, h) => s + h.par, 0)))})</span>
      </div>
    </div>
  );
}

export default function ScorecardsPage() {
  const [data, setData] = useState<PlayerScorecard[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRound, setSelectedRound] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/scorecards")
      .then((r) => r.json())
      .then((d) => {
        setData(d.players ?? []);
        if (d.currentRound) setSelectedRound(d.currentRound);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    const iv = setInterval(() => {
      fetch("/api/scorecards").then((r) => r.json()).then((d) => setData(d.players ?? [])).catch(() => {});
    }, 30000);
    return () => clearInterval(iv);
  }, []);

  if (loading) return <div className="max-w-3xl mx-auto px-4 py-8 text-center text-cream/40">Loading scorecards...</div>;

  const roundNums = [1, 2, 3, 4];

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="font-serif text-2xl font-bold mb-1">Scorecards</h1>
      <p className="text-cream/40 text-xs mb-4">Hole-by-hole breakdown for all 8 picks</p>

      {/* Round selector */}
      <div className="flex gap-1 mb-4">
        <button
          onClick={() => setSelectedRound(null)}
          className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors ${!selectedRound ? "bg-augusta text-cream" : "bg-dark-card text-cream/60"}`}
        >
          All
        </button>
        {roundNums.map((r) => (
          <button
            key={r}
            onClick={() => setSelectedRound(r)}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors ${selectedRound === r ? "bg-augusta text-cream" : "bg-dark-card text-cream/60"}`}
          >
            R{r}
          </button>
        ))}
      </div>

      {data.length === 0 && (
        <div className="bg-dark-card border border-dark-border rounded-xl p-8 text-center text-cream/40">
          No scorecard data available yet.
        </div>
      )}

      <div className="space-y-4">
        {data.map((p) => {
          const visibleRounds = selectedRound
            ? p.rounds.filter((r) => r.roundId === selectedRound)
            : p.rounds;

          return (
            <div
              key={p.player.name}
              className="bg-dark-card border border-dark-border rounded-xl overflow-hidden"
              style={{ borderLeft: `4px solid ${p.player.color ?? "#006747"}` }}
            >
              <div className="flex items-center justify-between px-3 py-2 border-b border-dark-border">
                <div>
                  <span className="font-bold text-sm">{p.player.name}</span>
                  <span className="text-cream/40 text-xs ml-2">
                    {p.golfer.flagEmoji} {p.golfer.name}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-cream/50">{p.position ?? ""}</span>
                  <span className={`ml-2 font-mono font-bold text-sm ${(p.scoreToPar ?? 0) < 0 ? "text-red-400" : (p.scoreToPar ?? 0) === 0 ? "text-gray-400" : "text-white"}`}>
                    {formatScore(p.scoreToPar)}
                  </span>
                </div>
              </div>

              {visibleRounds.length === 0 ? (
                <div className="px-3 py-4 text-center text-cream/30 text-xs">No scorecard for this round</div>
              ) : (
                <div className="px-3 py-2 space-y-3">
                  {visibleRounds.map((round) => (
                    <div key={round.roundId}>
                      <div className="text-[9px] text-cream/30 uppercase tracking-wider mb-1 font-bold">
                        Round {round.roundId} {round.roundComplete ? "" : "(in progress)"}
                      </div>
                      <RoundCard round={round} compact={!selectedRound} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="text-center text-[10px] text-cream/30 mt-3">
        Colour key: <span className="text-yellow-500">gold</span> = eagle &middot; <span className="text-red-400">red</span> = birdie &middot; <span className="text-gray-400">grey</span> = par &middot; <span className="text-blue-300">blue</span> = bogey &middot; <span className="text-blue-500">dark blue</span> = double+
      </div>
    </div>
  );
}
