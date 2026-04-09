import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import { scoreSnapshots, picks, players, golfers } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  await ensureTables();
  const tournamentId = Number(request.nextUrl.searchParams.get("tournamentId") ?? "1");

  const tournamentPicks = await db.select().from(picks).where(eq(picks.tournamentId, tournamentId));
  const allPlayers = await db.select().from(players);
  const allGolfers = await db.select().from(golfers);

  const result = [];
  for (const pick of tournamentPicks) {
    const player = allPlayers.find((p) => p.id === pick.playerId);
    const golfer = allGolfers.find((g) => g.id === pick.golferId);
    if (!player || !golfer) continue;

    const snapshots = await db
      .select()
      .from(scoreSnapshots)
      .where(
        and(
          eq(scoreSnapshots.golferId, pick.golferId),
          eq(scoreSnapshots.tournamentId, tournamentId)
        )
      );

    // Sort by captured_at ascending
    snapshots.sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime());

    result.push({
      player: { id: player.id, name: player.name, slug: player.slug, color: player.color },
      golfer: { id: golfer.id, name: golfer.name, flagEmoji: golfer.flagEmoji },
      snapshots: snapshots.map((s) => ({
        totalScoreToPar: s.totalScoreToPar,
        roundScoreToPar: s.roundScoreToPar,
        position: s.position,
        positionNumeric: s.positionNumeric,
        thru: s.thru,
        thruNumeric: s.thruNumeric,
        roundNumber: s.roundNumber,
        capturedAt: s.capturedAt.toISOString(),
      })),
    });
  }

  return NextResponse.json({ trajectories: result });
}
