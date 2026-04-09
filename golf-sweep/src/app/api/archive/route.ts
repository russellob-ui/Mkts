import { NextResponse } from "next/server";
import { db } from "@/db";
import { tournaments, picks, players, golfers, tournamentResults, pointsLog } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const allTournaments = await db.select().from(tournaments);
  const allPlayers = await db.select().from(players);

  const result = [];
  for (const tournament of allTournaments) {
    let sweepWinner = null;
    if (tournament.status === "finished") {
      // Find player with most points
      const allPoints = await db.select().from(pointsLog).where(eq(pointsLog.tournamentId, tournament.id));
      const playerTotals = new Map<number, number>();
      for (const p of allPoints) {
        playerTotals.set(p.playerId, (playerTotals.get(p.playerId) ?? 0) + p.points);
      }
      let maxPts = 0;
      let winnerId = 0;
      for (const [pid, pts] of playerTotals) {
        if (pts > maxPts) { maxPts = pts; winnerId = pid; }
      }
      if (winnerId) {
        const winner = allPlayers.find((p) => p.id === winnerId);
        const winnerPick = await db.select().from(picks)
          .where(and(eq(picks.playerId, winnerId), eq(picks.tournamentId, tournament.id)));
        const winnerGolfer = winnerPick[0]
          ? (await db.select().from(golfers).where(eq(golfers.id, winnerPick[0].golferId)))[0]
          : null;
        sweepWinner = {
          player: winner?.name,
          golfer: winnerGolfer?.name,
          points: maxPts,
        };
      }
    }

    result.push({
      id: tournament.id,
      name: tournament.name,
      slug: tournament.slug,
      startDate: tournament.startDate,
      endDate: tournament.endDate,
      status: tournament.status,
      sweepWinner,
    });
  }

  return NextResponse.json({ tournaments: result });
}
