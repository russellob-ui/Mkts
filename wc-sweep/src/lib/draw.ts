export interface DrawAssignment {
  teamId: number;
  playerId: number;
  tier: number;
  order: number;
}

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) & 0xffffffff;
  }
  return h >>> 0;
}

function seededRng(seed: string): () => number {
  let s = hashSeed(seed);
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function seededShuffle<T>(arr: T[], rng: () => number): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function generateDraw(
  teams: Array<{ id: number; tier: number }>,
  playerIds: number[],
  seed: string
): DrawAssignment[] {
  if (playerIds.length < 2) throw new Error("Need at least 2 players");
  if (teams.length === 0) throw new Error("No teams to draw");

  const rng = seededRng(seed);
  const shuffledTeams = seededShuffle(teams, rng);
  const shuffledPlayers = seededShuffle(playerIds, rng);

  const assignments: DrawAssignment[] = [];
  let order = 0;

  for (const team of shuffledTeams) {
    const playerIdx = order % shuffledPlayers.length;
    assignments.push({
      teamId: team.id,
      playerId: shuffledPlayers[playerIdx],
      tier: team.tier,
      order: order + 1,
    });
    order++;
  }

  return assignments;
}

export function generateSeed(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let seed = "";
  for (let i = 0; i < 16; i++) {
    seed += chars[Math.floor(Math.random() * chars.length)];
  }
  return seed;
}

export function teamsPerPlayer(
  teamCount: number,
  playerCount: number
): { min: number; max: number; extra: number } {
  const base = Math.floor(teamCount / playerCount);
  const remainder = teamCount % playerCount;
  return {
    min: base,
    max: remainder > 0 ? base + 1 : base,
    extra: remainder,
  };
}
