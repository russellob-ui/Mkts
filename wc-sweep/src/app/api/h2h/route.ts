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

    const p1TeamIds = allAssignments
      .filter((a) => a.playerId === p1.id)
      .map((a) => a.teamId);
    const p2TeamIds = allAssignments
      .filter((a) => a.playerId === p2.id)
      .map((a) => a.teamId);

    // Find matches where a p1 team faced a p2 team
    const h2hMatches = allMatches
      .filter((m) => {
        const homeIsP1 = p1TeamIds.includes(m.homeTeamId);
        const awayIsP1 = p1TeamIds.includes(m.awayTeamId);
        const homeIsP2 = p2TeamIds.includes(m.homeTeamId);
        const awayIsP2 = p2TeamIds.includes(m.awayTeamId);
        return (homeIsP1 && awayIsP2) || (homeIsP2 && awayIsP1);
      })
      .sort(
        (a, b) =>
          new Date(a.kickoff?.toISOString() ?? "").getTime() -
          new Date(b.kickoff?.toISOString() ?? "").getTime()
      );

    let p1Wins = 0;
    let p2Wins = 0;
    let draws = 0;
    let p1TotalPoints = 0;
    let p2TotalPoints = 0;

    const matchDetails = h2hMatches.map((m) => {
      const homeTeam = allTeams.find((t) => t.id === m.homeTeamId);
      const awayTeam = allTeams.find((t) => t.id === m.awayTeamId);
      const p1OwnsHome = p1TeamIds.includes(m.homeTeamId);

      const p1TeamId = p1OwnsHome ? m.homeTeamId : m.awayTeamId;
      const p2TeamId = p1OwnsHome ? m.awayTeamId : m.homeTeamId;
      const p1Team = allTeams.find((t) => t.id === p1TeamId);
      const p2Team = allTeams.find((t) => t.id === p2TeamId);

      let p1Pts = 0;
      let p2Pts = 0;
      let p1Won: boolean | null = null;
      let p2Won: boolean | null = null;

      if (
        m.status === "finished" &&
        m.homeScore !== null &&
        m.awayScore !== null
      ) {
        // Calculate actual points earned from points_log for this match
        const p1MatchPoints = allPoints
          .filter(
            (p) =>
              p.playerId === p1.id &&
              p.matchId === m.id &&
              p.teamId === p1TeamId
          )
          .reduce((sum, p) => sum + p.points, 0);
        const p2MatchPoints = allPoints
          .filter(
            (p) =>
              p.playerId === p2.id &&
              p.matchId === m.id &&
              p.teamId === p2TeamId
          )
          .reduce((sum, p) => sum + p.points, 0);

        p1Pts = Math.round(p1MatchPoints * 10) / 10;
        p2Pts = Math.round(p2MatchPoints * 10) / 10;

        // Determine who won
        const p1Score = p1OwnsHome ? m.homeScore : m.awayScore;
        const p2Score = p1OwnsHome ? m.awayScore : m.homeScore;

        if (p1Score > p2Score) {
          p1Won = true;
          p2Won = false;
          p1Wins++;
        } else if (p2Score > p1Score) {
          p1Won = false;
          p2Won = true;
          p2Wins++;
        } else {
          p1Won = false;
          p2Won = false;
          draws++;
        }

        p1TotalPoints += p1Pts;
        p2TotalPoints += p2Pts;
      }

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
        p1Side: (p1OwnsHome ? "home" : "away") as "home" | "away",
        p2Side: (p1OwnsHome ? "away" : "home") as "home" | "away",
        p1TeamName: p1Team?.name ?? "?",
        p2TeamName: p2Team?.name ?? "?",
        p1Flag: p1Team?.flagEmoji ?? "",
        p2Flag: p2Team?.flagEmoji ?? "",
        p1Points: p1Pts,
        p2Points: p2Pts,
        p1Won,
        p2Won,
      };
    });

    return NextResponse.json({
      h2h: {
        player1: {
          id: p1.id,
          name: p1.name,
          slug: p1.slug,
          color: p1.color ?? "#ffffff",
          totalH2HPoints: Math.round(p1TotalPoints * 10) / 10,
        },
        player2: {
          id: p2.id,
          name: p2.name,
          slug: p2.slug,
          color: p2.color ?? "#ffffff",
          totalH2HPoints: Math.round(p2TotalPoints * 10) / 10,
        },
        matches: matchDetails,
        summary: {
          p1Wins,
          p2Wins,
          draws,
        },
      },
    });
  } catch (err) {
    console.error("[H2H]", err);
    return NextResponse.json(
      { error: "Failed to load head-to-head data" },
      { status: 500 }
    );
  }
}
