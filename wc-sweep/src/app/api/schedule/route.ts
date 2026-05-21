import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import {
  matches,
  wcTeams,
  teamAssignments,
  players,
} from "@/db/schema";
import { asc } from "drizzle-orm";

let tablesEnsured = false;

export async function GET() {
  try {
    if (!tablesEnsured) {
      await ensureTables();
      tablesEnsured = true;
    }

    const allMatches = await db
      .select()
      .from(matches)
      .orderBy(asc(matches.kickoff));
    const allTeams = await db.select().from(wcTeams);
    const allAssignments = await db.select().from(teamAssignments);
    const allPlayers = await db.select().from(players);

    // Group matches by date then by stage
    const dateMap = new Map<
      string,
      Array<{
        id: number;
        homeTeam: { name: string; flag: string };
        awayTeam: { name: string; flag: string };
        kickoff: string;
        status: string;
        homeScore: number | null;
        awayScore: number | null;
        homePenalties: number | null;
        awayPenalties: number | null;
        minute: number | null;
        stage: string;
        groupLetter: string | null;
        homeOwner: string | null;
        awayOwner: string | null;
        venue: string | null;
        city: string | null;
      }>
    >();

    for (const m of allMatches) {
      const home = allTeams.find((t) => t.id === m.homeTeamId);
      const away = allTeams.find((t) => t.id === m.awayTeamId);

      const homeAssign = allAssignments.find(
        (a) => a.teamId === m.homeTeamId
      );
      const awayAssign = allAssignments.find(
        (a) => a.teamId === m.awayTeamId
      );
      const homeOwner = homeAssign
        ? allPlayers.find((p) => p.id === homeAssign.playerId)?.name ?? null
        : null;
      const awayOwner = awayAssign
        ? allPlayers.find((p) => p.id === awayAssign.playerId)?.name ?? null
        : null;

      const kickoffDate = m.kickoff
        ? m.kickoff.toISOString().split("T")[0]
        : "unknown";

      const matchEntry = {
        id: m.id,
        homeTeam: {
          name: home?.name ?? "TBD",
          flag: home?.flagEmoji ?? "🏳️",
        },
        awayTeam: {
          name: away?.name ?? "TBD",
          flag: away?.flagEmoji ?? "🏳️",
        },
        kickoff: m.kickoff?.toISOString() ?? "",
        status: m.status,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        homePenalties: m.homePenalties,
        awayPenalties: m.awayPenalties,
        minute: m.minute,
        stage: m.stage,
        groupLetter: m.groupLetter,
        homeOwner,
        awayOwner,
        venue: m.venue,
        city: m.city,
      };

      if (!dateMap.has(kickoffDate)) {
        dateMap.set(kickoffDate, []);
      }
      dateMap.get(kickoffDate)!.push(matchEntry);
    }

    // Sort matches within each date by kickoff
    const dates = Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, dayMatches]) => ({
        date,
        matches: dayMatches.sort(
          (a, b) =>
            new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime()
        ),
      }));

    return NextResponse.json({ dates });
  } catch (err) {
    console.error("[Schedule]", err);
    return NextResponse.json(
      { error: "Failed to load schedule" },
      { status: 500 }
    );
  }
}
