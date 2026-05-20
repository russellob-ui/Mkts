import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import { predictions, matches, players } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

let tablesEnsured = false;

interface StreakInfo {
  playerId: number;
  playerName: string;
  avatarEmoji: string | null;
  color: string | null;
  currentStreak: number;
  bestStreak: number;
  lastResult: "correct" | "incorrect" | null;
  streakBonus: boolean;
}

export async function GET() {
  try {
    if (!tablesEnsured) {
      await ensureTables();
      tablesEnsured = true;
    }

    // Get all players
    const allPlayers = await db.select().from(players);

    // Get all resolved match_result predictions, joined with match kickoff for ordering
    const resolvedPreds = await db
      .select({
        predId: predictions.id,
        playerId: predictions.playerId,
        matchId: predictions.matchId,
        correct: predictions.correct,
        kickoff: matches.kickoff,
      })
      .from(predictions)
      .innerJoin(matches, eq(predictions.matchId, matches.id))
      .where(
        and(
          eq(predictions.predictionType, "match_result"),
          eq(predictions.resolved, true)
        )
      );

    // Sort by kickoff ascending
    resolvedPreds.sort(
      (a, b) =>
        (a.kickoff?.getTime() ?? 0) - (b.kickoff?.getTime() ?? 0)
    );

    // Group by player
    const predsByPlayer = new Map<
      number,
      Array<{ correct: boolean | null; kickoff: Date | null }>
    >();
    for (const pred of resolvedPreds) {
      const existing = predsByPlayer.get(pred.playerId) ?? [];
      existing.push({ correct: pred.correct, kickoff: pred.kickoff });
      predsByPlayer.set(pred.playerId, existing);
    }

    const playerById = new Map(allPlayers.map((p) => [p.id, p]));

    const streaks: StreakInfo[] = [];

    for (const player of allPlayers) {
      const playerPreds = predsByPlayer.get(player.id) ?? [];

      if (playerPreds.length === 0) {
        streaks.push({
          playerId: player.id,
          playerName: player.name,
          avatarEmoji: player.avatarEmoji,
          color: player.color,
          currentStreak: 0,
          bestStreak: 0,
          lastResult: null,
          streakBonus: false,
        });
        continue;
      }

      // Compute current streak (from most recent backwards)
      let currentStreak = 0;
      let lastResult: "correct" | "incorrect" | null = null;

      for (let i = playerPreds.length - 1; i >= 0; i--) {
        const pred = playerPreds[i];
        if (i === playerPreds.length - 1) {
          lastResult = pred.correct ? "correct" : "incorrect";
        }
        if (pred.correct) {
          currentStreak++;
        } else {
          break;
        }
      }

      // If the last prediction was wrong, current streak is 0
      if (lastResult === "incorrect") {
        currentStreak = 0;
      }

      // Compute best streak (all-time)
      let bestStreak = 0;
      let runningStreak = 0;

      for (const pred of playerPreds) {
        if (pred.correct) {
          runningStreak++;
          if (runningStreak > bestStreak) {
            bestStreak = runningStreak;
          }
        } else {
          runningStreak = 0;
        }
      }

      streaks.push({
        playerId: player.id,
        playerName: player.name,
        avatarEmoji: player.avatarEmoji,
        color: player.color,
        currentStreak,
        bestStreak,
        lastResult,
        streakBonus: currentStreak >= 5,
      });
    }

    // Sort by currentStreak DESC, then bestStreak DESC
    streaks.sort((a, b) => {
      if (b.currentStreak !== a.currentStreak)
        return b.currentStreak - a.currentStreak;
      return b.bestStreak - a.bestStreak;
    });

    return NextResponse.json({ streaks });
  } catch (err) {
    console.error("[Streaks GET]", err);
    return NextResponse.json(
      { error: "Failed to compute streaks" },
      { status: 500 }
    );
  }
}
