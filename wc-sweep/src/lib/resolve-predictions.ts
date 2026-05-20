import { db } from "@/db";
import {
  predictions,
  matches,
  wcTeams,
  pointsLog,
  teamAssignments,
} from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

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
  //    A penalty shootout means the 90min/ET result was a draw
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

  // 4. Find all unresolved predictions for this match
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

  let correctCount = 0;
  let incorrectCount = 0;

  for (const pred of unresolvedPreds) {
    const isCorrect = pred.predictionValue === actualResult;
    const pointsAwarded = isCorrect ? 2 : 0;

    if (isCorrect) {
      correctCount++;
    } else {
      incorrectCount++;
    }

    // 5. Update the prediction row
    await db
      .update(predictions)
      .set({
        resolved: true,
        correct: isCorrect,
        pointsAwarded,
        resolvedAt: new Date(),
      })
      .where(eq(predictions.id, pred.id));

    // 6. For correct predictions, insert into points_log
    if (isCorrect) {
      // Find any team this player owns (use first assignment for the team_id field)
      const [assignment] = await db
        .select()
        .from(teamAssignments)
        .where(eq(teamAssignments.playerId, pred.playerId));

      // Use homeTeamId as fallback — the points_log requires a teamId
      const teamIdForLog = assignment?.teamId ?? match.homeTeamId;

      await db
        .insert(pointsLog)
        .values({
          playerId: pred.playerId,
          teamId: teamIdForLog,
          matchId: match.id,
          source: "prediction",
          points: 2,
          note: `Correct: ${homeName} vs ${awayName} → ${resultLabel}`,
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
