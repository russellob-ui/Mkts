import { NextResponse } from "next/server";
import { db } from "@/db";
import { players, tournaments, pointsLog } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

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

    return NextResponse.json({
      standings,
      tournaments: allTournaments.map((t) => ({
        id: t.id,
        name: t.name,
        status: t.status,
        startDate: t.startDate,
        endDate: t.endDate,
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
