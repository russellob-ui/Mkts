import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  tournaments,
  picks,
  rounds,
  roundScores,
  tournamentResults,
  pointsLog,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { calcRoundOfDay, calcBestOfRound } from "@/lib/points";

export async function POST(request: NextRequest) {
  const passcode = request.headers.get("x-admin-passcode");
  if (passcode !== process.env.ADMIN_PASSCODE) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { roundNumber } = await request.json();

    const liveTournaments = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.status, "live"));
    const tournament = liveTournaments[0];
    if (!tournament) {
      return NextResponse.json({ error: "No live tournament" }, { status: 400 });
    }

    // Find the round
    const tournamentRounds = await db
      .select()
      .from(rounds)
      .where(
        and(
          eq(rounds.tournamentId, tournament.id),
          eq(rounds.roundNumber, roundNumber)
        )
      );
    const round = tournamentRounds[0];
    if (!round) {
      return NextResponse.json({ error: "Round not found" }, { status: 400 });
    }

    // Mark round as finished
    await db
      .update(rounds)
      .set({ status: "finished" })
      .where(eq(rounds.id, round.id));

    // Advance next round to live
    const nextRound = await db
      .select()
      .from(rounds)
      .where(
        and(
          eq(rounds.tournamentId, tournament.id),
          eq(rounds.roundNumber, roundNumber + 1)
        )
      );
    if (nextRound[0]) {
      await db
        .update(rounds)
        .set({ status: "live" })
        .where(eq(rounds.id, nextRound[0].id));
    }

    // Get picks for this tournament
    const tournamentPicks = await db
      .select()
      .from(picks)
      .where(eq(picks.tournamentId, tournament.id));

    // Get round scores for our golfers
    const scores: Array<{ golferId: number; playerId: number; scoreToPar: number | null }> = [];
    for (const pick of tournamentPicks) {
      const [score] = await db
        .select()
        .from(roundScores)
        .where(
          and(
            eq(roundScores.golferId, pick.golferId),
            eq(roundScores.roundId, round.id)
          )
        );
      scores.push({
        golferId: pick.golferId,
        playerId: pick.playerId,
        scoreToPar: score?.scoreToPar ?? null,
      });
    }

    // Calculate round-of-the-day bonus (+5)
    const rotd = calcRoundOfDay(scores);
    for (const [golferId, bonus] of rotd) {
      const pick = tournamentPicks.find((p) => p.golferId === golferId);
      if (!pick) continue;
      await db.insert(pointsLog).values({
        playerId: pick.playerId,
        tournamentId: tournament.id,
        source: "rotd",
        points: bonus,
        note: `Round ${roundNumber} of the day`,
      });
    }

    // Calculate best-of-round bonus (+2) based on cumulative to par
    // Get tournament results for cumulative scores
    const cumScores: Array<{ golferId: number; totalToPar: number | null }> = [];
    for (const pick of tournamentPicks) {
      const [result] = await db
        .select()
        .from(tournamentResults)
        .where(
          and(
            eq(tournamentResults.golferId, pick.golferId),
            eq(tournamentResults.tournamentId, tournament.id)
          )
        );
      cumScores.push({
        golferId: pick.golferId,
        totalToPar: result?.finalScoreToPar ?? null,
      });
    }

    const bor = calcBestOfRound(cumScores);
    for (const [golferId, bonus] of bor) {
      const pick = tournamentPicks.find((p) => p.golferId === golferId);
      if (!pick) continue;
      await db.insert(pointsLog).values({
        playerId: pick.playerId,
        tournamentId: tournament.id,
        source: "bor",
        points: bonus,
        note: `Best of round ${roundNumber}`,
      });
    }

    return NextResponse.json({
      message: `Round ${roundNumber} marked complete`,
      rotdBonuses: Object.fromEntries(rotd),
      borBonuses: Object.fromEntries(bor),
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
