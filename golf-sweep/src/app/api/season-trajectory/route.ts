import { NextResponse } from "next/server";
import { db } from "@/db";
import { seasonSnapshots, players, tournaments } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const allPlayers = await db.select().from(players);
  const allTournaments = await db.select().from(tournaments);
  const allSnapshots = await db.select().from(seasonSnapshots);

  const result = allPlayers.map((player) => {
    const playerSnaps = allSnapshots
      .filter((s) => s.playerId === player.id)
      .sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime());

    return {
      player: { id: player.id, name: player.name, slug: player.slug, color: player.color },
      dataPoints: playerSnaps.map((s) => {
        const tournament = allTournaments.find((t) => t.id === s.throughTournamentId);
        return {
          tournamentName: tournament?.name ?? "",
          tournamentSlug: tournament?.slug ?? "",
          cumulativePoints: s.cumulativePoints,
          capturedAt: s.capturedAt.toISOString(),
        };
      }),
    };
  });

  return NextResponse.json({
    players: result,
    tournaments: allTournaments.map((t) => ({ id: t.id, name: t.name, slug: t.slug, status: t.status })),
  });
}
