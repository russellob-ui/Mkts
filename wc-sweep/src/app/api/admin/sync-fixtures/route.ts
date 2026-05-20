import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import { matches, wcTeams } from "@/db/schema";
import { sql } from "drizzle-orm";
import { getFixturesByLeague, mapStatus } from "@/lib/api-football";

let tablesEnsured = false;

export async function POST() {
  try {
    if (!tablesEnsured) {
      await ensureTables();
      tablesEnsured = true;
    }

    // Fetch all WC 2026 fixtures from API-Football
    const fixtures = await getFixturesByLeague(2026);

    if (fixtures.length === 0) {
      return NextResponse.json(
        { error: "No fixtures returned from API" },
        { status: 502 }
      );
    }

    // Load all teams so we can map apiTeamId → our DB id
    const allTeams = await db.select().from(wcTeams);
    type Team = (typeof allTeams)[number];
    const teamByApiId = new Map<number, Team>(
      allTeams
        .filter((t): t is Team & { apiTeamId: number } => t.apiTeamId != null)
        .map((t) => [t.apiTeamId, t])
    );

    let synced = 0;
    let skipped = 0;
    const unmappedTeams: string[] = [];

    for (const f of fixtures) {
      const homeTeam = teamByApiId.get(f.teams.home.id);
      const awayTeam = teamByApiId.get(f.teams.away.id);

      if (!homeTeam || !awayTeam) {
        skipped++;
        if (!homeTeam && !unmappedTeams.includes(f.teams.home.name)) {
          unmappedTeams.push(f.teams.home.name);
        }
        if (!awayTeam && !unmappedTeams.includes(f.teams.away.name)) {
          unmappedTeams.push(f.teams.away.name);
        }
        continue;
      }

      // Parse stage + group from API round string
      // Examples: "Group A - 1" → stage="GS1", group="A"
      //           "Round of 32" → stage="R32", group=null
      //           "Round of 16" → stage="R16", group=null
      //           "Quarter-finals" → stage="QF", group=null
      //           "Semi-finals" → stage="SF", group=null
      //           "3rd Place" → stage="3P", group=null
      //           "Final" → stage="F", group=null
      const { stage, groupLetter } = parseRound(f.league.round);
      const status = mapStatus(f.fixture.status.short);

      await db.execute(sql`
        INSERT INTO matches (
          api_fixture_id, home_team_id, away_team_id, stage, group_letter,
          kickoff, status, home_score, away_score, home_penalties, away_penalties,
          minute, venue, city
        )
        VALUES (
          ${f.fixture.id},
          ${homeTeam.id},
          ${awayTeam.id},
          ${stage},
          ${groupLetter},
          ${f.fixture.date},
          ${status},
          ${f.goals.home ?? null},
          ${f.goals.away ?? null},
          ${f.score.penalty.home ?? null},
          ${f.score.penalty.away ?? null},
          ${f.fixture.status.elapsed ?? null},
          ${f.fixture.venue?.name ?? null},
          ${f.fixture.venue?.city ?? null}
        )
        ON CONFLICT (api_fixture_id) DO UPDATE SET
          home_team_id = EXCLUDED.home_team_id,
          away_team_id = EXCLUDED.away_team_id,
          stage = EXCLUDED.stage,
          group_letter = EXCLUDED.group_letter,
          kickoff = EXCLUDED.kickoff,
          status = EXCLUDED.status,
          home_score = EXCLUDED.home_score,
          away_score = EXCLUDED.away_score,
          home_penalties = EXCLUDED.home_penalties,
          away_penalties = EXCLUDED.away_penalties,
          minute = EXCLUDED.minute,
          venue = EXCLUDED.venue,
          city = EXCLUDED.city
      `);

      synced++;
    }

    return NextResponse.json({
      synced,
      skipped,
      totalFixtures: fixtures.length,
      unmappedTeams: unmappedTeams.length > 0 ? unmappedTeams : undefined,
    });
  } catch (err) {
    console.error("[SyncFixtures]", err);
    return NextResponse.json(
      {
        error: "Failed to sync fixtures",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

// ---- Parse API-Football round string into our stage/groupLetter ----

function parseRound(round: string): {
  stage: string;
  groupLetter: string | null;
} {
  // "Group A - 1" → GS1, A
  // "Group B - 2" → GS2, B
  // "Group L - 3" → GS3, L
  const groupMatch = round.match(/^Group\s+([A-L])\s*-\s*(\d+)$/i);
  if (groupMatch) {
    return {
      stage: `GS${groupMatch[2]}`,
      groupLetter: groupMatch[1].toUpperCase(),
    };
  }

  // Knockout rounds
  const lower = round.toLowerCase();
  if (lower.includes("round of 32")) return { stage: "R32", groupLetter: null };
  if (lower.includes("round of 16")) return { stage: "R16", groupLetter: null };
  if (lower.includes("quarter")) return { stage: "QF", groupLetter: null };
  if (lower.includes("semi")) return { stage: "SF", groupLetter: null };
  if (lower.includes("3rd") || lower.includes("third"))
    return { stage: "3P", groupLetter: null };
  if (lower.includes("final") && !lower.includes("semi") && !lower.includes("quarter"))
    return { stage: "F", groupLetter: null };

  // Fallback
  return { stage: round, groupLetter: null };
}
