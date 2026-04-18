import { NextRequest, NextResponse } from "next/server";
import { getPremierLeagueEvents } from "@/lib/football-api";

export const dynamic = "force-dynamic";

/**
 * GET /api/matchday/fixtures?date=2026-04-19
 *
 * Searches Sofascore for Premier League fixtures on a given date.
 */
export async function GET(request: NextRequest) {
  try {
    const date = request.nextUrl.searchParams.get("date");
    if (!date) {
      return NextResponse.json(
        { error: "date query param required (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    const events = await getPremierLeagueEvents(date);

    return NextResponse.json({
      date,
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
      })),
    });
  } catch (error) {
    console.error("[Matchday Fixtures]", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
