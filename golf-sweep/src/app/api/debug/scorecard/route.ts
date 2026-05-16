import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import { tournaments, picks, golfers } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  getLeaderboard,
  parseLeaderboardPlayers,
  normalizeGolferName,
  getGolfSeasonYear,
} from "@/lib/slashgolf";

export const dynamic = "force-dynamic";

/**
 * GET /api/debug/scorecard?golferName=Scheffler
 *
 * Fetches a raw scorecard from Slash Golf for debugging.
 * Shows the exact API response so we can see the data structure.
 */
export async function GET(request: NextRequest) {
  try {
    await ensureTables();
    const golferName = request.nextUrl.searchParams.get("golferName") ?? "Scheffler";

    const [tournament] = await db.select().from(tournaments).where(eq(tournaments.status, "live"));
    if (!tournament?.slashTournId || !process.env.RAPIDAPI_KEY) {
      return NextResponse.json({ error: "No live tournament or API key" });
    }

    const year = getGolfSeasonYear();
    const BASE_URL = "https://live-golf-data.p.rapidapi.com";
    const headers: Record<string, string> = {
      "x-rapidapi-host": "live-golf-data.p.rapidapi.com",
      "x-rapidapi-key": process.env.RAPIDAPI_KEY,
    };

    // Find the player ID from the leaderboard
    const lbRaw = await getLeaderboard(tournament.slashTournId, year);
    const lbPlayers = parseLeaderboardPlayers(lbRaw);
    const normalized = normalizeGolferName(golferName);
    const match = lbPlayers.find((p) => {
      const n = normalizeGolferName(p.name);
      return n.includes(normalized) || normalized.includes(n);
    });

    if (!match) {
      return NextResponse.json({ error: `Golfer "${golferName}" not found in leaderboard`, available: lbPlayers.slice(0, 10).map((p) => p.name) });
    }

    // Fetch raw scorecard
    const scUrl = `${BASE_URL}/scorecard?orgId=1&tournId=${tournament.slashTournId}&year=${year}&playerId=${match.playerId}`;
    const scRes = await fetch(scUrl, { headers, cache: "no-store" });
    const scRaw = await scRes.json();

    return NextResponse.json({
      golfer: match.name,
      playerId: match.playerId,
      tournId: tournament.slashTournId,
      year,
      url: scUrl,
      httpStatus: scRes.status,
      responseKeys: typeof scRaw === "object" && scRaw ? Object.keys(scRaw) : "not an object",
      rawResponse: scRaw,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
