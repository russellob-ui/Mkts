import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import { matches, wcTeams } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { getFixturesByLeague, getTeams, mapStatus, type ApiTeam } from "@/lib/api-football";
import { verifyAdminRequest } from "@/lib/admin-auth";

let tablesEnsured = false;

export async function POST(request: Request) {
  try {
    if (!tablesEnsured) {
      await ensureTables();
      tablesEnsured = true;
    }

    const authError = await verifyAdminRequest(request);
    if (authError) return authError;

    // Ensure every WC team row has an apiTeamId so the fixture team IDs
    // returned by API-Football can be mapped to our DB rows. Without this,
    // every fixture gets skipped as "unmapped".
    const linkResult = await linkApiTeamIds();

    // Fetch all WC 2026 fixtures from API-Football
    const fixtures = await getFixturesByLeague(2026);

    if (fixtures.length === 0) {
      return NextResponse.json(
        { error: "No fixtures returned from API", linked: linkResult },
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

      // Parse stage + group from API round string.
      // For "Group Stage - N" the round itself doesn't tell us which group
      // (A–L), so fall back to the home team's groupLetter (seeded from
      // /standings during seed-teams).
      const parsed = parseRound(f.league.round);
      const stage = parsed.stage;
      const groupLetter =
        parsed.groupLetter ?? (stage.startsWith("GS") ? homeTeam.groupLetter || null : null);
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

    const parts = [
      `Synced ${synced}/${fixtures.length} fixtures`,
      linkResult.linked > 0 ? `linked ${linkResult.linked} team(s) to API IDs` : null,
      skipped > 0 ? `skipped ${skipped}` : null,
      linkResult.unmatched.length > 0
        ? `unmatched teams: ${linkResult.unmatched.join(", ")}`
        : null,
    ].filter(Boolean);

    return NextResponse.json({
      message: parts.join(" — "),
      synced,
      skipped,
      totalFixtures: fixtures.length,
      unmappedTeams: unmappedTeams.length > 0 ? unmappedTeams : undefined,
      linked: linkResult,
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
  // "Group A - 1" → GS1, A   (explicit per-group format, older seasons)
  // "Group B - 2" → GS2, B
  // "Group L - 3" → GS3, L
  const groupMatch = round.match(/^Group\s+([A-L])\s*-\s*(\d+)$/i);
  if (groupMatch) {
    return {
      stage: `GS${groupMatch[2]}`,
      groupLetter: groupMatch[1].toUpperCase(),
    };
  }

  // "Group Stage - N" → GSN, group unknown from round string
  // (caller will fall back to home team's groupLetter)
  const matchdayMatch = round.match(/^Group\s+Stage\s*-\s*(\d+)$/i);
  if (matchdayMatch) {
    return { stage: `GS${matchdayMatch[1]}`, groupLetter: null };
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

// ---- Populate wc_teams.api_team_id by matching API-Football team names ----

// API-Football uses slightly different names than our seed data. Map our
// seeded name (lowercase) → set of acceptable API-Football names (lowercase).
const NAME_ALIASES: Record<string, string[]> = {
  usa: ["united states", "usa"],
  "south korea": ["korea republic", "south korea"],
  "ivory coast": ["côte d'ivoire", "cote d'ivoire", "ivory coast"],
  iran: ["iran", "ir iran", "iran islamic republic"],
  "trinidad and tobago": ["trinidad and tobago", "trinidad & tobago"],
  "saudi arabia": ["saudi arabia"],
  "costa rica": ["costa rica"],
  "new zealand": ["new zealand"],
};

function normaliseName(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

async function linkApiTeamIds(): Promise<{
  linked: number;
  alreadyLinked: number;
  unmatched: string[];
}> {
  const teamsInDb = await db.select().from(wcTeams);
  const needsLinking = teamsInDb.filter((t) => t.apiTeamId == null);

  if (needsLinking.length === 0) {
    return { linked: 0, alreadyLinked: teamsInDb.length, unmatched: [] };
  }

  let apiTeams: ApiTeam[];
  try {
    apiTeams = await getTeams(2026);
  } catch (err) {
    throw new Error(
      `Could not fetch API-Football teams for linking: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // Build lookup: every alias + the canonical API name → apiTeamId
  const apiByName = new Map<string, number>();
  for (const t of apiTeams) {
    apiByName.set(normaliseName(t.team.name), t.team.id);
  }

  let linked = 0;
  const unmatched: string[] = [];

  for (const team of needsLinking) {
    const candidates = [
      normaliseName(team.name),
      ...(NAME_ALIASES[normaliseName(team.name)] ?? []),
    ];

    let apiId: number | undefined;
    for (const c of candidates) {
      const hit = apiByName.get(c);
      if (hit != null) {
        apiId = hit;
        break;
      }
    }

    if (apiId == null) {
      unmatched.push(team.name);
      continue;
    }

    await db
      .update(wcTeams)
      .set({ apiTeamId: apiId })
      .where(eq(wcTeams.id, team.id));
    linked++;
  }

  return {
    linked,
    alreadyLinked: teamsInDb.length - needsLinking.length,
    unmatched,
  };
}
