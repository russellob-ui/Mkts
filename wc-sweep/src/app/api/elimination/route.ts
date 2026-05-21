import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import { players, wcTeams, teamAssignments } from "@/db/schema";

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

    const playerData = allPlayers.map((player) => {
      const assignments = allAssignments.filter(
        (a) => a.playerId === player.id
      );
      const teams = assignments.map((a) => {
        const team = allTeams.find((t) => t.id === a.teamId);
        return {
          teamId: a.teamId,
          name: team?.name ?? "?",
          flagEmoji: team?.flagEmoji ?? "🏳️",
          fifaCode: team?.fifaCode ?? "???",
          tier: team?.tier ?? 1,
          eliminated: team?.eliminated ?? false,
          eliminatedAt: team?.eliminatedAt ?? null,
        };
      });

      const totalTeams = teams.length;
      const teamsAlive = teams.filter((t) => !t.eliminated).length;
      const teamsEliminated = teams.filter((t) => t.eliminated).length;
      const survivalRate =
        totalTeams > 0 ? Math.round((teamsAlive / totalTeams) * 100) : 0;

      return {
        playerId: player.id,
        playerName: player.name,
        color: player.color ?? "#ffffff",
        totalTeams,
        teamsAlive,
        teamsEliminated,
        survivalRate,
        teams: teams.sort((a, b) => {
          // Alive teams first, then by tier
          if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
          return a.tier - b.tier;
        }),
      };
    });

    // Sort by teams alive DESC, then survival rate DESC
    playerData.sort((a, b) => {
      if (b.teamsAlive !== a.teamsAlive) return b.teamsAlive - a.teamsAlive;
      return b.survivalRate - a.survivalRate;
    });

    return NextResponse.json({ players: playerData });
  } catch (err) {
    console.error("[Elimination]", err);
    return NextResponse.json(
      { error: "Failed to load elimination data" },
      { status: 500 }
    );
  }
}
