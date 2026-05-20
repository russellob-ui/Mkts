import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import {
  matches,
  matchEvents,
  wcTeams,
  teamAssignments,
  players,
  pointsLog,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
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
    const matchId = parseInt(id, 10);
    if (isNaN(matchId)) {
      return NextResponse.json({ error: "Invalid match ID" }, { status: 400 });
    }

    // Fetch the match
    const matchRows = await db
      .select()
      .from(matches)
      .where(eq(matches.id, matchId));

    if (matchRows.length === 0) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    const match = matchRows[0];

    // Lookup tables
    const allTeams = await db.select().from(wcTeams);
    const allAssignments = await db.select().from(teamAssignments);
    const allPlayers = await db.select().from(players);

    const teamById = new Map(allTeams.map((t) => [t.id, t]));
    const assignmentByTeamId = new Map(
      allAssignments.map((a) => [a.teamId, a])
    );
    const playerById = new Map(allPlayers.map((p) => [p.id, p]));

    const homeTeam = teamById.get(match.homeTeamId);
    const awayTeam = teamById.get(match.awayTeamId);

    const homeAssign = assignmentByTeamId.get(match.homeTeamId);
    const awayAssign = assignmentByTeamId.get(match.awayTeamId);
    const homeOwner = homeAssign
      ? playerById.get(homeAssign.playerId)
      : null;
    const awayOwner = awayAssign
      ? playerById.get(awayAssign.playerId)
      : null;

    // Match events sorted by minute
    const events = await db
      .select()
      .from(matchEvents)
      .where(eq(matchEvents.matchId, matchId));

    const sortedEvents = events
      .sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0))
      .map((e) => ({
        id: e.id,
        teamId: e.teamId,
        teamName: teamById.get(e.teamId)?.name ?? "?",
        teamFlag: teamById.get(e.teamId)?.flagEmoji ?? "🏳️",
        eventType: e.eventType,
        playerName: e.playerName,
        assistPlayerName: e.assistPlayerName,
        minute: e.minute,
        detail: e.detail,
      }));

    // Points earned in this match (from points_log)
    const matchPoints = await db
      .select()
      .from(pointsLog)
      .where(eq(pointsLog.matchId, matchId));

    const homePoints = matchPoints
      .filter((p) => p.teamId === match.homeTeamId)
      .map((p) => ({
        source: p.source,
        points: p.points,
        note: p.note,
        playerName: playerById.get(p.playerId)?.name ?? "?",
      }));

    const awayPoints = matchPoints
      .filter((p) => p.teamId === match.awayTeamId)
      .map((p) => ({
        source: p.source,
        points: p.points,
        note: p.note,
        playerName: playerById.get(p.playerId)?.name ?? "?",
      }));

    return NextResponse.json({
      match: {
        id: match.id,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        homePenalties: match.homePenalties,
        awayPenalties: match.awayPenalties,
        status: match.status,
        minute: match.minute,
        kickoff: match.kickoff?.toISOString() ?? "",
        venue: match.venue,
        city: match.city,
        stage: match.stage,
        groupLetter: match.groupLetter,
      },
      homeTeam: {
        id: homeTeam?.id,
        name: homeTeam?.name ?? "?",
        flagEmoji: homeTeam?.flagEmoji ?? "🏳️",
        fifaCode: homeTeam?.fifaCode ?? "?",
        tier: homeTeam?.tier ?? 1,
        tierLabel: TIER_LABELS[homeTeam?.tier ?? 1] ?? "Unknown",
        ownerName: homeOwner?.name ?? null,
        ownerColor: homeOwner?.color ?? null,
      },
      awayTeam: {
        id: awayTeam?.id,
        name: awayTeam?.name ?? "?",
        flagEmoji: awayTeam?.flagEmoji ?? "🏳️",
        fifaCode: awayTeam?.fifaCode ?? "?",
        tier: awayTeam?.tier ?? 1,
        tierLabel: TIER_LABELS[awayTeam?.tier ?? 1] ?? "Unknown",
        ownerName: awayOwner?.name ?? null,
        ownerColor: awayOwner?.color ?? null,
      },
      events: sortedEvents,
      homePoints,
      awayPoints,
    });
  } catch (err) {
    console.error("[Match Detail]", err);
    return NextResponse.json(
      { error: "Failed to load match" },
      { status: 500 }
    );
  }
}
