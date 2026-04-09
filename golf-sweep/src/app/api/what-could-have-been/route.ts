import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import {
  players,
  picks,
  golfers,
  tournamentResults,
  pointsLog,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { getFinishPoints } from "@/lib/points";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await ensureTables();

    const tournamentId = Number(
      request.nextUrl.searchParams.get("tournamentId") ?? "0"
    );

    if (!tournamentId) {
      return NextResponse.json(
        { error: "tournamentId query param is required" },
        { status: 400 }
      );
    }

    const allPlayers = await db.select().from(players);
    const allGolfers = await db.select().from(golfers);

    // Get all picks for this tournament
    const tournamentPicks = await db
      .select()
      .from(picks)
      .where(eq(picks.tournamentId, tournamentId));

    // Get all results for this tournament
    const results = await db
      .select()
      .from(tournamentResults)
      .where(eq(tournamentResults.tournamentId, tournamentId));

    // Get actual points from pointsLog
    const allPoints = await db
      .select()
      .from(pointsLog)
      .where(eq(pointsLog.tournamentId, tournamentId));

    // Build golfer result map: golferId -> finish position
    const golferResults = new Map<
      number,
      { position: string | null; scoreToPar: number | null; madeCut: boolean | null }
    >();
    for (const r of results) {
      golferResults.set(r.golferId, {
        position: r.finalPosition,
        scoreToPar: r.finalScoreToPar,
        madeCut: r.madeCut,
      });
    }

    const analysis = allPlayers.map((player) => {
      const pick = tournamentPicks.find((p) => p.playerId === player.id);
      if (!pick) return null;

      const actualGolfer = allGolfers.find((g) => g.id === pick.golferId);
      const actualResult = golferResults.get(pick.golferId);
      const actualPoints = allPoints
        .filter((p) => p.playerId === player.id)
        .reduce((sum, p) => sum + p.points, 0);

      // What they would have earned with each other player's golfer
      const alternatives = tournamentPicks
        .filter((p) => p.playerId !== player.id)
        .map((otherPick) => {
          const otherPlayer = allPlayers.find(
            (p) => p.id === otherPick.playerId
          );
          const otherGolfer = allGolfers.find(
            (g) => g.id === otherPick.golferId
          );
          const otherResult = golferResults.get(otherPick.golferId);
          const hypotheticalPoints = getFinishPoints(
            otherResult?.position ?? null
          );

          return {
            playerId: otherPick.playerId,
            playerName: otherPlayer?.name ?? "Unknown",
            golferId: otherPick.golferId,
            golferName: otherGolfer?.name ?? "Unknown",
            position: otherResult?.position ?? null,
            hypotheticalFinishPoints: hypotheticalPoints,
          };
        });

      return {
        player: {
          id: player.id,
          name: player.name,
          slug: player.slug,
          color: player.color,
          avatarEmoji: player.avatarEmoji,
        },
        actualGolfer: actualGolfer?.name ?? "Unknown",
        actualGolferId: pick.golferId,
        actualPosition: actualResult?.position ?? null,
        actualPoints,
        actualFinishPoints: getFinishPoints(actualResult?.position ?? null),
        alternatives,
        bestAlternative: alternatives.length > 0
          ? alternatives.reduce((best, alt) =>
              alt.hypotheticalFinishPoints > best.hypotheticalFinishPoints
                ? alt
                : best
            )
          : null,
      };
    }).filter(Boolean);

    return NextResponse.json({ tournamentId, analysis });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
