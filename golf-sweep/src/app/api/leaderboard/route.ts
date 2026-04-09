import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  players,
  tournaments,
  golfers,
  picks,
  rounds,
  roundScores,
  tournamentResults,
  pointsLog,
} from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Seed check — auto-seed if DB is empty
    const allPlayers = await db.select().from(players);
    if (allPlayers.length === 0) {
      // Trigger seed
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000";
      try {
        await fetch(`${baseUrl}/api/seed`, { method: "POST" });
      } catch {
        // Seed failed, return empty
      }
      return NextResponse.json({ entries: [], tournament: null, lastPolled: null });
    }

    // Get live or most recent tournament
    const liveTournaments = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.status, "live"));

    const tournament = liveTournaments[0] ?? (
      await db.select().from(tournaments).limit(1)
    )[0];

    if (!tournament) {
      return NextResponse.json({ entries: [], tournament: null, lastPolled: null });
    }

    // Get picks for this tournament with player and golfer info
    const tournamentPicks = await db
      .select()
      .from(picks)
      .where(eq(picks.tournamentId, tournament.id));

    // Get all rounds for this tournament
    const tournamentRounds = await db
      .select()
      .from(rounds)
      .where(eq(rounds.tournamentId, tournament.id));

    // Build leaderboard entries
    const entries = [];
    for (const pick of tournamentPicks) {
      const player = allPlayers.find((p) => p.id === pick.playerId);
      const golfer = (await db.select().from(golfers).where(eq(golfers.id, pick.golferId)))[0];
      if (!player || !golfer) continue;

      // Get tournament result
      const [result] = await db
        .select()
        .from(tournamentResults)
        .where(
          and(
            eq(tournamentResults.golferId, golfer.id),
            eq(tournamentResults.tournamentId, tournament.id)
          )
        );

      // Get round scores
      const scores: Record<number, { scoreToPar: number | null; thru: string | null }> = {};
      for (const round of tournamentRounds) {
        const [score] = await db
          .select()
          .from(roundScores)
          .where(
            and(
              eq(roundScores.golferId, golfer.id),
              eq(roundScores.roundId, round.id)
            )
          );
        if (score) {
          scores[round.roundNumber] = {
            scoreToPar: score.scoreToPar,
            thru: score.thru,
          };
        }
      }

      // Get points for this tournament
      const playerPoints = await db
        .select()
        .from(pointsLog)
        .where(
          and(
            eq(pointsLog.playerId, player.id),
            eq(pointsLog.tournamentId, tournament.id)
          )
        );
      const totalPoints = playerPoints.reduce((sum, p) => sum + p.points, 0);

      entries.push({
        player: {
          id: player.id,
          name: player.name,
          slug: player.slug,
          color: player.color,
          avatarEmoji: player.avatarEmoji,
        },
        golfer: {
          id: golfer.id,
          name: golfer.name,
          country: golfer.country,
          flagEmoji: golfer.flagEmoji,
        },
        position: result?.finalPosition ?? null,
        scoreToPar: result?.finalScoreToPar ?? null,
        madeCut: result?.madeCut,
        thru: scores[Math.max(...Object.keys(scores).map(Number), 0)]?.thru ?? null,
        openingOdds: pick.openingOdds,
        roundScores: scores,
        points: totalPoints,
      });
    }

    // Sort by position (numeric, nulls last)
    entries.sort((a, b) => {
      const posA = a.position ? parseInt(a.position.replace(/^T/, "")) : 999;
      const posB = b.position ? parseInt(b.position.replace(/^T/, "")) : 999;
      return posA - posB;
    });

    return NextResponse.json({
      entries,
      tournament: {
        id: tournament.id,
        name: tournament.name,
        status: tournament.status,
        lastPolledAt: tournament.lastPolledAt,
      },
      lastPolled: tournament.lastPolledAt?.toISOString() ?? null,
    });
  } catch (error) {
    console.error("[Leaderboard API] Error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
