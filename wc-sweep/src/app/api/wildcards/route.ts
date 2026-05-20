import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import {
  players,
  wcTeams,
  matches,
  teamAssignments,
  pointsLog,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";

let tablesEnsured = false;

const WILDCARD_SOURCE = "wildcard_activated";

export async function GET(request: Request) {
  try {
    if (!tablesEnsured) {
      await ensureTables();
      tablesEnsured = true;
    }

    const { searchParams } = new URL(request.url);
    const playerIdStr = searchParams.get("playerId");

    if (!playerIdStr) {
      return NextResponse.json(
        { error: "playerId query parameter required" },
        { status: 400 }
      );
    }

    const playerId = parseInt(playerIdStr, 10);
    if (isNaN(playerId)) {
      return NextResponse.json(
        { error: "Invalid playerId" },
        { status: 400 }
      );
    }

    // Check if this player has used their wildcard
    const wildcardEntries = await db
      .select()
      .from(pointsLog)
      .where(
        and(
          eq(pointsLog.playerId, playerId),
          eq(pointsLog.source, WILDCARD_SOURCE)
        )
      );

    if (wildcardEntries.length === 0) {
      return NextResponse.json({
        hasUsed: false,
        usedOnMatchId: null,
        matchName: null,
      });
    }

    const entry = wildcardEntries[0];
    let matchName: string | null = null;

    if (entry.matchId != null) {
      const matchRows = await db
        .select()
        .from(matches)
        .where(eq(matches.id, entry.matchId));
      if (matchRows.length > 0) {
        const m = matchRows[0];
        const allTeams = await db.select().from(wcTeams);
        const teamById = new Map(allTeams.map((t) => [t.id, t]));
        const home = teamById.get(m.homeTeamId);
        const away = teamById.get(m.awayTeamId);
        matchName = `${home?.flagEmoji ?? ""} ${home?.name ?? "?"} vs ${away?.name ?? "?"} ${away?.flagEmoji ?? ""}`;
      }
    }

    return NextResponse.json({
      hasUsed: true,
      usedOnMatchId: entry.matchId,
      matchName,
    });
  } catch (err) {
    console.error("[Wildcards GET]", err);
    return NextResponse.json(
      { error: "Failed to check wildcard status" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    if (!tablesEnsured) {
      await ensureTables();
      tablesEnsured = true;
    }

    const body = await request.json();
    const { playerId, matchId, passcode } = body;

    if (!playerId || !matchId || !passcode) {
      return NextResponse.json(
        { error: "playerId, matchId, and passcode are required" },
        { status: 400 }
      );
    }

    // Verify player and passcode
    const playerRows = await db
      .select()
      .from(players)
      .where(eq(players.id, playerId));

    if (playerRows.length === 0) {
      return NextResponse.json(
        { error: "Player not found" },
        { status: 404 }
      );
    }

    const player = playerRows[0];
    if (player.passcode && player.passcode !== passcode) {
      return NextResponse.json(
        { error: "Incorrect passcode" },
        { status: 403 }
      );
    }

    // Check if wildcard already used
    const existing = await db
      .select()
      .from(pointsLog)
      .where(
        and(
          eq(pointsLog.playerId, playerId),
          eq(pointsLog.source, WILDCARD_SOURCE)
        )
      );

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "Wildcard already used" },
        { status: 409 }
      );
    }

    // Verify match exists and is scheduled
    const matchRows = await db
      .select()
      .from(matches)
      .where(eq(matches.id, matchId));

    if (matchRows.length === 0) {
      return NextResponse.json(
        { error: "Match not found" },
        { status: 404 }
      );
    }

    const match = matchRows[0];
    if (match.status !== "scheduled") {
      return NextResponse.json(
        { error: "Match has already started or finished" },
        { status: 400 }
      );
    }

    // Find a team in this match that belongs to this player (for the teamId column)
    const playerAssignments = await db
      .select()
      .from(teamAssignments)
      .where(eq(teamAssignments.playerId, playerId));

    const playerTeamIds = new Set(playerAssignments.map((a) => a.teamId));
    let wildcardTeamId = match.homeTeamId;
    if (playerTeamIds.has(match.homeTeamId)) {
      wildcardTeamId = match.homeTeamId;
    } else if (playerTeamIds.has(match.awayTeamId)) {
      wildcardTeamId = match.awayTeamId;
    } else {
      // Player doesn't own either team in this match, use homeTeamId as reference
      wildcardTeamId = match.homeTeamId;
    }

    // Insert wildcard activation record
    await db.insert(pointsLog).values({
      playerId,
      teamId: wildcardTeamId,
      matchId,
      source: WILDCARD_SOURCE,
      points: 0, // Points will be applied when match is scored
      note: "Double Points wildcard activated",
    });

    return NextResponse.json({
      success: true,
      message: "Wildcard activated! All points from this match will be doubled.",
    });
  } catch (err) {
    console.error("[Wildcards POST]", err);
    return NextResponse.json(
      { error: "Failed to activate wildcard" },
      { status: 500 }
    );
  }
}
