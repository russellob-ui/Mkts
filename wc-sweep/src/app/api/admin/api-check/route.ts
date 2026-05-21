import { NextResponse } from "next/server";
import { getFixturesByLeague, getTeams, getStandings } from "@/lib/api-football";

export const dynamic = "force-dynamic";

export async function GET() {
  const results: Record<string, unknown> = {};

  try {
    const teams = await getTeams(2026);
    results.teams = { count: teams.length, sample: teams.slice(0, 3) };
  } catch (err) {
    results.teams = { error: String(err) };
  }

  try {
    const fixtures = await getFixturesByLeague(2026);
    results.fixtures = { count: fixtures.length, sample: fixtures.slice(0, 2) };
  } catch (err) {
    results.fixtures = { error: String(err) };
  }

  try {
    const standings = await getStandings(2026);
    results.standings = { groupCount: standings.length, sample: standings[0]?.slice(0, 2) };
  } catch (err) {
    results.standings = { error: String(err) };
  }

  // Also try 2025 season in case they indexed it differently
  try {
    const fixtures2025 = await getFixturesByLeague(2025);
    results.fixtures2025 = { count: fixtures2025.length };
  } catch (err) {
    results.fixtures2025 = { error: String(err) };
  }

  return NextResponse.json(results);
}
