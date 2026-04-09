import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  tournaments,
  picks,
  tournamentResults,
  pointsLog,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getFinishPoints } from "@/lib/points";

export async function POST(request: NextRequest) {
  const passcode = request.headers.get("x-admin-passcode");
  if (passcode !== process.env.ADMIN_PASSCODE) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const liveTournaments = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.status, "live"));
    const tournament = liveTournaments[0];
    if (!tournament) {
      return NextResponse.json({ error: "No live tournament" }, { status: 400 });
    }

    // Mark tournament as finished
    await db
      .update(tournaments)
      .set({ status: "finished" })
      .where(eq(tournaments.id, tournament.id));

    // Get picks
    const tournamentPicks = await db
      .select()
      .from(picks)
      .where(eq(picks.tournamentId, tournament.id));

    const finishResults: Array<Record<string, unknown>> = [];

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

      const points = getFinishPoints(result?.finalPosition);
      if (points > 0) {
        await db.insert(pointsLog).values({
          playerId: pick.playerId,
          tournamentId: tournament.id,
          source: "finish",
          points,
          note: `Finished ${result?.finalPosition}`,
        });
      }

      finishResults.push({
        playerId: pick.playerId,
        golferId: pick.golferId,
        position: result?.finalPosition,
        points,
      });
    }

    return NextResponse.json({
      message: "Tournament marked as finished",
      results: finishResults,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
