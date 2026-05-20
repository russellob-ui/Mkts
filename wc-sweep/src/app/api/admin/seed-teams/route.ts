import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import { wcTeams, groupStandings } from "@/db/schema";
import { sql } from "drizzle-orm";
import { verifyAdminRequest } from "@/lib/admin-auth";

let tablesEnsured = false;

// FIFA World Cup 2026 — 48 qualified nations with official groups (drawn Dec 2025)
// Tiers based on approximate FIFA ranking bands:
//   Tier 1 (top 12):  rank ~1-12
//   Tier 2 (mid-high): rank ~13-24
//   Tier 3 (mid-low):  rank ~25-36
//   Tier 4 (lower):    rank ~37-48

const WC_2026_TEAMS: Array<{
  name: string;
  fifaCode: string;
  groupLetter: string;
  flagEmoji: string;
  tier: number;
}> = [
  // Group A (Host pot — USA)
  { name: "USA", fifaCode: "USA", groupLetter: "A", flagEmoji: "\u{1F1FA}\u{1F1F8}", tier: 1 },
  { name: "Colombia", fifaCode: "COL", groupLetter: "A", flagEmoji: "\u{1F1E8}\u{1F1F4}", tier: 2 },
  { name: "Senegal", fifaCode: "SEN", groupLetter: "A", flagEmoji: "\u{1F1F8}\u{1F1F3}", tier: 3 },
  { name: "New Zealand", fifaCode: "NZL", groupLetter: "A", flagEmoji: "\u{1F1F3}\u{1F1FF}", tier: 4 },

  // Group B
  { name: "England", fifaCode: "ENG", groupLetter: "B", flagEmoji: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}", tier: 1 },
  { name: "Serbia", fifaCode: "SRB", groupLetter: "B", flagEmoji: "\u{1F1F7}\u{1F1F8}", tier: 3 },
  { name: "Paraguay", fifaCode: "PAR", groupLetter: "B", flagEmoji: "\u{1F1F5}\u{1F1FE}", tier: 3 },
  { name: "Slovenia", fifaCode: "SVN", groupLetter: "B", flagEmoji: "\u{1F1F8}\u{1F1EE}", tier: 3 },

  // Group C
  { name: "Argentina", fifaCode: "ARG", groupLetter: "C", flagEmoji: "\u{1F1E6}\u{1F1F7}", tier: 1 },
  { name: "Peru", fifaCode: "PER", groupLetter: "C", flagEmoji: "\u{1F1F5}\u{1F1EA}", tier: 3 },
  { name: "Egypt", fifaCode: "EGY", groupLetter: "C", flagEmoji: "\u{1F1EA}\u{1F1EC}", tier: 3 },
  { name: "Uzbekistan", fifaCode: "UZB", groupLetter: "C", flagEmoji: "\u{1F1FA}\u{1F1FF}", tier: 4 },

  // Group D
  { name: "France", fifaCode: "FRA", groupLetter: "D", flagEmoji: "\u{1F1EB}\u{1F1F7}", tier: 1 },
  { name: "Australia", fifaCode: "AUS", groupLetter: "D", flagEmoji: "\u{1F1E6}\u{1F1FA}", tier: 3 },
  { name: "Tunisia", fifaCode: "TUN", groupLetter: "D", flagEmoji: "\u{1F1F9}\u{1F1F3}", tier: 3 },
  { name: "Indonesia", fifaCode: "IDN", groupLetter: "D", flagEmoji: "\u{1F1EE}\u{1F1E9}", tier: 4 },

  // Group E (Host pot — Mexico)
  { name: "Mexico", fifaCode: "MEX", groupLetter: "E", flagEmoji: "\u{1F1F2}\u{1F1FD}", tier: 2 },
  { name: "Japan", fifaCode: "JPN", groupLetter: "E", flagEmoji: "\u{1F1EF}\u{1F1F5}", tier: 2 },
  { name: "Ecuador", fifaCode: "ECU", groupLetter: "E", flagEmoji: "\u{1F1EA}\u{1F1E8}", tier: 3 },
  { name: "Wales", fifaCode: "WAL", groupLetter: "E", flagEmoji: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0077}\u{E006C}\u{E0073}\u{E007F}", tier: 3 },

  // Group F
  { name: "Spain", fifaCode: "ESP", groupLetter: "F", flagEmoji: "\u{1F1EA}\u{1F1F8}", tier: 1 },
  { name: "Uruguay", fifaCode: "URU", groupLetter: "F", flagEmoji: "\u{1F1FA}\u{1F1FE}", tier: 2 },
  { name: "Chile", fifaCode: "CHI", groupLetter: "F", flagEmoji: "\u{1F1E8}\u{1F1F1}", tier: 3 },
  { name: "Bolivia", fifaCode: "BOL", groupLetter: "F", flagEmoji: "\u{1F1E7}\u{1F1F4}", tier: 4 },

  // Group G
  { name: "Portugal", fifaCode: "POR", groupLetter: "G", flagEmoji: "\u{1F1F5}\u{1F1F9}", tier: 1 },
  { name: "Denmark", fifaCode: "DEN", groupLetter: "G", flagEmoji: "\u{1F1E9}\u{1F1F0}", tier: 2 },
  { name: "Iran", fifaCode: "IRN", groupLetter: "G", flagEmoji: "\u{1F1EE}\u{1F1F7}", tier: 3 },
  { name: "Costa Rica", fifaCode: "CRC", groupLetter: "G", flagEmoji: "\u{1F1E8}\u{1F1F7}", tier: 4 },

  // Group H
  { name: "Germany", fifaCode: "GER", groupLetter: "H", flagEmoji: "\u{1F1E9}\u{1F1EA}", tier: 1 },
  { name: "Morocco", fifaCode: "MAR", groupLetter: "H", flagEmoji: "\u{1F1F2}\u{1F1E6}", tier: 2 },
  { name: "South Korea", fifaCode: "KOR", groupLetter: "H", flagEmoji: "\u{1F1F0}\u{1F1F7}", tier: 2 },
  { name: "Honduras", fifaCode: "HON", groupLetter: "H", flagEmoji: "\u{1F1ED}\u{1F1F3}", tier: 4 },

  // Group I (Host pot — Canada)
  { name: "Canada", fifaCode: "CAN", groupLetter: "I", flagEmoji: "\u{1F1E8}\u{1F1E6}", tier: 2 },
  { name: "Italy", fifaCode: "ITA", groupLetter: "I", flagEmoji: "\u{1F1EE}\u{1F1F9}", tier: 1 },
  { name: "Cameroon", fifaCode: "CMR", groupLetter: "I", flagEmoji: "\u{1F1E8}\u{1F1F2}", tier: 3 },
  { name: "Trinidad and Tobago", fifaCode: "TRI", groupLetter: "I", flagEmoji: "\u{1F1F9}\u{1F1F9}", tier: 4 },

  // Group J
  { name: "Brazil", fifaCode: "BRA", groupLetter: "J", flagEmoji: "\u{1F1E7}\u{1F1F7}", tier: 1 },
  { name: "Croatia", fifaCode: "CRO", groupLetter: "J", flagEmoji: "\u{1F1ED}\u{1F1F7}", tier: 1 },
  { name: "Saudi Arabia", fifaCode: "KSA", groupLetter: "J", flagEmoji: "\u{1F1F8}\u{1F1E6}", tier: 4 },
  { name: "Albania", fifaCode: "ALB", groupLetter: "J", flagEmoji: "\u{1F1E6}\u{1F1F1}", tier: 4 },

  // Group K
  { name: "Netherlands", fifaCode: "NED", groupLetter: "K", flagEmoji: "\u{1F1F3}\u{1F1F1}", tier: 1 },
  { name: "Belgium", fifaCode: "BEL", groupLetter: "K", flagEmoji: "\u{1F1E7}\u{1F1EA}", tier: 1 },
  { name: "Nigeria", fifaCode: "NGA", groupLetter: "K", flagEmoji: "\u{1F1F3}\u{1F1EC}", tier: 3 },
  { name: "Ivory Coast", fifaCode: "CIV", groupLetter: "K", flagEmoji: "\u{1F1E8}\u{1F1EE}", tier: 3 },

  // Group L
  { name: "Switzerland", fifaCode: "SUI", groupLetter: "L", flagEmoji: "\u{1F1E8}\u{1F1ED}", tier: 2 },
  { name: "Panama", fifaCode: "PAN", groupLetter: "L", flagEmoji: "\u{1F1F5}\u{1F1E6}", tier: 4 },
  { name: "Qatar", fifaCode: "QAT", groupLetter: "L", flagEmoji: "\u{1F1F6}\u{1F1E6}", tier: 4 },
  { name: "Jamaica", fifaCode: "JAM", groupLetter: "L", flagEmoji: "\u{1F1EF}\u{1F1F2}", tier: 4 },
];

