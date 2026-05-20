import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import {
  matches,
  wcTeams,
  teamAssignments,
  players,
} from "@/db/schema";
import { inArray } from "drizzle-orm";

let tablesEnsured = false;

const KNOCKOUT_STAGES = ["R32", "R16", "QF", "SF", "3P", "F"] as const;

const STAGE_LABELS: Record<string, string> = {
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarter-finals",
  SF: "Semi-finals",
  "3P": "Third Place",
  F: "Final",
};

export async function GET() {
  try {
    if (!tablesEnsured) {
      await ensureTables();
      tablesEnsured = true;
    }

    // Lookup tables
    const allTeams = await db.select().from(wcTeams);
    const allAssignments = await db.select().from(teamAssignments);
    const allPlayers = await db.select().from(players);

    const teamById = new Map(allTeams.map((t) => [t.id, t]));
    const assignmentByTeamId = new Map(
      allAssignments.map((a) => [a.teamId, a])
    );
    const playerById = new Map(allPlayers.map((p) => [p.id, p]));

    // Fetch knockout matches
    const knockoutMatches = await db
      .select()
      .from(matches)
      .where(inArray(matches.stage, [...KNOCKOUT_STAGES]));

    // Group by stage
    const rounds: Record<string, unknown[]> = {};
    for (const stage of KNOCKOUT_STAGES) {
      rounds[stage] = [];
    }

    for (const m of knockoutMatches) {
      const home = teamById.get(m.homeTeamId);
      const away = teamById.get(m.awayTeamId);
      const homeAssign = assignmentByTeamId.get(m.homeTeamId);
      const awayAssign = assignmentByTeamId.get(m.awayTeamId);
      const homeOwner = homeAssign
        ? playerById.get(homeAssign.playerId)
        : null;
      const awayOwner = awayAssign
        ? playerById.get(awayAssign.playerId)
        : null;

      const card = {
        id: m.id,
        homeTeam: {
          name: home?.name ?? "TBD",
          flag: home?.flagEmoji ?? "🏳️",
          ownerName: homeOwner?.name ?? null,
          ownerColor: homeOwner?.color ?? null,
        },
        awayTeam: {
          name: away?.name ?? "TBD",
          flag: away?.flagEmoji ?? "🏳️",
          ownerName: awayOwner?.name ?? null,
          ownerColor: awayOwner?.color ?? null,
        },
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        homePenalties: m.homePenalties,
        awayPenalties: m.awayPenalties,
        status: m.status,
        minute: m.minute,
        kickoff: m.kickoff?.toISOString() ?? "",
        winnerTeamId: m.winnerTeamId,
        stage: m.stage,
        stageLabel: STAGE_LABELS[m.stage] ?? m.stage,
        venue: m.venue,
        city: m.city,
      };

      if (rounds[m.stage]) {
        rounds[m.stage].push(card);
      }
    }

    // Sort each round by kickoff
    for (const stage of KNOCKOUT_STAGES) {
      rounds[stage].sort(
        (a: any, b: any) =>
          new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime()
      );
    }

    return NextResponse.json({ rounds });
  } catch (err) {
    console.error("[Bracket]", err);
    return NextResponse.json(
      { error: "Failed to load bracket" },
      { status: 500 }
    );
  }
}
