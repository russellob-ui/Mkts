/**
 * Points system for Major Sweep 2026.
 */

/** Position-based points for finishing position */
export function getFinishPoints(position: string | null | undefined): number {
  if (!position) return 0;

  const pos = position.toUpperCase().replace(/^T/, "");
  const num = parseInt(pos, 10);
  if (isNaN(num)) {
    // MC, WD, DQ
    if (["MC", "WD", "DQ", "CUT"].includes(position.toUpperCase())) return 0;
    return 0;
  }

  if (num === 1) return 50;
  if (num === 2) return 30;
  if (num === 3) return 20;
  if (num >= 4 && num <= 5) return 15;
  if (num >= 6 && num <= 10) return 10;
  if (num >= 11 && num <= 20) return 6;
  if (num >= 21 && num <= 30) return 3;
  // Made cut outside T30
  return 1;
}

/** Parse a numeric position from a position string like "T3", "1", "MC" */
export function parsePosition(position: string): number | null {
  const cleaned = position.toUpperCase().replace(/^T/, "");
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? null : num;
}

/**
 * Calculate round-of-the-day bonus (+5) among a set of round scores.
 * Split on ties. Returns map of golferId -> bonus points.
 */
export function calcRoundOfDay(
  scores: Array<{ golferId: number; scoreToPar: number | null }>
): Map<number, number> {
  const result = new Map<number, number>();
  const valid = scores.filter((s) => s.scoreToPar != null);
  if (valid.length === 0) return result;

  const best = Math.min(...valid.map((s) => s.scoreToPar!));
  const winners = valid.filter((s) => s.scoreToPar === best);
  const bonus = 5 / winners.length;

  for (const w of winners) {
    result.set(w.golferId, bonus);
  }
  return result;
}

/**
 * Calculate best-of-round bonus (+2) — leading among 8 picks at end of round.
 * Based on cumulative score to par (overall position among our 8).
 * Split on ties. Returns map of golferId -> bonus points.
 */
export function calcBestOfRound(
  cumulativeScores: Array<{ golferId: number; totalToPar: number | null }>
): Map<number, number> {
  const result = new Map<number, number>();
  const valid = cumulativeScores.filter((s) => s.totalToPar != null);
  if (valid.length === 0) return result;

  const best = Math.min(...valid.map((s) => s.totalToPar!));
  const winners = valid.filter((s) => s.totalToPar === best);
  const bonus = 2 / winners.length;

  for (const w of winners) {
    result.set(w.golferId, bonus);
  }
  return result;
}
