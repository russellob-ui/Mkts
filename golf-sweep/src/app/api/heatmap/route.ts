import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { picks, players, golfers, rounds, roundScores, tournamentResults } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const tournamentId = Number(request.nextUrl.searchParams.get("tournamentId") ?? "1");

  const tournamentPicks = await db.select().from(picks).where(eq(picks.tournamentId, tournamentId));
  const allPlayers = await db.select().from(players);
  const allGolfers = await db.select().from(golfers);
  const tournamentRounds = await db.select().from(rounds).where(eq(rounds.tournamentId, tournamentId));

  const data = [];
  for (const pick of tournamentPicks) {
    const player = allPlayers.find((p) => p.id === pick.playerId);
    const golfer = allGolfers.find((g) => g.id === pick.golferId);
    if (!player || !golfer) continue;

    const [result] = await db.select().from(tournamentResults)
      .where(and(eq(tournamentResults.golferId, golfer.id), eq(tournamentResults.tournamentId, tournamentId)));

    const roundData: Record<number, number | null> = {};
    for (const round of tournamentRounds) {
      const [score] = await db.select().from(roundScores)
        .where(and(eq(roundScores.golferId, golfer.id), eq(roundScores.roundId, round.id)));
      roundData[round.roundNumber] = score?.scoreToPar ?? null;
    }

    data.push({
      player: { name: player.name, slug: player.slug, color: player.color },
      golfer: { name: golfer.name, flagEmoji: golfer.flagEmoji },
      rounds: roundData,
      totalToPar: result?.finalScoreToPar ?? null,
      position: result?.finalPosition ?? null,
    });
  }

  // Sort by position
  data.sort((a, b) => {
    const posA = a.position ? parseInt(a.position.replace(/^T/, "")) : 999;
    const posB = b.position ? parseInt(b.position.replace(/^T/, "")) : 999;
    return posA - posB;
  });

  return NextResponse.json({ heatmap: data });
}
