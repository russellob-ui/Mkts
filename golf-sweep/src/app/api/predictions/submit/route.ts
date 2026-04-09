import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import {
  players,
  picks,
  rounds,
  roundScores,
  roundPredictions,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    await ensureTables();

    const { playerPasscode, tournamentId, roundNumber, predictions } =
      await request.json();

    if (!playerPasscode || !tournamentId || !roundNumber || !predictions) {
      return NextResponse.json(
        { error: "playerPasscode, tournamentId, roundNumber, and predictions are required" },
        { status: 400 }
      );
    }

    // Validate passcode
    const allPlayers = await db.select().from(players);
    const player = allPlayers.find((p) => p.passcode === playerPasscode);
    if (!player) {
      return NextResponse.json({ error: "Invalid passcode" }, { status: 401 });
    }

    // Check deadline: reject if any picked golfer for this tournament has thru >= 1
    const tournamentRounds = await db
      .select()
      .from(rounds)
      .where(
        and(
          eq(rounds.tournamentId, tournamentId),
          eq(rounds.roundNumber, roundNumber)
        )
      );
    const round = tournamentRounds[0];
    if (round) {
      // Get all golfer IDs picked for this tournament
      const tournamentPicks = await db
        .select()
        .from(picks)
        .where(eq(picks.tournamentId, tournamentId));
      const pickedGolferIds = tournamentPicks.map((p) => p.golferId);

      // Check if any picked golfer has started this round
      const scores = await db
        .select()
        .from(roundScores)
        .where(eq(roundScores.roundId, round.id));

      const hasStarted = scores.some(
        (s) =>
          pickedGolferIds.includes(s.golferId) &&
          s.thru !== null &&
          s.thru !== "0" &&
          parseInt(s.thru) >= 1
      );

      if (hasStarted) {
        return NextResponse.json(
          { error: "Deadline passed: round has already started" },
          { status: 400 }
        );
      }
    }

    // Must submit exactly 7 predictions (all other players)
    if (predictions.length !== 7) {
      return NextResponse.json(
        { error: "Must submit exactly 7 predictions (one for each other player)" },
        { status: 400 }
      );
    }

    // Insert predictions
    const inserted = [];
    for (const pred of predictions) {
      const [row] = await db
        .insert(roundPredictions)
        .values({
          predictorPlayerId: player.id,
          subjectPlayerId: pred.subjectPlayerId,
          tournamentId,
          roundNumber,
          predictedScoreToPar: pred.scoreToPar,
          predictedOutcome: pred.outcome,
        })
        .returning();
      inserted.push(row);
    }

    return NextResponse.json({ success: true, predictions: inserted });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
