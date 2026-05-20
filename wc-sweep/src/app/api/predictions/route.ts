import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import {
  predictions,
  matches,
  wcTeams,
  players,
} from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

let tablesEnsured = false;

export async function GET(request: Request) {
  try {
    if (!tablesEnsured) {
      await ensureTables();
      tablesEnsured = true;
    }

    const url = new URL(request.url);
    const playerIdParam = url.searchParams.get("playerId");

    // All predictions, optionally filtered by player
    const allPredictions = playerIdParam
      ? await db
          .select()
          .from(predictions)
          .where(eq(predictions.playerId, Number(playerIdParam)))
      : await db.select().from(predictions);

    // Lookup tables
    const allMatches = await db.select().from(matches);
    const allTeams = await db.select().from(wcTeams);

    const matchById = new Map(allMatches.map((m) => [m.id, m]));
    const teamById = new Map(allTeams.map((t) => [t.id, t]));

    const enriched = allPredictions.map((p) => {
      const match = p.matchId ? matchById.get(p.matchId) : null;
      const homeTeam = match ? teamById.get(match.homeTeamId) : null;
      const awayTeam = match ? teamById.get(match.awayTeamId) : null;

      return {
        id: p.id,
        playerId: p.playerId,
        matchId: p.matchId,
        predictionType: p.predictionType,
        predictionValue: p.predictionValue,
        submittedAt: p.submittedAt?.toISOString() ?? "",
        resolved: p.resolved,
        correct: p.correct,
        pointsAwarded: p.pointsAwarded,
        resolvedAt: p.resolvedAt?.toISOString() ?? null,
        match: match
          ? {
              homeTeam: homeTeam?.name ?? "?",
              awayTeam: awayTeam?.name ?? "?",
              homeFlag: homeTeam?.flagEmoji ?? "🏳️",
              awayFlag: awayTeam?.flagEmoji ?? "🏳️",
              homeScore: match.homeScore,
              awayScore: match.awayScore,
              status: match.status,
              kickoff: match.kickoff?.toISOString() ?? "",
              stage: match.stage,
            }
          : null,
      };
    });

    return NextResponse.json({ predictions: enriched });
  } catch (err) {
    console.error("[Predictions GET]", err);
    return NextResponse.json(
      { error: "Failed to load predictions" },
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
    const { playerId, matchId, predictionType, predictionValue, passcode } =
      body;

    // Validate required fields
    if (!playerId || !matchId || !predictionType || !predictionValue) {
      return NextResponse.json(
        { error: "Missing required fields: playerId, matchId, predictionType, predictionValue" },
        { status: 400 }
      );
    }

    // Validate predictionValue
    if (!["home", "draw", "away"].includes(predictionValue)) {
      return NextResponse.json(
        { error: "predictionValue must be 'home', 'draw', or 'away'" },
        { status: 400 }
      );
    }

    // Verify passcode
    const [player] = await db
      .select()
      .from(players)
      .where(eq(players.id, Number(playerId)));

    if (!player) {
      return NextResponse.json(
        { error: "Player not found" },
        { status: 404 }
      );
    }

    if (player.passcode && player.passcode !== passcode) {
      return NextResponse.json(
        { error: "Invalid passcode" },
        { status: 403 }
      );
    }

    // Verify match exists and is still scheduled
    const [match] = await db
      .select()
      .from(matches)
      .where(eq(matches.id, Number(matchId)));

    if (!match) {
      return NextResponse.json(
        { error: "Match not found" },
        { status: 404 }
      );
    }

    if (match.status !== "scheduled") {
      return NextResponse.json(
        { error: "Cannot predict a match that has already started or finished" },
        { status: 400 }
      );
    }

    // Upsert prediction (ON CONFLICT update)
    const [result] = await db
      .insert(predictions)
      .values({
        playerId: Number(playerId),
        matchId: Number(matchId),
        predictionType,
        predictionValue,
        submittedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          predictions.playerId,
          predictions.matchId,
          predictions.predictionType,
        ],
        set: {
          predictionValue,
          submittedAt: new Date(),
        },
      })
      .returning();

    return NextResponse.json({ prediction: result });
  } catch (err) {
    console.error("[Predictions POST]", err);
    return NextResponse.json(
      { error: "Failed to save prediction" },
      { status: 500 }
    );
  }
}
