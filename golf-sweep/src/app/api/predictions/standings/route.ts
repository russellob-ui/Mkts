import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import { players, roundPredictions } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureTables();

    const allPlayers = await db.select().from(players);
    const allPredictions = await db.select().from(roundPredictions);

    const standings = allPlayers.map((player) => {
      const playerPredictions = allPredictions.filter(
        (p) => p.predictorPlayerId === player.id
      );

      const totalPoints = playerPredictions.reduce(
        (sum, p) => sum + (p.pointsAwarded ?? 0),
        0
      );

      const totalPredictions = playerPredictions.length;
      const resolved = playerPredictions.filter((p) => p.resolvedAt !== null);
      const outcomeCorrect = resolved.filter((p) => p.outcomeCorrect).length;
      const exactCorrect = resolved.filter((p) => p.exactCorrect).length;

      return {
        player: {
          id: player.id,
          name: player.name,
          slug: player.slug,
          color: player.color,
          avatarEmoji: player.avatarEmoji,
        },
        totalPoints,
        totalPredictions,
        resolved: resolved.length,
        outcomeCorrect,
        exactCorrect,
      };
    });

    standings.sort((a, b) => b.totalPoints - a.totalPoints);

    return NextResponse.json({ standings });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
