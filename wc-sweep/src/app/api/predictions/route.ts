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
    const { playerId, matchId, predictionType, predictionValue, passcode, confidence } =
      body;

    // Validate required fields
    if (!playerId || !matchId || !predictionType || predictionValue === undefined || predictionValue === null || predictionValue === "") {
      return NextResponse.json(
        { error: "Missing required fields: playerId, matchId, predictionType, predictionValue" },
        { status: 400 }
      );
    }

    // Validate predictionType and corresponding predictionValue
    const validTypes = ["match_result", "exact_score", "first_scorer", "confidence", "prop"];
    if (!validTypes.includes(predictionType)) {
      return NextResponse.json(
        { error: `predictionType must be one of: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    if (predictionType === "match_result" && !["home", "draw", "away"].includes(predictionValue)) {
      return NextResponse.json(
        { error: "predictionValue must be 'home', 'draw', or 'away' for match_result" },
        { status: 400 }
      );
    }

    if (predictionType === "exact_score") {
      // Must be in format "X-Y" where X and Y are non-negative integers
      const scoreRegex = /^\d+-\d+$/;
      if (!scoreRegex.test(predictionValue)) {
        return NextResponse.json(
          { error: "exact_score predictionValue must be in format 'X-Y' (e.g. '2-1')" },
          { status: 400 }
        );
      }
    }

    if (predictionType === "confidence") {
      const conf = Number(predictionValue);
      if (isNaN(conf) || conf < 1 || conf > 5 || !Number.isInteger(conf)) {
        return NextResponse.json(
          { error: "confidence predictionValue must be '1' to '5'" },
          { status: 400 }
        );
      }
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
        predictionValue: String(predictionValue),
        submittedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          predictions.playerId,
          predictions.matchId,
          predictions.predictionType,
        ],
        set: {
          predictionValue: String(predictionValue),
          submittedAt: new Date(),
        },
      })
      .returning();

    // If confidence is provided alongside a main prediction type, also upsert the confidence record
    if (confidence !== undefined && predictionType !== "confidence") {
      const conf = Number(confidence);
      if (!isNaN(conf) && conf >= 1 && conf <= 5) {
        await db
          .insert(predictions)
          .values({
            playerId: Number(playerId),
            matchId: Number(matchId),
            predictionType: "confidence",
            predictionValue: String(conf),
            submittedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [
              predictions.playerId,
              predictions.matchId,
              predictions.predictionType,
            ],
            set: {
              predictionValue: String(conf),
              submittedAt: new Date(),
            },
          });
      }
    }

    return NextResponse.json({ prediction: result });
  } catch (err) {
    console.error("[Predictions POST]", err);
    return NextResponse.json(
      { error: "Failed to save prediction" },
      { status: 500 }
    );
  }
}