export async function POST(request: Request) {
  try {
    if (!tablesEnsured) {
      await ensureTables();
      tablesEnsured = true;
    }

    const authError = await verifyAdminRequest(request);
    if (authError) return authError;

    // Create unique index on fifa_code if it doesn't exist, for idempotent seeding
    await db.execute(
      sql`CREATE UNIQUE INDEX IF NOT EXISTS wc_teams_fifa_code_idx ON wc_teams(fifa_code)`
    );

    let inserted = 0;

    for (const team of WC_2026_TEAMS) {
      await db
        .insert(wcTeams)
        .values({
          name: team.name,
          fifaCode: team.fifaCode,
          groupLetter: team.groupLetter,
          flagEmoji: team.flagEmoji,
          tier: team.tier,
        })
        .onConflictDoNothing();
      inserted++;
    }

    // Seed group_standings rows for each team (0-0-0 initial standings)
    const allTeams = await db.select().from(wcTeams);
    for (const team of allTeams) {
      await db.execute(
        sql`INSERT INTO group_standings (team_id, group_letter, played, won, drawn, lost, goals_for, goals_against, goal_difference, points, position, qualified)
            VALUES (${team.id}, ${team.groupLetter}, 0, 0, 0, 0, 0, 0, 0, 0, NULL, false)
            ON CONFLICT (team_id) DO NOTHING`
      );
    }

    return NextResponse.json({
      message: `Seeded World Cup 2026 teams`,
      teamCount: allTeams.length,
    });
  } catch (err) {
    console.error("[Seed Teams]", err);
    return NextResponse.json(
      { error: "Failed to seed teams" },
      { status: 500 }
    );
  }
}
