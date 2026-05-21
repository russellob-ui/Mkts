import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import { wcTeams, matches } from "@/db/schema";
import { sql } from "drizzle-orm";
import { verifyAdminRequest } from "@/lib/admin-auth";

let tablesEnsured = false;

/**
 * Round-robin matchday pairings for a group of 4 teams [T1, T2, T3, T4]:
 *   Matchday 1: T1 vs T2, T3 vs T4
 *   Matchday 2: T1 vs T3, T4 vs T2
 *   Matchday 3: T4 vs T1, T2 vs T3
 */
const MATCHDAY_PAIRINGS: Array<{ matchday: number; home: number; away: number }> = [
  { matchday: 1, home: 0, away: 1 },
  { matchday: 1, home: 2, away: 3 },
  { matchday: 2, home: 0, away: 2 },
  { matchday: 2, home: 3, away: 1 },
  { matchday: 3, home: 3, away: 0 },
  { matchday: 3, home: 1, away: 2 },
];

/**
 * Group scheduling:
 *   Groups A-D Matchday 1: June 11-12   |  Matchday 2: June 17-18  |  Matchday 3: June 23-24
 *   Groups E-H Matchday 1: June 13-14   |  Matchday 2: June 19-20  |  Matchday 3: June 25-26
 *   Groups I-L Matchday 1: June 15-16   |  Matchday 2: June 21-22  |  Matchday 3: June 27
 *
 * Each day has 4 matches at 13:00, 16:00, 19:00, 22:00 UTC.
 * 2 matches per group per day batch (4 groups x 2 matches = 8 matches over 2 days = 4/day).
 */

// Map group batch (0 = A-D, 1 = E-H, 2 = I-L) + matchday (1-3) to start dates
const BATCH_SCHEDULE: Record<string, number[]> = {
  // batch_matchday -> [day1, day2] (June day-of-month, 2026)
  "0_1": [11, 12],
  "1_1": [13, 14],
  "2_1": [15, 16],
  "0_2": [17, 18],
  "1_2": [19, 20],
  "2_2": [21, 22],
  "0_3": [23, 24],
  "1_3": [25, 26],
  "2_3": [27, 27], // Last batch only has 4 groups I-L, fits in 1 day but we use 2 slots
};

const KICKOFF_HOURS = [13, 16, 19, 22]; // UTC

function getGroupBatch(groupLetter: string): number {
  const code = groupLetter.charCodeAt(0) - "A".charCodeAt(0); // A=0 .. L=11
  if (code < 4) return 0; // A-D
  if (code < 8) return 1; // E-H
  return 2; // I-L
}

function getGroupIndexInBatch(groupLetter: string): number {
  const code = groupLetter.charCodeAt(0) - "A".charCodeAt(0);
  return code % 4; // 0-3 within batch
}

/**
 * For a given group letter and matchday, returns two kickoff Date objects.
 * Each group gets 2 matches per matchday. Within a batch of 4 groups sharing 2 days:
 *   Day 1: groups at index 0 and 1 (2 matches each = 4 matches at 13/16/19/22)
 *   Day 2: groups at index 2 and 3
 * Within a day, the first group gets 13:00 and 16:00, the second gets 19:00 and 22:00.
 */
function getKickoffTimes(groupLetter: string, matchday: number): Date[] {
  const batch = getGroupBatch(groupLetter);
  const indexInBatch = getGroupIndexInBatch(groupLetter);
  const key = `${batch}_${matchday}`;
  const days = BATCH_SCHEDULE[key];

  // Day index: groups 0,1 -> day[0]; groups 2,3 -> day[1]
  const dayIndex = indexInBatch < 2 ? 0 : 1;
  const dayOfMonth = days[Math.min(dayIndex, days.length - 1)];

  // Slot within that day: even index in pair -> first two slots, odd -> last two
  const slotOffset = (indexInBatch % 2) * 2; // 0 or 2
  const hour1 = KICKOFF_HOURS[slotOffset];
  const hour2 = KICKOFF_HOURS[slotOffset + 1];

  return [
    new Date(Date.UTC(2026, 5, dayOfMonth, hour1, 0, 0)), // June = month 5
    new Date(Date.UTC(2026, 5, dayOfMonth, hour2, 0, 0)),
  ];
}

export async function POST(request: Request) {
  try {
    if (!tablesEnsured) {
      await ensureTables();
      tablesEnsured = true;
    }

    const authError = await verifyAdminRequest(request);
    if (authError) return authError;

    // 1. Read all teams
    const allTeams = await db.select().from(wcTeams);
    if (allTeams.length === 0) {
      return NextResponse.json(
        { error: "No teams found. Seed teams first." },
        { status: 400 }
      );
    }

    // 2. Group teams by group letter
    const groups: Record<string, typeof allTeams> = {};
    for (const team of allTeams) {
      const g = team.groupLetter;
      if (!groups[g]) groups[g] = [];
      groups[g].push(team);
    }

    // Validate all groups have exactly 4 teams
    for (const [letter, teams] of Object.entries(groups)) {
      if (teams.length !== 4) {
        return NextResponse.json(
          { error: `Group ${letter} has ${teams.length} teams (expected 4)` },
          { status: 400 }
        );
      }
    }

    // 3. Generate all group stage matches
    let inserted = 0;

    for (const [groupLetter, teams] of Object.entries(groups)) {
      // Sort teams by id for deterministic ordering
      teams.sort((a, b) => a.id - b.id);

      for (const pairing of MATCHDAY_PAIRINGS) {
        const homeTeam = teams[pairing.home];
        const awayTeam = teams[pairing.away];
        const stage = `GS${pairing.matchday}`;

        // Get the two kickoff times for this group + matchday
        const kickoffs = getKickoffTimes(groupLetter, pairing.matchday);

        // First pairing of the matchday gets slot 0, second gets slot 1
        // Within MATCHDAY_PAIRINGS, each matchday has 2 entries — use index parity
        const matchdayPairings = MATCHDAY_PAIRINGS.filter(
          (p) => p.matchday === pairing.matchday
        );
        const pairingIndex = matchdayPairings.indexOf(pairing);
        const kickoff = kickoffs[pairingIndex];

        await db
          .insert(matches)
          .values({
            homeTeamId: homeTeam.id,
            awayTeamId: awayTeam.id,
            stage,
            groupLetter,
            kickoff,
            status: "scheduled",
          })
          .onConflictDoNothing();

        inserted++;
      }
    }

    return NextResponse.json({
      message: `Seeded ${inserted} group stage matches across ${Object.keys(groups).length} groups`,
      matchCount: inserted,
    });
  } catch (err) {
    console.error("[Seed Matches]", err);
    return NextResponse.json(
      { error: "Failed to seed matches" },
      { status: 500 }
    );
  }
}
