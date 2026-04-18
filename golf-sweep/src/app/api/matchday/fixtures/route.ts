import { NextRequest, NextResponse } from "next/server";
import { getTeamNextMatches } from "@/lib/football-api";

export const dynamic = "force-dynamic";

/**
 * GET /api/matchday/fixtures?teamId=38
 *
 * Gets upcoming matches for a team from Sofascore.
 * Default: Brentford (38). Fulham = 43.
 * Returns the next few fixtures so the admin can pick one.
 */
export async function GET(request: NextRequest) {
  try {
    const teamId = Number(
      request.nextUrl.searchParams.get("teamId") ?? "38"
    );

    const events = await getTeamNextMatches(teamId, 0);

    return NextResponse.json({
      teamId,
      count: events.length,
      fixtures: events.map((e) => ({
        fixtureId: e.id,
        date: new Date(e.startTimestamp * 1000).toISOString(),
        venue: e.venue?.stadium?.name ?? null,
        city: e.venue?.city?.name ?? null,
        status: e.status.description,
        homeTeam: e.homeTeam.name,
        awayTeam: e.awayTeam.name,
        homeScore: e.homeScore?.current ?? null,
        awayScore: e.awayScore?.current ?? null,
        round: e.roundInfo?.round ?? null,
        tournament: e.tournament?.name ?? null,
      })),
    });
  } catch (error) {
    console.error("[Matchday Fixtures]", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
