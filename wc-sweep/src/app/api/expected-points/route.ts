import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import {
  players,
  wcTeams,
  teamAssignments,
  pointsLog,
  matches,
} from "@/db/schema";
import { getTierMultiplier } from "@/lib/api-football";

let tablesEnsured = false;

export async function GET() {
  try {
    if (!tablesEnsured) {
      await ensureTables();
      tablesEnsured = true;
    }

    const allPlayers = await db.select().from(players);
    const allTeams = await db.select().from(wcTeams);
    const allAssignments = await db.select().from(teamAssignments);
    const allPoints = await db.select().from(pointsLog);
    const allMatches = await db.select().from(matches);

    // Count remaining matches per team (scheduled or live)
    function getRemainingMatches(teamId: number) {
      return allMatches.filter(
        (m) =>
          (m.homeTeamId === teamId || m.awayTeamId === teamId) &&
          (m.status === "scheduled" || m.status === "live" || m.status === "not_started")
      );
    }

    // Determine if a match is a group stage or knockout
    function isGroupStage(stage: string): boolean {
      return stage.toLowerCase().startsWith("group");
    }

    const expected = allPlayers
      .map((player) => {
        const assigns = allAssignments.filter(
          (a) => a.playerId === player.id
        );
        const currentTotal = allPoints
          .filter((p) => p.playerId === player.id)
          .reduce((sum, p) => sum + p.points, 0);

        let expectedRemaining = 0;
        let teamsAlive = 0;

        const teamDetails = assigns.map((a) => {
          const team = allTeams.find((t) => t.id === a.teamId);
          if (!team) return null;

          const teamPts = allPoints
            .filter(
              (p) => p.playerId === player.id && p.teamId === a.teamId
            )
            .reduce((sum, p) => sum + p.points, 0);

          const alive = !team.eliminated;
          if (alive) teamsAlive++;

          const remaining = alive ? getRemainingMatches(team.id) : [];
          const mult = getTierMultiplier(team.tier);

          let teamExpected = 0;
          for (const match of remaining) {
            if (isGroupStage(match.stage)) {
              // Group match: expected ~1.5 pts per match per tier mult
              teamExpected += 1.5 * mult;
            } else {
              // Knockout match: expected ~3 pts per match per tier mult
              teamExpected += 3 * mult;
            }
          }

          expectedRemaining += teamExpected;

          return {
            teamId: team.id,
            teamName: team.name,
            flagEmoji: team.flagEmoji ?? "",
            tier: team.tier,
            currentPoints: Math.round(teamPts * 10) / 10,
            remainingMatches: remaining.length,
            expectedFromTeam: Math.round(teamExpected * 10) / 10,
            eliminated: team.eliminated ?? false,
          };
        }).filter(Boolean);

        return {
          playerId: player.id,
          playerName: player.name,
          color: player.color ?? "#ffffff",
          currentPoints: Math.round(currentTotal * 10) / 10,
          expectedRemaining: Math.round(expectedRemaining * 10) / 10,
          projectedTotal:
            Math.round((currentTotal + expectedRemaining) * 10) / 10,
          teamsAlive,
          teams: teamDetails,
        };
      })
      .sort((a, b) => b.projectedTotal - a.projectedTotal);

    return NextResponse.json({ expected });
  } catch (err) {
    console.error("[ExpectedPoints]", err);
    return NextResponse.json(
      { error: "Failed to calculate expected points" },
      { status: 500 }
    );
  }
}
