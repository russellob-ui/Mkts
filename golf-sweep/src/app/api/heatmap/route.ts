import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import { picks, players, golfers, rounds, roundScores, tournamentResults } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await ensureTables();
    const tournamentId = Number(request.nextUrl.searchParams.get("tournamentId") ?? "1");

    const tournamentPicks = await db.select().from(picks).where(eq(picks.tournamentId, tournamentId));
    const allPlayers = await db.select().from(players);
    const allGolfers = await db.select().from(golfers);
    const tournamentRounds = await db.select().from(rounds).where(eq(rounds.tournamentId, tournamentId));

    // Determine which rounds have finished — if R2-R4 are all unfinished,
    // the total score IS the R1 score.
    const completedRounds = tournamentRounds.filter((r) => r.status === "finished").length;

    const data = [];
    for (const pick of tournamentPicks) {
      const player = allPlayers.find((p) => p.id === pick.playerId);
      const golfer = allGolfers.find((g) => g.id === pick.golferId);
      if (!player || !golfer) continue;

      const [result] = await db.select().from(tournamentResults)
        .where(and(eq(tournamentResults.golferId, golfer.id), eq(tournamentResults.tournamentId, tournamentId)));

      const roundData: Record<number, number | null> = {};
      let hasAnyRoundScore = false;
      for (const round of tournamentRounds) {
        const [score] = await db.select().from(roundScores)
          .where(and(eq(roundScores.golferId, golfer.id), eq(roundScores.roundId, round.id)));
        roundData[round.roundNumber] = score?.scoreToPar ?? null;
        if (score?.scoreToPar != null) hasAnyRoundScore = true;
      }

      // FALLBACK: If round_scores is completely empty for this golfer but we
      // have a tournament total, and the total presumably reflects only the
      // rounds played so far, distribute it to the played rounds.
      // Simplest case: only R1 has any scores anywhere, so total = R1 score.
      if (!hasAnyRoundScore && result?.finalScoreToPar != null) {
        // Assume the total represents completed rounds only
        // For now, put it all in R1 (which is almost always the case for early poll)
        roundData[1] = result.finalScoreToPar;
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
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
