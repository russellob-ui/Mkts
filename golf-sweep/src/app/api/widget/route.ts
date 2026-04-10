import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import {
  tournaments,
  picks,
  players,
  golfers,
  scoreSnapshots,
} from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET /api/widget
 *
 * Compact leaderboard payload optimised for home-screen widgets.
 * Reads from score_snapshots only — does NOT trigger a fresh poll
 * (the main /api/leaderboard endpoint handles polling on human visits).
 *
 * Response shape:
 *   {
 *     tournament: "Masters Tournament",
 *     currentRound: 2,
 *     lastPolled: "2026-04-10T20:00:00Z",
 *     entries: [
 *       { pos, player, avatar, golfer, flag, tot, rd, thru }
 *     ]
 *   }
 */
export async function GET() {
  try {
    await ensureTables();

    const liveTournaments = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.status, "live"));
    const tournament = liveTournaments[0];
    if (!tournament) {
      return NextResponse.json({
        tournament: null,
        entries: [],
      });
    }

    const tournamentPicks = await db
      .select()
      .from(picks)
      .where(eq(picks.tournamentId, tournament.id));
    const allPlayers = await db.select().from(players);
    const allGolfers = await db.select().from(golfers);

    const entries = [];
    for (const pick of tournamentPicks) {
      const player = allPlayers.find((p) => p.id === pick.playerId);
      const golfer = allGolfers.find((g) => g.id === pick.golferId);
      if (!player || !golfer) continue;

      const [latest] = await db
        .select()
        .from(scoreSnapshots)
        .where(
          and(
            eq(scoreSnapshots.golferId, golfer.id),
            eq(scoreSnapshots.tournamentId, tournament.id)
          )
        )
        .orderBy(desc(scoreSnapshots.capturedAt))
        .limit(1);

      entries.push({
        pos: latest?.position ?? null,
        posNum: latest?.positionNumeric ?? 999,
        player: player.name,
        avatar: player.avatarEmoji ?? "",
        color: player.color ?? null,
        golfer: golfer.name,
        flag: golfer.flagEmoji ?? "",
        tot: latest?.totalScoreToPar ?? null,
        rd: latest?.roundScoreToPar ?? null,
        thru: latest?.thru ?? null,
      });
    }

    entries.sort((a, b) => a.posNum - b.posNum);

    return NextResponse.json(
      {
        tournament: tournament.name,
        currentRound: null,
        lastPolled: tournament.lastPolledAt?.toISOString() ?? null,
        entries: entries.map(({ posNum: _omit, ...rest }) => {
          void _omit;
          return rest;
        }),
      },
      {
        headers: {
          // Let iOS / Scriptable cache for 2 minutes
          "Cache-Control": "public, max-age=120, s-maxage=120",
        },
      }
    );
  } catch (error) {
    console.error("[Widget API] Error:", error);
    return NextResponse.json(
      { error: String(error), entries: [] },
      { status: 500 }
    );
  }
}
