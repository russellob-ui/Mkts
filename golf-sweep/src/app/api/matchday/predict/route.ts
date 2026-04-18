import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import { sql } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    await ensureTables();
    const body = await request.json();
    const {
      matchId,
      playerId,
      predictedHomeScore,
      predictedAwayScore,
      firstScorer,
      firstGoalMinute,
      totalCorners,
      totalCards,
    } = body;

    if (!matchId || !playerId) {
      return NextResponse.json(
        { error: "matchId and playerId are required" },
        { status: 400 }
      );
    }

    // Check match is still upcoming
    const matches = await db.execute(
      sql`SELECT status FROM football_matches WHERE id = ${matchId}`
    );
    const match = Array.from(matches as Iterable<Record<string, unknown>>)[0] as Record<string, unknown>;
    if (match?.status !== "upcoming") {
      return NextResponse.json(
        { error: "Predictions are closed — match has started" },
        { status: 400 }
      );
    }

    // Upsert prediction
    await db.execute(
      sql`DELETE FROM football_predictions WHERE match_id = ${matchId} AND player_id = ${playerId}`
    );
    await db.execute(
      sql`INSERT INTO football_predictions (match_id, player_id, predicted_home_score, predicted_away_score, first_scorer, first_goal_minute, total_corners, total_cards)
          VALUES (${matchId}, ${playerId}, ${predictedHomeScore ?? null}, ${predictedAwayScore ?? null}, ${firstScorer ?? null}, ${firstGoalMinute ?? null}, ${totalCorners ?? null}, ${totalCards ?? null})`
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
