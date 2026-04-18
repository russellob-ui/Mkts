import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import { tournaments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getLeaderboard, getGolfSeasonYear } from "@/lib/slashgolf";

export const dynamic = "force-dynamic";

/**
 * DEBUG: dumps the raw Slash Golf leaderboard response for the live tournament
 * so we can see the exact field names the API is returning (independent of
 * whatever the published OpenAPI spec claims).
 *
 * Hit: /api/debug/slashgolf
 */
export async function GET() {
  try {
    await ensureTables();

    const liveTournaments = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.status, "live"));
    const tournament = liveTournaments[0];

    if (!tournament || !tournament.slashTournId) {
      return NextResponse.json({ error: "No live tournament" });
    }
    if (!process.env.RAPIDAPI_KEY) {
      return NextResponse.json({ error: "No API key" });
    }

    const lbRaw = await getLeaderboard(tournament.slashTournId, getGolfSeasonYear());
    const lbRoot = lbRaw as Record<string, unknown>;

    // Top-level info
    const topLevelKeys = Object.keys(lbRoot);
    const topLevelRoundId = lbRoot.roundId;
    const topLevelRoundStatus = lbRoot.roundStatus;

    // Find the player array
    let arrayKey: string | null = null;
    let rows: unknown[] = [];
    for (const k of topLevelKeys) {
      if (Array.isArray(lbRoot[k])) {
        arrayKey = k;
        rows = lbRoot[k] as unknown[];
        break;
      }
    }

    // First 3 raw players — full object, no parsing
    const firstThree = rows.slice(0, 3);

    // Also try to find a player with status=complete (finished the round)
    // so we can see what a completed round object looks like
    let finishedPlayer: unknown = null;
    for (const r of rows) {
      const obj = r as Record<string, unknown>;
      const status = String(obj.status ?? "").toLowerCase();
      if (status === "complete" || obj.roundComplete === true) {
        finishedPlayer = obj;
        break;
      }
    }

    return NextResponse.json({
      tournament: tournament.name,
      slashTournId: tournament.slashTournId,
      topLevel: {
        keys: topLevelKeys,
        roundId: topLevelRoundId,
        roundStatus: topLevelRoundStatus,
        playerArrayKey: arrayKey,
        playerCount: rows.length,
      },
      firstThreePlayers: firstThree,
      firstPlayerAllKeys: firstThree[0]
        ? Object.keys(firstThree[0] as object)
        : [],
      firstPlayerRoundsType: firstThree[0]
        ? typeof (firstThree[0] as Record<string, unknown>).rounds
        : null,
      firstPlayerRoundsIsArray: firstThree[0]
        ? Array.isArray((firstThree[0] as Record<string, unknown>).rounds)
        : null,
      firstFinishedPlayer: finishedPlayer,
    });
  } catch (error) {
    console.error("[Debug Slash Golf] Error:", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
