import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import { wcTeams } from "@/db/schema";
import { sql } from "drizzle-orm";
import { verifyAdminRequest } from "@/lib/admin-auth";
import { getTeams, getStandings, type ApiTeam, type ApiStandingRow } from "@/lib/api-football";

let tablesEnsured = false;

// Flag emoji per API-Football team name. Keys must match the exact names
// API-Football returns from /teams?league=1&season=2026.
const FLAGS: Record<string, string> = {
  Algeria: "\u{1F1E9}\u{1F1FF}",
  Argentina: "\u{1F1E6}\u{1F1F7}",
  Australia: "\u{1F1E6}\u{1F1FA}",
  Austria: "\u{1F1E6}\u{1F1F9}",
  Belgium: "\u{1F1E7}\u{1F1EA}",
  "Bosnia & Herzegovina": "\u{1F1E7}\u{1F1E6}",
  Brazil: "\u{1F1E7}\u{1F1F7}",
  Canada: "\u{1F1E8}\u{1F1E6}",
  "Cape Verde Islands": "\u{1F1E8}\u{1F1FB}",
  Colombia: "\u{1F1E8}\u{1F1F4}",
  "Congo DR": "\u{1F1E8}\u{1F1E9}",
  Croatia: "\u{1F1ED}\u{1F1F7}",
  "Curaçao": "\u{1F1E8}\u{1F1FC}",
  "Czech Republic": "\u{1F1E8}\u{1F1FF}",
  Ecuador: "\u{1F1EA}\u{1F1E8}",
  Egypt: "\u{1F1EA}\u{1F1EC}",
  England: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}",
  France: "\u{1F1EB}\u{1F1F7}",
  Germany: "\u{1F1E9}\u{1F1EA}",
  Ghana: "\u{1F1EC}\u{1F1ED}",
  Haiti: "\u{1F1ED}\u{1F1F9}",
  Iran: "\u{1F1EE}\u{1F1F7}",
  Iraq: "\u{1F1EE}\u{1F1F6}",
  "Ivory Coast": "\u{1F1E8}\u{1F1EE}",
  Japan: "\u{1F1EF}\u{1F1F5}",
  Jordan: "\u{1F1EF}\u{1F1F4}",
  Mexico: "\u{1F1F2}\u{1F1FD}",
  Morocco: "\u{1F1F2}\u{1F1E6}",
  Netherlands: "\u{1F1F3}\u{1F1F1}",
  "New Zealand": "\u{1F1F3}\u{1F1FF}",
  Norway: "\u{1F1F3}\u{1F1F4}",
  Panama: "\u{1F1F5}\u{1F1E6}",
  Paraguay: "\u{1F1F5}\u{1F1FE}",
  Portugal: "\u{1F1F5}\u{1F1F9}",
  Qatar: "\u{1F1F6}\u{1F1E6}",
  "Saudi Arabia": "\u{1F1F8}\u{1F1E6}",
  Scotland: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}",
  Senegal: "\u{1F1F8}\u{1F1F3}",
  "South Africa": "\u{1F1FF}\u{1F1E6}",
  "South Korea": "\u{1F1F0}\u{1F1F7}",
  Spain: "\u{1F1EA}\u{1F1F8}",
  Sweden: "\u{1F1F8}\u{1F1EA}",
  Switzerland: "\u{1F1E8}\u{1F1ED}",
  Tunisia: "\u{1F1F9}\u{1F1F3}",
  "Türkiye": "\u{1F1F9}\u{1F1F7}",
  Uruguay: "\u{1F1FA}\u{1F1FE}",
  USA: "\u{1F1FA}\u{1F1F8}",
  Uzbekistan: "\u{1F1FA}\u{1F1FF}",
};

// Seeding tier by team name. 1 = elite, 4 = lowest.
const TIERS: Record<string, number> = {
  // Tier 1 — favourites
  Argentina: 1, France: 1, Brazil: 1, England: 1, Spain: 1,
  Portugal: 1, Germany: 1, Netherlands: 1, Belgium: 1, Croatia: 1,
  // Tier 2 — strong
  Uruguay: 2, Switzerland: 2, Colombia: 2, Mexico: 2, USA: 2,
  Senegal: 2, Morocco: 2, Japan: 2, Iran: 2, Sweden: 2, Norway: 2,
  // Tier 3 — mid
  Australia: 3, Ecuador: 3, "South Korea": 3, "Türkiye": 3, Egypt: 3,
  Tunisia: 3, Algeria: 3, "Ivory Coast": 3, Scotland: 3,
  "Czech Republic": 3, Austria: 3, Paraguay: 3, Uzbekistan: 3,
  "Bosnia & Herzegovina": 3,
  // Tier 4 — lowest (default)
  Canada: 4, Qatar: 4, "Saudi Arabia": 4, "New Zealand": 4, Panama: 4,
  Jordan: 4, Iraq: 4, "South Africa": 4, Ghana: 4,
  "Cape Verde Islands": 4, "Curaçao": 4, Haiti: 4, "Congo DR": 4,
};

