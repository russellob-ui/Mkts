import { NextRequest, NextResponse } from "next/server";
import { getFixturesByDate } from "@/lib/football-api";

export const dynamic = "force-dynamic";

/**
 * GET /api/matchday/fixtures?date=2026-04-19&season=2025&league=39
 *
 * Searches API-Football for fixtures on a given date.
 * Default: Premier League (39), season 2024 (API uses start year of season).
 */
export async function GET(request: NextRequest) {
  try {
    const date = request.nextUrl.searchParams.get("date");
    const season = Number(
      request.nextUrl.searchParams.get("season") ?? "2025"
    );
    const league = Number(
      request.nextUrl.searchParams.get("league") ?? "39"
    );

    if (!date) {
      return NextResponse.json(
        { error: "date query param required (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    const fixtures = await getFixturesByDate(date, season, league);

    return NextResponse.json({
      date,
      season,
      league,
      count: fixtures.length,
      fixtures: fixtures.map((f) => ({
        fixtureId: f.fixture.id,
        date: f.fixture.date,
        venue: f.fixture.venue?.name ?? null,
        city: f.fixture.venue?.city ?? null,
        status: f.fixture.status.long,
        homeTeam: f.teams.home.name,
        homeLogo: f.teams.home.logo,
        awayTeam: f.teams.away.name,
        awayLogo: f.teams.away.logo,
        homeScore: f.goals.home,
        awayScore: f.goals.away,
        round: f.league.round,
      })),
    });
  } catch (error) {
    console.error("[Matchday Fixtures]", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
