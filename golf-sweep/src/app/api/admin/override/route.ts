import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  golfers,
  tournaments,
  rounds,
  roundScores,
  tournamentResults,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(request: NextRequest) {
  const passcode = request.headers.get("x-admin-passcode");
  if (passcode !== process.env.ADMIN_PASSCODE) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { golferId, position, scoreToPar, roundNumber, roundScore, thru } =
      await request.json();

    const liveTournaments = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.status, "live"));
    const tournament = liveTournaments[0];
    if (!tournament) {
      return NextResponse.json({ error: "No live tournament" }, { status: 400 });
    }

    // Update tournament result
    if (position !== undefined || scoreToPar !== undefined) {
      const existingResult = await db
        .select()
        .from(tournamentResults)
        .where(
          and(
            eq(tournamentResults.golferId, golferId),
            eq(tournamentResults.tournamentId, tournament.id)
          )
        );

      const updates: Record<string, unknown> = {};
      if (position !== undefined) updates.finalPosition = position;
      if (scoreToPar !== undefined) updates.finalScoreToPar = scoreToPar;

      if (existingResult.length > 0) {
        await db
          .update(tournamentResults)
          .set(updates)
          .where(eq(tournamentResults.id, existingResult[0].id));
      }
    }

    // Update round score
    if (roundNumber && roundScore !== undefined) {
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
      if (round) {
        const existing = await db
          .select()
          .from(roundScores)
          .where(
            and(
              eq(roundScores.golferId, golferId),
              eq(roundScores.roundId, round.id)
            )
          );

        if (existing.length > 0) {
          await db
            .update(roundScores)
            .set({
              scoreToPar: roundScore,
              thru: thru ?? "F",
              position: position ?? existing[0].position,
              updatedAt: new Date(),
            })
            .where(eq(roundScores.id, existing[0].id));
        } else {
          await db.insert(roundScores).values({
            golferId,
            roundId: round.id,
            scoreToPar: roundScore,
            thru: thru ?? null,
            position: position ?? null,
          });
        }
      }
    }

    return NextResponse.json({ message: "Override applied" });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