function groupLetterFromStanding(g: string | null | undefined): string | null {
  if (!g) return null;
  // API returns strings like "Group A" or "Group L"
  const m = g.match(/Group\s+([A-Z])/i);
  return m ? m[1].toUpperCase() : null;
}

export async function POST(request: Request) {
  try {
    if (!tablesEnsured) {
      await ensureTables();
      tablesEnsured = true;
    }

    const authError = await verifyAdminRequest(request);
    if (authError) return authError;

    // Fetch live source-of-truth data from API-Football
    let teams: ApiTeam[];
    let standings: ApiStandingRow[][];
    try {
      [teams, standings] = await Promise.all([
        getTeams(2026),
        getStandings(2026),
      ]);
    } catch (err) {
      return NextResponse.json(
        {
          error: "Failed to fetch teams/standings from API-Football",
          detail: err instanceof Error ? err.message : String(err),
        },
        { status: 502 }
      );
    }

    if (teams.length === 0) {
      return NextResponse.json(
        { error: "API-Football returned 0 teams for league=1 season=2026" },
        { status: 502 }
      );
    }

    // Map apiTeamId → group letter (from standings)
    const groupByApiId = new Map<number, string>();
    for (const group of standings) {
      for (const row of group) {
        const letter = groupLetterFromStanding(row.group);
        if (letter) groupByApiId.set(row.team.id, letter);
      }
    }

    // Wipe wc_teams and everything that FKs to it (assignments, matches,
    // events, standings, trades, …). Safe because this is a setup step
    // run before the draw. CASCADE handles all referencing tables.
    await db.execute(sql`TRUNCATE TABLE wc_teams RESTART IDENTITY CASCADE`);

    const missingGroup: string[] = [];
    const missingFlag: string[] = [];

    for (const t of teams) {
      const name = t.team.name;
      const fifaCode = t.team.code ?? name.slice(0, 3).toUpperCase();
      const groupLetter = groupByApiId.get(t.team.id);
      const flagEmoji = FLAGS[name] ?? null;
      const tier = TIERS[name] ?? 4;

      if (!groupLetter) missingGroup.push(name);
      if (!flagEmoji) missingFlag.push(name);

      await db.insert(wcTeams).values({
        name,
        fifaCode,
        // Empty string if group not yet known so the NOT NULL constraint
        // is satisfied — admin can re-run after the draw to populate.
        groupLetter: groupLetter ?? "",
        flagEmoji,
        apiTeamId: t.team.id,
        tier,
      });
    }

    // Seed group_standings rows (0-0-0) for teams that have a group
    const allTeams = await db.select().from(wcTeams);
    for (const team of allTeams) {
      if (!team.groupLetter) continue;
      await db.execute(
        sql`INSERT INTO group_standings (team_id, group_letter, played, won, drawn, lost, goals_for, goals_against, goal_difference, points, position, qualified)
            VALUES (${team.id}, ${team.groupLetter}, 0, 0, 0, 0, 0, 0, 0, 0, NULL, false)
            ON CONFLICT (team_id) DO NOTHING`
      );
    }

    const parts = [
      `Seeded ${allTeams.length} teams from API-Football`,
      missingGroup.length > 0
        ? `${missingGroup.length} without group (no standings row): ${missingGroup.join(", ")}`
        : null,
      missingFlag.length > 0
        ? `${missingFlag.length} without flag emoji: ${missingFlag.join(", ")}`
        : null,
    ].filter(Boolean);

    return NextResponse.json({
      message: parts.join(" — "),
      teamCount: allTeams.length,
      missingGroup,
      missingFlag,
    });
  } catch (err) {
    console.error("[Seed Teams]", err);
    return NextResponse.json(
      {
        error: "Failed to seed teams",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
