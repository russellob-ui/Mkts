import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import {
  players,
  wcTeams,
  teamAssignments,
  matches,
  matchEvents,
  pointsLog,
  groupStandings,
} from "@/db/schema";
import { eq, or } from "drizzle-orm";
import { TIER_LABELS } from "@/lib/points";

let tablesEnsured = false;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!tablesEnsured) {
      await ensureTables();
      tablesEnsured = true;
    }

    const { id } = await params;
    const teamId = parseInt(id, 10);
    if (isNaN(teamId)) {
      return NextResponse.json({ error: "Invalid team ID" }, { status: 400 });
    }

    // Fetch team
    const teamRows = await db
      .select()
      .from(wcTeams)
      .where(eq(wcTeams.id, teamId));

    if (teamRows.length === 0) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const team = teamRows[0];

    // Owner info
    const assignmentRows = await db
      .select()
      .from(teamAssignments)
      .where(eq(teamAssignments.teamId, teamId));

    let owner: { id: number; name: string; color: string | null } | null = null;
    if (assignmentRows.length > 0) {
      const ownerRows = await db
        .select()
        .from(players)
        .where(eq(players.id, assignmentRows[0].playerId));
      if (ownerRows.length > 0) {
        const p = ownerRows[0];
        owner = { id: p.id, name: p.name, color: p.color };
      }
    }

    // Group standing position
    const standingRows = await db
      .select()
      .from(groupStandings)
      .where(eq(groupStandings.teamId, teamId));

    const standing = standingRows.length > 0 ? standingRows[0] : null;

    // All matches involving this team
    const allTeams = await db.select().from(wcTeams);
    const teamById = new Map(allTeams.map((t) => [t.id, t]));

    const teamMatches = await db
      .select()
      .from(matches)
      .where(
        or(
          eq(matches.homeTeamId, teamId),
          eq(matches.awayTeamId, teamId)
        )
      );

    const matchList = teamMatches
      .map((m) => {
        const isHome = m.homeTeamId === teamId;
        const opponentId = isHome ? m.awayTeamId : m.homeTeamId;
        const opponent = teamById.get(opponentId);
        return {
          matchId: m.id,
          stage: m.stage,
          groupLetter: m.groupLetter,
          kickoff: m.kickoff?.toISOString() ?? "",
          status: m.status,
          venue: m.venue,
          city: m.city,
          isHome,
          homeScore: m.homeScore,
          awayScore: m.awayScore,
          homePenalties: m.homePenalties,
          awayPenalties: m.awayPenalties,
          minute: m.minute,
          winnerTeamId: m.winnerTeamId,
          opponentId,
          opponentName: opponent?.name ?? "?",
          opponentFlag: opponent?.flagEmoji ?? "🏳️",
          // Compute result for this team
          result:
            m.status === "finished"
              ? m.winnerTeamId === teamId
                ? "W"
                : m.winnerTeamId === null &&
                  m.homeScore !== null &&
                  m.awayScore !== null
                ? "D"
                : "L"
              : null,
          teamScore: isHome ? m.homeScore : m.awayScore,
          opponentScore: isHome ? m.awayScore : m.homeScore,
        };
      })
      .sort(
        (a, b) =>
          new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime()
      );

    // Match events for this team
    const teamEvents = await db
      .select()
      .from(matchEvents)
      .where(eq(matchEvents.teamId, teamId));

    const eventList = teamEvents
      .map((e) => ({
        id: e.id,
        matchId: e.matchId,
        eventType: e.eventType,
        playerName: e.playerName,
        assistPlayerName: e.assistPlayerName,
        minute: e.minute,
        detail: e.detail,
      }))
      .sort((a, b) => (a.matchId - b.matchId) || ((a.minute ?? 0) - (b.minute ?? 0)));

    // Points earned by this team
    const teamPoints = await db
      .select()
      .from(pointsLog)
      .where(eq(pointsLog.teamId, teamId));

    const pointsList = teamPoints.map((p) => ({
      id: p.id,
      source: p.source,
      points: p.points,
      note: p.note,
      matchId: p.matchId,
      createdAt: p.createdAt?.toISOString() ?? "",
    }));

    const totalPoints =
      Math.round(teamPoints.reduce((s, p) => s + p.points, 0) * 10) / 10;

    return NextResponse.json({
      team: {
        id: team.id,
        name: team.name,
        fifaCode: team.fifaCode,
        groupLetter: team.groupLetter,
        flagEmoji: team.flagEmoji ?? "🏳️",
        tier: team.tier,
        tierLabel: TIER_LABELS[team.tier] ?? "Unknown",
        eliminated: team.eliminated ?? false,
        bestFinish: team.bestFinish,
        fifaRanking: team.fifaRanking,
      },
      owner,
      standing: standing
        ? {
            position: standing.position,
            played: standing.played,
            won: standing.won,
            drawn: standing.drawn,
            lost: standing.lost,
            goalsFor: standing.goalsFor,
            goalsAgainst: standing.goalsAgainst,
            goalDifference: standing.goalDifference,
            points: standing.points,
            qualified: standing.qualified,
          }
        : null,
      matches: matchList,
      events: eventList,
      points: pointsList,
      totalPoints,
    });
  } catch (err) {
    console.error("[Team Detail]", err);
    return NextResponse.json(
      { error: "Failed to load team detail" },
      { status: 500 }
    );
  }
}
