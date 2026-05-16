import { NextResponse } from "next/server";
import { db } from "@/db";
import { players, tournaments, pointsLog, picks, golfers } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  getScorecard,
  analyzeScorecardRound,
  getGolfSeasonYear,
  getLeaderboard,
  parseLeaderboardPlayers,
  normalizeGolferName,
} from "@/lib/slashgolf";

export const dynamic = "force-dynamic";

interface PlayerScoringStats {
  playerId: number;
  playerName: string;
  totalBirdies: number;
  totalEagles: number;
  totalBogeys: number;
  birdieRate: number; // birdies per round
  bestSingleRound: number | null; // lowest absolute score in a round
  roundsPlayed: number;
}

/**
 * Compute scoring stats from scorecards of finished tournaments.
 */
async function computeScoringStats(
  finishedTournaments: Array<{ id: number; name: string; slashTournId: string | null }>
): Promise<PlayerScoringStats[]> {
  const allPlayers = await db.select().from(players);
  const allGolfers = await db.select().from(golfers);
  const year = getGolfSeasonYear();

  // Per-player accumulators
  const stats = new Map<
    number,
    {
      playerName: string;
      totalBirdies: number;
      totalEagles: number;
      totalBogeys: number;
      roundsPlayed: number;
      bestSingleRound: number | null;
    }
  >();

  for (const player of allPlayers) {
    stats.set(player.id, {
      playerName: player.name,
      totalBirdies: 0,
      totalEagles: 0,
      totalBogeys: 0,
      roundsPlayed: 0,
      bestSingleRound: null,
    });
  }

  for (const tournament of finishedTournaments) {
    if (!tournament.slashTournId || !process.env.RAPIDAPI_KEY) continue;

    let lbPlayers;
    try {
      const lbRaw = await getLeaderboard(tournament.slashTournId, year);
      lbPlayers = parseLeaderboardPlayers(lbRaw);
    } catch {
      continue;
    }

    const tournamentPicks = await db
      .select()
      .from(picks)
      .where(eq(picks.tournamentId, tournament.id));

    for (const pick of tournamentPicks) {
      const golfer = allGolfers.find((g) => g.id === pick.golferId);
      if (!golfer) continue;

      const normalized = normalizeGolferName(golfer.name);
      const lbPlayer = lbPlayers.find((p) => {
        const pNorm = normalizeGolferName(p.name);
        return (
          pNorm === normalized ||
          pNorm.includes(normalized) ||
          normalized.includes(pNorm)
        );
      });

      if (!lbPlayer || !lbPlayer.playerId) continue;

      let rounds;
      try {
        rounds = await getScorecard(
          tournament.slashTournId!,
          year,
          lbPlayer.playerId
        );
      } catch {
        continue;
      }

      const playerStats = stats.get(pick.playerId);
      if (!playerStats) continue;

      for (const round of rounds) {
        if (round.holes.length === 0) continue;

        const analysis = analyzeScorecardRound(round);
        playerStats.totalBirdies += analysis.birdies.length;
        playerStats.totalEagles +=
          analysis.eagles.length + analysis.albatross.length;
        playerStats.totalBogeys +=
          analysis.bogeys.length + analysis.doubles.length;
        playerStats.roundsPlayed++;

        // Track best single round (lowest total shots)
        if (round.totalShots > 0) {
          if (
            playerStats.bestSingleRound === null ||
            round.totalShots < playerStats.bestSingleRound
          ) {
            playerStats.bestSingleRound = round.totalShots;
          }
        }
      }
    }
  }

  const result: PlayerScoringStats[] = [];
  for (const [playerId, s] of stats) {
    result.push({
      playerId,
      playerName: s.playerName,
      totalBirdies: s.totalBirdies,
      totalEagles: s.totalEagles,
      totalBogeys: s.totalBogeys,
      birdieRate:
        s.roundsPlayed > 0
          ? Math.round((s.totalBirdies / s.roundsPlayed) * 10) / 10
          : 0,
      bestSingleRound: s.bestSingleRound,
      roundsPlayed: s.roundsPlayed,
    });
  }

  // Sort by total birdies descending
  result.sort((a, b) => b.totalBirdies - a.totalBirdies);
  return result;
}

export async function GET() {
  try {
    const allPlayers = await db.select().from(players);
    const allTournaments = await db.select().from(tournaments);
    const allPoints = await db.select().from(pointsLog);

    const standings = allPlayers.map((player) => {
      const playerPoints = allPoints.filter((p) => p.playerId === player.id);
      const byTournament: Record<string, number> = {};

      for (const t of allTournaments) {
        const tournPoints = playerPoints
          .filter((p) => p.tournamentId === t.id)
          .reduce((sum, p) => sum + p.points, 0);
        byTournament[t.name] = tournPoints;
      }

      const total = playerPoints.reduce((sum, p) => sum + p.points, 0);

      return {
        player: {
          id: player.id,
          name: player.name,
          slug: player.slug,
          color: player.color,
          avatarEmoji: player.avatarEmoji,
        },
        byTournament,
        total,
      };
    });

    standings.sort((a, b) => b.total - a.total);

    // Compute scoring stats from finished tournaments (best-effort)
    const finishedTournaments = allTournaments.filter(
      (t) => t.status === "finished"
    );
    let scoringStats: PlayerScoringStats[] = [];
    try {
      scoringStats = await computeScoringStats(finishedTournaments);
    } catch (err) {
      console.error("[Season] computeScoringStats error (non-fatal):", err);
    }

    return NextResponse.json({
      standings,
      tournaments: allTournaments.map((t) => ({
        id: t.id,
        name: t.name,
        status: t.status,
        startDate: t.startDate,
        endDate: t.endDate,
      })),
      scoringStats,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
