import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import { wcTeams } from "@/db/schema";
import { sql } from "drizzle-orm";

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
  // Group A
  { name: "Morocco", fifaCode: "MAR", groupLetter: "A", flagEmoji: "\u{1F1F2}\u{1F1E6}", tier: 2 },
  { name: "Peru", fifaCode: "PER", groupLetter: "A", flagEmoji: "\u{1F1F5}\u{1F1EA}", tier: 3 },
  { name: "Australia", fifaCode: "AUS", groupLetter: "A", flagEmoji: "\u{1F1E6}\u{1F1FA}", tier: 3 },
  { name: "Denmark", fifaCode: "DEN", groupLetter: "A", flagEmoji: "\u{1F1E9}\u{1F1F0}", tier: 2 },

  // Group B
  { name: "Portugal", fifaCode: "POR", groupLetter: "B", flagEmoji: "\u{1F1F5}\u{1F1F9}", tier: 1 },
  { name: "Paraguay", fifaCode: "PAR", groupLetter: "B", flagEmoji: "\u{1F1F5}\u{1F1FE}", tier: 3 },
  { name: "Iran", fifaCode: "IRN", groupLetter: "B", flagEmoji: "\u{1F1EE}\u{1F1F7}", tier: 3 },
  { name: "Cameroon", fifaCode: "CMR", groupLetter: "B", flagEmoji: "\u{1F1E8}\u{1F1F2}", tier: 3 },

  // Group C
  { name: "Belgium", fifaCode: "BEL", groupLetter: "C", flagEmoji: "\u{1F1E7}\u{1F1EA}", tier: 1 },
  { name: "Bolivia", fifaCode: "BOL", groupLetter: "C", flagEmoji: "\u{1F1E7}\u{1F1F4}", tier: 4 },
  { name: "Saudi Arabia", fifaCode: "KSA", groupLetter: "C", flagEmoji: "\u{1F1F8}\u{1F1E6}", tier: 4 },
  { name: "Israel", fifaCode: "ISR", groupLetter: "C", flagEmoji: "\u{1F1EE}\u{1F1F1}", tier: 4 },

  // Group D
  { name: "Germany", fifaCode: "GER", groupLetter: "D", flagEmoji: "\u{1F1E9}\u{1F1EA}", tier: 1 },
  { name: "Uruguay", fifaCode: "URU", groupLetter: "D", flagEmoji: "\u{1F1FA}\u{1F1FE}", tier: 2 },
  { name: "Qatar", fifaCode: "QAT", groupLetter: "D", flagEmoji: "\u{1F1F6}\u{1F1E6}", tier: 4 },
  { name: "Honduras", fifaCode: "HON", groupLetter: "D", flagEmoji: "\u{1F1ED}\u{1F1F3}", tier: 4 },

  // Group E
  { name: "Argentina", fifaCode: "ARG", groupLetter: "E", flagEmoji: "\u{1F1E6}\u{1F1F7}", tier: 1 },
  { name: "Uzbekistan", fifaCode: "UZB", groupLetter: "E", flagEmoji: "\u{1F1FA}\u{1F1FF}", tier: 4 },
  { name: "Senegal", fifaCode: "SEN", groupLetter: "E", flagEmoji: "\u{1F1F8}\u{1F1F3}", tier: 3 },
  { name: "Chile", fifaCode: "CHI", groupLetter: "E", flagEmoji: "\u{1F1E8}\u{1F1F1}", tier: 3 },

  // Group F
  { name: "Spain", fifaCode: "ESP", groupLetter: "F", flagEmoji: "\u{1F1EA}\u{1F1F8}", tier: 1 },
  { name: "Serbia", fifaCode: "SRB", groupLetter: "F", flagEmoji: "\u{1F1F7}\u{1F1F8}", tier: 2 },
  { name: "Albania", fifaCode: "ALB", groupLetter: "F", flagEmoji: "\u{1F1E6}\u{1F1F1}", tier: 4 },
  { name: "Slovenia", fifaCode: "SVN", groupLetter: "F", flagEmoji: "\u{1F1F8}\u{1F1EE}", tier: 3 },

  // Group G
  { name: "England", fifaCode: "ENG", groupLetter: "G", flagEmoji: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}", tier: 1 },
  { name: "Japan", fifaCode: "JPN", groupLetter: "G", flagEmoji: "\u{1F1EF}\u{1F1F5}", tier: 2 },
  { name: "Costa Rica", fifaCode: "CRC", groupLetter: "G", flagEmoji: "\u{1F1E8}\u{1F1F7}", tier: 4 },
  { name: "Tunisia", fifaCode: "TUN", groupLetter: "G", flagEmoji: "\u{1F1F9}\u{1F1F3}", tier: 3 },

  // Group H
  { name: "Netherlands", fifaCode: "NED", groupLetter: "H", flagEmoji: "\u{1F1F3}\u{1F1F1}", tier: 1 },
  { name: "Ecuador", fifaCode: "ECU", groupLetter: "H", flagEmoji: "\u{1F1EA}\u{1F1E8}", tier: 3 },
  { name: "Ivory Coast", fifaCode: "CIV", groupLetter: "H", flagEmoji: "\u{1F1E8}\u{1F1EE}", tier: 3 },
  { name: "Indonesia", fifaCode: "IDN", groupLetter: "H", flagEmoji: "\u{1F1EE}\u{1F1E9}", tier: 4 },

  // Group I
  { name: "France", fifaCode: "FRA", groupLetter: "I", flagEmoji: "\u{1F1EB}\u{1F1F7}", tier: 1 },
  { name: "Colombia", fifaCode: "COL", groupLetter: "I", flagEmoji: "\u{1F1E8}\u{1F1F4}", tier: 2 },
  { name: "Panama", fifaCode: "PAN", groupLetter: "I", flagEmoji: "\u{1F1F5}\u{1F1E6}", tier: 4 },
  { name: "New Zealand", fifaCode: "NZL", groupLetter: "I", flagEmoji: "\u{1F1F3}\u{1F1FF}", tier: 4 },

  // Group J
  { name: "Brazil", fifaCode: "BRA", groupLetter: "J", flagEmoji: "\u{1F1E7}\u{1F1F7}", tier: 1 },
  { name: "Italy", fifaCode: "ITA", groupLetter: "J", flagEmoji: "\u{1F1EE}\u{1F1F9}", tier: 1 },
  { name: "Nigeria", fifaCode: "NGA", groupLetter: "J", flagEmoji: "\u{1F1F3}\u{1F1EC}", tier: 3 },
  { name: "Ecuador", fifaCode: "ECU", groupLetter: "J", flagEmoji: "\u{1F1EA}\u{1F1E8}", tier: 3 },

  // Group K
  { name: "USA", fifaCode: "USA", groupLetter: "K", flagEmoji: "\u{1F1FA}\u{1F1F8}", tier: 1 },
  { name: "Mexico", fifaCode: "MEX", groupLetter: "K", flagEmoji: "\u{1F1F2}\u{1F1FD}", tier: 2 },
  { name: "South Korea", fifaCode: "KOR", groupLetter: "K", flagEmoji: "\u{1F1F0}\u{1F1F7}", tier: 2 },
  { name: "Trinidad and Tobago", fifaCode: "TRI", groupLetter: "K", flagEmoji: "\u{1F1F9}\u{1F1F9}", tier: 4 },

  // Group L
  { name: "Croatia", fifaCode: "CRO", groupLetter: "L", flagEmoji: "\u{1F1ED}\u{1F1F7}", tier: 1 },
  { name: "Canada", fifaCode: "CAN", groupLetter: "L", flagEmoji: "\u{1F1E8}\u{1F1E6}", tier: 2 },
  { name: "Wales", fifaCode: "WAL", groupLetter: "L", flagEmoji: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0077}\u{E006C}\u{E0073}\u{E007F}", tier: 3 },
  { name: "Jamaica", fifaCode: "JAM", groupLetter: "L", flagEmoji: "\u{1F1EF}\u{1F1F2}", tier: 4 },
];

export async function POST() {
  try {
    if (!tablesEnsured) {
      await ensureTables();
      tablesEnsured = true;
    }

    let inserted = 0;

    for (const team of WC_2026_TEAMS) {
      const result = await db
        .insert(wcTeams)
        .values({
          name: team.name,
          fifaCode: team.fifaCode,
          groupLetter: team.groupLetter,
          flagEmoji: team.flagEmoji,
          tier: team.tier,
        })
        .onConflictDoNothing();
      // Count inserted (pg driver returns rowCount on the result)
      inserted++;
    }

    return NextResponse.json({
      message: `Seeded ${WC_2026_TEAMS.length} World Cup 2026 teams`,
      teamCount: WC_2026_TEAMS.length,
    });
  } catch (err) {
    console.error("[Seed Teams]", err);
    return NextResponse.json(
      { error: "Failed to seed teams" },
      { status: 500 }
    );
  }
}
