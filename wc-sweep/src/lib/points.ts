import { getTierMultiplier } from "./api-football";

export function calcMatchPoints(
  homeScore: number,
  awayScore: number,
  teamId: number,
  homeTeamId: number,
  awayTeamId: number,
  tier: number
): { source: string; points: number; note: string }[] {
  const mult = getTierMultiplier(tier);
  const isHome = teamId === homeTeamId;
  const teamScore = isHome ? homeScore : awayScore;
  const oppScore = isHome ? awayScore : homeScore;
  const results: { source: string; points: number; note: string }[] = [];

  if (teamScore > oppScore) {
    results.push({
      source: "match_win",
      points: 3 * mult,
      note: `Win ${homeScore}-${awayScore} (x${mult})`,
    });
  } else if (teamScore === oppScore) {
    results.push({
      source: "match_draw",
      points: 1 * mult,
      note: `Draw ${homeScore}-${awayScore} (x${mult})`,
    });
  }

  if (oppScore === 0 && teamScore > oppScore) {
    results.push({
      source: "clean_sheet",
      points: 1 * mult,
      note: `Clean sheet (x${mult})`,
    });
  }

  if (teamScore >= 3) {
    results.push({
      source: "goals_bonus",
      points: 1 * mult,
      note: `3+ goals scored (x${mult})`,
    });
  }

  return results;
}

export function calcAdvancementPoints(
  stage: string,
  tier: number
): { source: string; points: number; note: string } | null {
  const mult = getTierMultiplier(tier);
  const map: Record<string, { pts: number; label: string }> = {
    qualify_top2: { pts: 5, label: "Qualified from group (top 2)" },
    qualify_3rd: { pts: 3, label: "Qualified as best 3rd" },
    R32: { pts: 4, label: "Won Round of 32" },
    R16: { pts: 6, label: "Won Round of 16" },
    QF: { pts: 8, label: "Won Quarter-final" },
    SF: { pts: 10, label: "Won Semi-final" },
    F: { pts: 15, label: "Won the Final" },
    RU: { pts: 8, label: "Runner-up" },
    "3P": { pts: 5, label: "Third place" },
  };
  const entry = map[stage];
  if (!entry) return null;
  return {
    source: `advance_${stage}`,
    points: entry.pts * mult,
    note: `${entry.label} (x${mult})`,
  };
}

export const TIER_LABELS: Record<number, string> = {
  1: "Elite",
  2: "Strong",
  3: "Mid",
  4: "Underdog",
};
