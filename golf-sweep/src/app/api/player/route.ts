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

export const dynamic = "force-dynamic";

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
