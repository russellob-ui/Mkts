import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  players,
  picks,
  golfers,
  tournaments,
  rounds,
  roundScores,
  tournamentResults,
  pointsLog,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  getScorecard,
  analyzeScorecardRound,
  getGolfSeasonYear,
  ScorecardRound,
} from "@/lib/slashgolf";

export const dynamic = "force-dynamic";

// In-memory scorecard cache — 60s TTL per player
const scorecardCache = new Map<
  string,
  { data: ScorecardRound[]; cachedAt: number }
>();

async function getCachedScorecard(
  tournId: string,
  year: number,
  playerId: string
): Promise<ScorecardRound[]> {
  const key = `${tournId}-${year}-${playerId}`;
  const cached = scorecardCache.get(key);
  if (cached && Date.now() - cached.cachedAt < 30_000) {
    return cached.data;
  }
  const data = await getScorecard(tournId, year, playerId);
  scorecardCache.set(key, { data, cachedAt: Date.now() });
  return data;
}

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
  }

  try {
    const [player] = await db
      .select()
      .from(players)
      .where(eq(players.slug, slug));
    if (!player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    // Get all picks for this player
    const playerPicks = await db
      .select()
      .from(picks)
      .where(eq(picks.playerId, player.id));

    const pickDetails = [];
    for (const pick of playerPicks) {
      const [golfer] = await db.select().from(golfers).where(eq(golfers.id, pick.golferId));
      const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, pick.tournamentId));
      if (!golfer || !tournament) continue;

      // Get tournament result
      const [result] = await db
        .select()
        .from(tournamentResults)
        .where(
          and(
            eq(tournamentResults.golferId, golfer.id),
            eq(tournamentResults.tournamentId, tournament.id)
          )
        );

      // Get round scores
      const tournamentRounds = await db
        .select()
        .from(rounds)
        .where(eq(rounds.tournamentId, tournament.id));

      const scores: Record<number, { scoreToPar: number | null; thru: string | null }> = {};
      for (const round of tournamentRounds) {
        const [score] = await db
          .select()
          .from(roundScores)
          .where(
            and(
              eq(roundScores.golferId, golfer.id),
              eq(roundScores.roundId, round.id)
            )
          );
        if (score) {
          scores[round.roundNumber] = {
            scoreToPar: score.scoreToPar,
            thru: score.thru,
          };
        }
      }

      // Get points
      const points = await db
        .select()
        .from(pointsLog)
        .where(
          and(
            eq(pointsLog.playerId, player.id),
            eq(pointsLog.tournamentId, tournament.id)
          )
        );

      // Fetch scorecard if tournament has a slashTournId and golfer has a slashPlayerId
      let scorecardRounds: Array<{
        roundId: number;
        roundComplete: boolean;
        totalShots: number;
        holes: Array<{ holeId: number; holeScore: number; par: number }>;
        analysis: {
          eagles: number;
          birdies: number;
          bogeys: number;
          doubles: number;
        };
      }> = [];

      if (
        tournament.slashTournId &&
        golfer.slashPlayerId &&
        process.env.RAPIDAPI_KEY
      ) {
        try {
          const rawRounds = await getCachedScorecard(
            tournament.slashTournId,
            getGolfSeasonYear(),
            golfer.slashPlayerId
          );
          scorecardRounds = rawRounds
            .filter((r) => r.holes.length > 0)
            .map((r) => {
              const analysis = analyzeScorecardRound(r);
              return {
                roundId: r.roundId,
                roundComplete: r.roundComplete,
                totalShots: r.totalShots,
                holes: r.holes.map((h) => ({
                  holeId: h.holeId,
                  holeScore: h.holeScore,
                  par: h.par,
                })),
                analysis: {
                  eagles: analysis.eagles.length,
                  birdies: analysis.birdies.length,
                  bogeys: analysis.bogeys.length,
                  doubles: analysis.doubles.length,
                },
              };
            });
        } catch (err) {
          console.error(
            `[Player API] Scorecard fetch failed for ${golfer.name}:`,
            err
          );
        }
      }

      pickDetails.push({
        tournament: {
          id: tournament.id,
          name: tournament.name,
          status: tournament.status,
        },
        golfer: {
          id: golfer.id,
          name: golfer.name,
          country: golfer.country,
          flagEmoji: golfer.flagEmoji,
        },
        openingOdds: pick.openingOdds,
        result: result
          ? {
              position: result.finalPosition,
              scoreToPar: result.finalScoreToPar,
              madeCut: result.madeCut,
            }
          : null,
        roundScores: scores,
        scorecard: scorecardRounds,
        points: points.map((p) => ({
          source: p.source,
          points: p.points,
          note: p.note,
        })),
        totalPoints: points.reduce((sum, p) => sum + p.points, 0),
      });
    }

    return NextResponse.json({
      player: {
        id: player.id,
        name: player.name,
        slug: player.slug,
        color: player.color,
        avatarEmoji: player.avatarEmoji,
      },
      picks: pickDetails,
      totalPoints: pickDetails.reduce((sum, p) => sum + p.totalPoints, 0),
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
