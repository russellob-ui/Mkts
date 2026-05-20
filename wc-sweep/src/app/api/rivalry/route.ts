import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import {
  players,
  wcTeams,
  teamAssignments,
  pointsLog,
  matches,
  predictions,
} from "@/db/schema";
import { eq, and, or, inArray } from "drizzle-orm";

let tablesEnsured = false;

export async function GET(request: Request) {
  try {
    if (!tablesEnsured) {
      await ensureTables();
      tablesEnsured = true;
    }

    const { searchParams } = new URL(request.url);
    const slug1 = searchParams.get("player1");
    const slug2 = searchParams.get("player2");

    if (!slug1 || !slug2) {
      return NextResponse.json(
        { error: "Both player1 and player2 query params required" },
        { status: 400 }
      );
    }

    const allPlayers = await db.select().from(players);
    const p1 = allPlayers.find((p) => p.slug === slug1);
    const p2 = allPlayers.find((p) => p.slug === slug2);

    if (!p1 || !p2) {
      return NextResponse.json(
        { error: "One or both players not found" },
        { status: 404 }
      );
    }

    const allTeams = await db.select().from(wcTeams);
    const allAssignments = await db.select().from(teamAssignments);
    const allPoints = await db.select().from(pointsLog);
    const allMatches = await db.select().from(matches);
    const allPredictions = await db.select().from(predictions);

    // Helper: get player team data
    function getPlayerTeamData(playerId: number) {
      const assigns = allAssignments.filter((a) => a.playerId === playerId);
      const teamIds = assigns.map((a) => a.teamId);
      const teams = assigns.map((a) => {
        const team = allTeams.find((t) => t.id === a.teamId);
        const pts = allPoints
          .filter((p) => p.playerId === playerId && p.teamId === a.teamId)
          .reduce((sum, p) => sum + p.points, 0);
        return {
          teamId: a.teamId,
          teamName: team?.name ?? "?",
          flagEmoji: team?.flagEmoji ?? "",
          tier: team?.tier ?? 1,
          points: Math.round(pts * 10) / 10,
          eliminated: team?.eliminated ?? false,
        };
      });
      const totalPoints = teams.reduce((s, t) => s + t.points, 0);
      const alive = teams.filter((t) => !t.eliminated).length;
      const eliminated = teams.filter((t) => t.eliminated).length;
      return { teamIds, teams: teams.sort((a, b) => b.points - a.points), totalPoints: Math.round(totalPoints * 10) / 10, alive, eliminated };
    }

    const p1Data = getPlayerTeamData(p1.id);
    const p2Data = getPlayerTeamData(p2.id);

    // Head-to-head matches: where a p1 team played a p2 team
    const headToHead = allMatches
      .filter((m) => {
        const homeIsP1 = p1Data.teamIds.includes(m.homeTeamId);
        const awayIsP1 = p1Data.teamIds.includes(m.awayTeamId);
        const homeIsP2 = p2Data.teamIds.includes(m.homeTeamId);
        const awayIsP2 = p2Data.teamIds.includes(m.awayTeamId);
        return (homeIsP1 && awayIsP2) || (homeIsP2 && awayIsP1);
      })
      .map((m) => {
        const homeTeam = allTeams.find((t) => t.id === m.homeTeamId);
        const awayTeam = allTeams.find((t) => t.id === m.awayTeamId);
        const homeOwnerIsP1 = p1Data.teamIds.includes(m.homeTeamId);
        return {
          matchId: m.id,
          homeTeam: homeTeam?.name ?? "?",
          awayTeam: awayTeam?.name ?? "?",
          homeFlag: homeTeam?.flagEmoji ?? "",
          awayFlag: awayTeam?.flagEmoji ?? "",
          homeScore: m.homeScore,
          awayScore: m.awayScore,
          status: m.status,
          stage: m.stage,
          kickoff: m.kickoff?.toISOString() ?? "",
          p1Side: homeOwnerIsP1 ? "home" : "away",
          p2Side: homeOwnerIsP1 ? "away" : "home",
          p1Won:
            m.status === "finished" && m.homeScore !== null && m.awayScore !== null
              ? homeOwnerIsP1
                ? m.homeScore > m.awayScore
                : m.awayScore > m.homeScore
              : null,
          p2Won:
            m.status === "finished" && m.homeScore !== null && m.awayScore !== null
              ? homeOwnerIsP1
                ? m.awayScore > m.homeScore
                : m.homeScore > m.awayScore
              : null,
        };
      })
      .sort(
        (a, b) =>
          new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime()
      );

    // Prediction accuracy
    function getPredictionStats(playerId: number) {
      const preds = allPredictions.filter(
        (p) => p.playerId === playerId && p.resolved
      );
      const correct = preds.filter((p) => p.correct).length;
      const total = preds.length;
      return {
        total,
        correct,
        accuracy: total > 0 ? Math.round((correct / total) * 1000) / 10 : 0,
      };
    }

    const p1Preds = getPredictionStats(p1.id);
    const p2Preds = getPredictionStats(p2.id);

    return NextResponse.json({
      player1: {
        id: p1.id,
        name: p1.name,
        slug: p1.slug,
        color: p1.color ?? "#ffffff",
        totalPoints: p1Data.totalPoints,
        teams: p1Data.teams,
        alive: p1Data.alive,
        eliminated: p1Data.eliminated,
        predictions: p1Preds,
      },
      player2: {
        id: p2.id,
        name: p2.name,
        slug: p2.slug,
        color: p2.color ?? "#ffffff",
        totalPoints: p2Data.totalPoints,
        teams: p2Data.teams,
        alive: p2Data.alive,
        eliminated: p2Data.eliminated,
        predictions: p2Preds,
      },
      headToHead,
    });
  } catch (err) {
    console.error("[Rivalry]", err);
    return NextResponse.json(
      { error: "Failed to load rivalry data" },
      { status: 500 }
    );
  }
}
