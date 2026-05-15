/**
 * Live win probability estimates based on current tournament position.
 *
 * These are NOT bookmaker odds — they're statistical estimates derived
 * from historical major championship data. They update in real-time
 * as positions change.
 *
 * Model: based on historical win rates by position at each round stage
 * of major championships (source: PGA Tour historical data averages).
 */

// Win probability by position at each stage of the tournament.
// Stage 0 = after R1, stage 1 = after R2, stage 2 = after R3, stage 3 = final.
const WIN_PROB_BY_POSITION: Record<number, number[]> = {
  // [afterR1, afterR2, afterR3, duringR4]
  1:  [0.18, 0.28, 0.45, 0.60],
  2:  [0.10, 0.16, 0.22, 0.25],
  3:  [0.07, 0.11, 0.12, 0.08],
  4:  [0.05, 0.07, 0.06, 0.03],
  5:  [0.04, 0.05, 0.04, 0.02],
  6:  [0.035, 0.04, 0.025, 0.01],
  7:  [0.03, 0.03, 0.015, 0.005],
  8:  [0.025, 0.02, 0.01, 0.003],
  9:  [0.02, 0.015, 0.007, 0.002],
  10: [0.018, 0.012, 0.005, 0.001],
};

function getWinProb(positionNum: number, roundsCompleted: number): number {
  const stage = Math.min(roundsCompleted, 3);

  if (positionNum <= 10) {
    return WIN_PROB_BY_POSITION[positionNum]?.[stage] ?? 0.01;
  }
  if (positionNum <= 20) {
    const base = 0.015 - (positionNum - 10) * 0.001;
    return Math.max(base * (stage === 0 ? 1 : stage === 1 ? 0.6 : 0.2), 0.001);
  }
  if (positionNum <= 40) {
    return stage <= 1 ? 0.003 : 0.001;
  }
  if (positionNum <= 60) {
    return stage === 0 ? 0.001 : 0;
  }
  return 0;
}

function probToFractional(prob: number): string {
  if (prob <= 0) return "";
  const decimal = 1 / prob;
  const profit = decimal - 1;

  if (profit <= 1) return "Evs";
  if (profit <= 1.5) return "6/4";
  if (profit <= 2) return "2/1";
  if (profit <= 2.5) return "5/2";
  if (profit <= 3) return "3/1";
  if (profit <= 3.5) return "7/2";
  if (profit <= 4.5) return "4/1";
  if (profit <= 5.5) return "5/1";
  if (profit <= 6.5) return "6/1";
  if (profit <= 7.5) return "7/1";
  if (profit <= 9) return "8/1";
  if (profit <= 11) return "10/1";
  if (profit <= 13) return "12/1";
  if (profit <= 15) return "14/1";
  if (profit <= 17) return "16/1";
  if (profit <= 21) return "20/1";
  if (profit <= 27) return "25/1";
  if (profit <= 35) return "33/1";
  if (profit <= 45) return "40/1";
  if (profit <= 55) return "50/1";
  if (profit <= 70) return "66/1";
  if (profit <= 85) return "80/1";
  if (profit <= 120) return "100/1";
  if (profit <= 175) return "150/1";
  return "200/1";
}

/**
 * Calculate live estimated odds for a golfer based on their current
 * tournament position and how many rounds have been completed.
 *
 * @param position - Current position string (e.g., "T2", "1", "T15")
 * @param currentRound - Current round number (1-4)
 * @returns Fractional odds string, or "" if position is too low to show
 */
export function getLiveEstimatedOdds(
  position: string | null,
  currentRound: number | null
): string {
  if (!position) return "";

  const posNum = parseInt(position.replace(/^T/, ""), 10);
  if (isNaN(posNum) || posNum < 1) return "";

  // roundsCompleted = currentRound - 1 (if mid-round) or currentRound (if between rounds)
  const roundsCompleted = Math.max((currentRound ?? 1) - 1, 0);

  const prob = getWinProb(posNum, roundsCompleted);
  if (prob <= 0.0005) return ""; // too unlikely to show

  return probToFractional(prob);
}
