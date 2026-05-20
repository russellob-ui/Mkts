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
import { eq, sql, and, gte, lte } from "drizzle-orm";

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

    const leaderboard = allPlayers
      .map((player) => {
        const playerAssignments = allAssignments.filter(
          (a) => a.playerId === player.id
        );
        const playerTeams = playerAssignments.map((a) => {
          const team = allTeams.find((t) => t.id === a.teamId);
          const teamPoints = allPoints
            .filter(
              (p) => p.playerId === player.id && p.teamId === a.teamId
            )
            .reduce((sum, p) => sum + p.points, 0);
          return {
            teamId: a.teamId,
            teamName: team?.name ?? "?",
            flagEmoji: team?.flagEmoji ?? "🏳️",
            tier: team?.tier ?? 1,
            points: Math.round(teamPoints * 10) / 10,
            eliminated: team?.eliminated ?? false,
          };
        });
        const totalPoints = playerTeams.reduce((s, t) => s + t.points, 0);
        return {
          playerId: player.id,
          playerName: player.name,
          color: player.color ?? "#ffffff",
          totalPoints: Math.round(totalPoints * 10) / 10,
          teams: playerTeams.sort((a, b) => b.points - a.points),
        };
      })
      .sort((a, b) => b.totalPoints - a.totalPoints);

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const todayMatches = await db
      .select()
      .from(matches)
      .where(
        and(
          gte(matches.kickoff, todayStart),
          lte(matches.kickoff, todayEnd)
        )
      );

    const matchCards = todayMatches
      .map((m) => {
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
        return {
          id: m.id,
          homeTeam: home?.name ?? "?",
          awayTeam: away?.name ?? "?",
          homeFlag: home?.flagEmoji ?? "🏳️",
          awayFlag: away?.flagEmoji ?? "🏳️",
          homeScore: m.homeScore,
          awayScore: m.awayScore,
          status: m.status,
          minute: m.minute,
          kickoff: m.kickoff?.toISOString() ?? "",
          homeOwner,
          awayOwner,
          stage: m.stage,
        };
      })
      .sort(
        (a, b) =>
          new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime()
      );

    return NextResponse.json({
      leaderboard,
      todayMatches: matchCards,
    });
  } catch (err) {
    console.error("[Leaderboard]", err);
    return NextResponse.json(
      { error: "Failed to load leaderboard" },
      { status: 500 }
    );
  }
}
