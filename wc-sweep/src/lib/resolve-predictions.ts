import { db } from "@/db";
import {
  predictions,
  matches,
  wcTeams,
  pointsLog,
  teamAssignments,
  matchEvents,
} from "@/db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";

/** Confidence multiplier: confidence 1=1x, 2=1.25x, 3=1.5x, 4=1.75x, 5=2x */
function getConfidenceMultiplier(confidence: number): number {
  const map: Record<number, number> = { 1: 1, 2: 1.25, 3: 1.5, 4: 1.75, 5: 2 };
  return map[confidence] ?? 1;
}

/** Penalty for wrong prediction with confidence: deduct (confidence - 1) points */
function getConfidencePenalty(confidence: number): number {
  return Math.max(0, confidence - 1);
}

export async function resolvePredictions(matchId: number) {
  // 1. Read the match — must be finished
  const [match] = await db
    .select()
    .from(matches)
    .where(eq(matches.id, matchId));

  if (!match) {
    throw new Error(`Match ${matchId} not found`);
  }

  if (match.status !== "finished") {
    throw new Error(
      `Match ${matchId} is not finished (status: ${match.status})`
    );
  }

  if (match.homeScore === null || match.awayScore === null) {
    throw new Error(`Match ${matchId} has no score data`);
  }

  // 2. Determine actual result (based on 90min/ET score, NOT penalties)
  let actualResult: "home" | "draw" | "away";
  if (match.homeScore > match.awayScore) {
    actualResult = "home";
  } else if (match.awayScore > match.homeScore) {
    actualResult = "away";
  } else {
    actualResult = "draw";
  }

  // 3. Get team names for the note
  const [homeTeam] = await db
    .select()
    .from(wcTeams)
    .where(eq(wcTeams.id, match.homeTeamId));
  const [awayTeam] = await db
    .select()
    .from(wcTeams)
    .where(eq(wcTeams.id, match.awayTeamId));

  const homeName = homeTeam?.name ?? "?";
  const awayName = awayTeam?.name ?? "?";

  const resultLabel =
    actualResult === "home"
      ? "home win"
      : actualResult === "away"
        ? "away win"
        : "draw";

  // 4. Get first goal scorer from match events
  const goalEvents = await db
    .select()
    .from(matchEvents)
    .where(
      and(
        eq(matchEvents.matchId, matchId),
        sql`${matchEvents.eventType} IN ('goal', 'penalty_goal')`
      )
    );

  // Sort by minute, take the first
  goalEvents.sort((a, b) => (a.minute ?? 999) - (b.minute ?? 999));
  const firstGoalScorer = goalEvents.length > 0 ? goalEvents[0].playerName : null;

  // 5. Find all unresolved predictions for this match
  const unresolvedPreds = await db
    .select()
    .from(predictions)
    .where(
      and(
        eq(predictions.matchId, matchId),
        eq(predictions.resolved, false)
      )
    );

  if (unresolvedPreds.length === 0) {
    return { resolved: 0, correct: 0, incorrect: 0 };
  }

  // Group predictions by player to find confidence values
  const predsByPlayer = new Map<number, typeof unresolvedPreds>();
  for (const pred of unresolvedPreds) {
    const existing = predsByPlayer.get(pred.playerId) ?? [];
    existing.push(pred);
    predsByPlayer.set(pred.playerId, existing);
  }

  // Also check already-resolved confidence predictions for this match
  const allConfPreds = await db
    .select()
    .from(predictions)
    .where(
      and(
        eq(predictions.matchId, matchId),
        eq(predictions.predictionType, "confidence")
      )
    );
  const confidenceByPlayer = new Map<number, number>();
  for (const cp of allConfPreds) {
    confidenceByPlayer.set(cp.playerId, Number(cp.predictionValue) || 1);
  }

  let correctCount = 0;
  let incorrectCount = 0;

  for (const pred of unresolvedPreds) {
    // Skip confidence rows — they are metadata, not scored directly
    if (pred.predictionType === "confidence") {
      await db
        .update(predictions)
        .set({
          resolved: true,
          correct: null,
          pointsAwarded: 0,
          resolvedAt: new Date(),
        })
        .where(eq(predictions.id, pred.id));
      continue;
    }

    const confidence = confidenceByPlayer.get(pred.playerId) ?? 1;
    const multiplier = getConfidenceMultiplier(confidence);
    const penalty = getConfidencePenalty(confidence);

    let isCorrect = false;
    let basePoints = 0;
    let note = "";

    if (pred.predictionType === "match_result") {
      isCorrect = pred.predictionValue === actualResult;
      basePoints = isCorrect ? 2 : 0;
      note = isCorrect
        ? `Correct result: ${homeName} vs ${awayName} → ${resultLabel}`
        : `Wrong result: ${homeName} vs ${awayName} → predicted ${pred.predictionValue}`;
    } else if (pred.predictionType === "exact_score") {
      const predictedScore = pred.predictionValue; // e.g. "2-1"
      const [predHome, predAway] = predictedScore.split("-").map(Number);
      const actualScore = `${match.homeScore}-${match.awayScore}`;

      if (predictedScore === actualScore) {
        // Exact match: +5
        isCorrect = true;
        basePoints = 5;
        note = `Exact score: ${predictedScore} = ${actualScore}`;
      } else {
        // Check correct goal difference
        const predDiff = predHome - predAway;
        const actualDiff = match.homeScore - match.awayScore;

        // Check correct result
        const predResult = predHome > predAway ? "home" : predHome < predAway ? "away" : "draw";

        if (predDiff === actualDiff && predResult === actualResult) {
          // Correct goal difference (and correct result): +3
          isCorrect = true;
          basePoints = 3;
          note = `Correct goal difference: predicted ${predictedScore}, actual ${actualScore}`;
        } else if (predResult === actualResult) {
          // Correct result only: +2
          isCorrect = true;
          basePoints = 2;
          note = `Correct result from score: predicted ${predictedScore}, actual ${actualScore}`;
        } else {
          isCorrect = false;
          basePoints = 0;
          note = `Wrong score: predicted ${predictedScore}, actual ${actualScore}`;
        }
      }
    } else if (pred.predictionType === "first_scorer") {
      if (firstGoalScorer) {
        // Case-insensitive comparison
        isCorrect =
          pred.predictionValue.toLowerCase().trim() ===
          firstGoalScorer.toLowerCase().trim();
        basePoints = isCorrect ? 3 : 0;
        note = isCorrect
          ? `Correct first scorer: ${firstGoalScorer}`
          : `Wrong first scorer: predicted ${pred.predictionValue}, actual ${firstGoalScorer}`;
      } else {
        // No goals scored — no one can be correct
        isCorrect = false;
        basePoints = 0;
        note = `No goals scored — first scorer prediction void`;
      }
    } else if (pred.predictionType === "prop") {
      // Props are resolved separately
      continue;
    }

    // Apply confidence multiplier / penalty
    let pointsAwarded: number;
    if (isCorrect) {
      pointsAwarded = Math.round(basePoints * multiplier * 100) / 100;
      correctCount++;
    } else {
      pointsAwarded = -penalty;
      incorrectCount++;
    }

    // 6. Update the prediction row
    await db
      .update(predictions)
      .set({
        resolved: true,
        correct: isCorrect,
        pointsAwarded,
        resolvedAt: new Date(),
      })
      .where(eq(predictions.id, pred.id));

    // 7. For scored predictions (positive or negative), insert into points_log
    if (pointsAwarded !== 0) {
      // Find any team this player owns (use first assignment for the team_id field)
      const [assignment] = await db
        .select()
        .from(teamAssignments)
        .where(eq(teamAssignments.playerId, pred.playerId));

      // Use homeTeamId as fallback — the points_log requires a teamId
      const teamIdForLog = assignment?.teamId ?? match.homeTeamId;

      const source = `prediction_${pred.predictionType}`;

      await db
        .insert(pointsLog)
        .values({
          playerId: pred.playerId,
          teamId: teamIdForLog,
          matchId: match.id,
          source,
          points: pointsAwarded,
          note: `${note}${confidence > 1 ? ` (confidence ${confidence}x)` : ""}`,
        })
        .onConflictDoNothing();
    }
  }

  return {
    resolved: unresolvedPreds.length,
    correct: correctCount,
    incorrect: incorrectCount,
  };
}
