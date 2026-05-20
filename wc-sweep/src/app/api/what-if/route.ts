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
import { calcMatchPoints } from "@/lib/points";
import { eq, inArray } from "drizzle-orm";

let tablesEnsured = false;

export async function POST(request: Request) {
  try {
    if (!tablesEnsured) {
      await ensureTables();
      tablesEnsured = true;
    }

    const body = await request.json();
    const scenarios: Array<{
      matchId: number;
      homeScore: number;
      awayScore: number;
    }> = body.scenarios ?? [];

    if (!Array.isArray(scenarios) || scenarios.length === 0) {
      return NextResponse.json(
        { error: "scenarios array required" },
        { status: 400 }
      );
    }

    const allPlayers = await db.select().from(players);
    const allTeams = await db.select().from(wcTeams);
    const allAssignments = await db.select().from(teamAssignments);
    const allPoints = await db.select().from(pointsLog);
    const allMatches = await db.select().from(matches);

    // Build current points per player
    const currentPointsMap = new Map<number, number>();
    for (const player of allPlayers) {
      const total = allPoints
        .filter((p) => p.playerId === player.id)
        .reduce((sum, p) => sum + p.points, 0);
      currentPointsMap.set(player.id, Math.round(total * 10) / 10);
    }

    // Calculate hypothetical additional points from scenarios
    const hypotheticalAdded = new Map<number, number>();

    for (const scenario of scenarios) {
      const match = allMatches.find((m) => m.id === scenario.matchId);
      if (!match) continue;

      // Find who owns home and away teams
      const homeAssign = allAssignments.find(
        (a) => a.teamId === match.homeTeamId
      );
      const awayAssign = allAssignments.find(
        (a) => a.teamId === match.awayTeamId
      );
      const homeTeam = allTeams.find((t) => t.id === match.homeTeamId);
      const awayTeam = allTeams.find((t) => t.id === match.awayTeamId);

      // Calculate points for home team owner
      if (homeAssign && homeTeam) {
        const results = calcMatchPoints(
          scenario.homeScore,
          scenario.awayScore,
          match.homeTeamId,
          match.homeTeamId,
          match.awayTeamId,
          homeTeam.tier
        );
        const pts = results.reduce((sum, r) => sum + r.points, 0);
        hypotheticalAdded.set(
          homeAssign.playerId,
          (hypotheticalAdded.get(homeAssign.playerId) ?? 0) + pts
        );
      }

      // Calculate points for away team owner
      if (awayAssign && awayTeam) {
        const results = calcMatchPoints(
          scenario.homeScore,
          scenario.awayScore,
          match.awayTeamId,
          match.homeTeamId,
          match.awayTeamId,
          awayTeam.tier
        );
        const pts = results.reduce((sum, r) => sum + r.points, 0);
        hypotheticalAdded.set(
          awayAssign.playerId,
          (hypotheticalAdded.get(awayAssign.playerId) ?? 0) + pts
        );
      }
    }

    // Build hypothetical leaderboard
    const hypothetical = allPlayers
      .map((player) => {
        const current = currentPointsMap.get(player.id) ?? 0;
        const added = hypotheticalAdded.get(player.id) ?? 0;
        const hypotheticalPoints = Math.round((current + added) * 10) / 10;
        return {
          playerId: player.id,
          playerName: player.name,
          color: player.color ?? "#ffffff",
          currentPoints: current,
          hypotheticalPoints,
          change: Math.round(added * 10) / 10,
          newRank: 0,
        };
      })
      .sort((a, b) => b.hypotheticalPoints - a.hypotheticalPoints);

    // Assign ranks
    hypothetical.forEach((entry, i) => {
      entry.newRank = i + 1;
    });

    // Also compute current ranks for comparison
    const currentRanked = [...hypothetical].sort(
      (a, b) => b.currentPoints - a.currentPoints
    );
    const currentRankMap = new Map<number, number>();
    currentRanked.forEach((entry, i) => {
      currentRankMap.set(entry.playerId, i + 1);
    });

    // Add currentRank to response
    const result = hypothetical.map((entry) => ({
      ...entry,
      currentRank: currentRankMap.get(entry.playerId) ?? 0,
    }));

    return NextResponse.json({ hypothetical: result });
  } catch (err) {
    console.error("[WhatIf]", err);
    return NextResponse.json(
      { error: "Failed to run simulation" },
      { status: 500 }
    );
  }
}
