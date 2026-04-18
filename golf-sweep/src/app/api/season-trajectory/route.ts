import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import { players, tournaments, pointsLog } from "@/db/schema";

export const dynamic = "force-dynamic";

/**
 * GET /api/season-trajectory
 *
 * Computes cumulative season points per player across all finished
 * tournaments. Built from pointsLog (which IS populated by the
 * settlement system), not from seasonSnapshots (which was never
 * written to).
 */
export async function GET() {
  try {
    await ensureTables();

    const allPlayers = await db.select().from(players);
    const allTournaments = await db.select().from(tournaments);
    const allPoints = await db.select().from(pointsLog);

    // Sort tournaments in major order
    const majorOrder = ["masters", "pga", "us-open", "open"];
    const sortedTournaments = [...allTournaments].sort((a, b) => {
      const ai = majorOrder.indexOf(a.slug ?? "");
      const bi = majorOrder.indexOf(b.slug ?? "");
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

    const result = allPlayers.map((player) => {
      let cumulative = 0;
      const dataPoints: Array<{
        tournamentName: string;
        tournamentSlug: string;
        cumulativePoints: number;
        tournamentPoints: number;
      }> = [];

      for (const t of sortedTournaments) {
        if (t.status !== "finished") continue;
        const tournPoints = allPoints
          .filter(
            (p) => p.playerId === player.id && p.tournamentId === t.id
          )
          .reduce((sum, p) => sum + p.points, 0);
        cumulative += tournPoints;
        dataPoints.push({
          tournamentName: t.name,
          tournamentSlug: t.slug ?? "",
          cumulativePoints: cumulative,
          tournamentPoints: tournPoints,
        });
      }

      return {
        player: {
          id: player.id,
          name: player.name,
          slug: player.slug,
          color: player.color,
        },
        dataPoints,
      };
    });

    return NextResponse.json({
      players: result,
      tournaments: sortedTournaments.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        status: t.status,
      })),
    });
  } catch (error) {
    console.error("[SeasonTrajectory]", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
