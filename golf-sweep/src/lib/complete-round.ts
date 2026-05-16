import { db } from "@/db";
import {
  tournaments,
  picks,
  rounds,
  roundScores,
  tournamentResults,
  pointsLog,
  golfers,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { calcRoundOfDay, calcBestOfRound, calcEagleBonuses } from "@/lib/points";
import {
  getScorecard,
  analyzeScorecardRound,
  getGolfSeasonYear,
} from "@/lib/slashgolf";

export interface RoundCompleteSummary {
  tournamentId: number;
  roundNumber: number;
  alreadyComplete: boolean;
  rotd: Array<{ playerId: number; golferId: number; points: number }>;
  bor: Array<{ playerId: number; golferId: number; points: number }>;
  eagleBonuses: Array<{ playerId: number; golferId: number; points: number }>;
}

/**
 * Idempotent per-round settlement.
 *
 * - Flips rounds[roundNumber].status → "finished" (if not already)
 * - Awards Round of the Day bonus (+5 / split on ties) to the picked
 *   golfer(s) with the lowest round score
 * - Awards Best of Round bonus (+2 / split on ties) to the picked
 *   golfer(s) with the lowest cumulative score
 * - Skips any player who already has a points_log row with source "rotd"
 *   or "bor" for this specific round, so re-running is a no-op.
 */
export async function completeRound(
  tournamentId: number,
  roundNumber: number
): Promise<RoundCompleteSummary> {
  const [round] = await db
    .select()
    .from(rounds)
    .where(
      and(
        eq(rounds.tournamentId, tournamentId),
        eq(rounds.roundNumber, roundNumber)
      )
    );

  if (!round) {
    throw new Error(
      `Round ${roundNumber} not found for tournament ${tournamentId}`
    );
  }

  // Check if we already awarded bonuses for this round.
  const existingRoundLogs = await db
    .select()
    .from(pointsLog)
    .where(
      and(
        eq(pointsLog.tournamentId, tournamentId),
        eq(pointsLog.source, "rotd")
      )
    );
  const noteSuffix = `round ${roundNumber}`;
  const hasRotdForThisRound = existingRoundLogs.some((l) =>
    (l.note ?? "").toLowerCase().includes(noteSuffix)
  );

  const existingBorLogs = await db
    .select()
    .from(pointsLog)
    .where(
      and(
        eq(pointsLog.tournamentId, tournamentId),
        eq(pointsLog.source, "bor")
      )
    );
  const hasBorForThisRound = existingBorLogs.some((l) =>
    (l.note ?? "").toLowerCase().includes(noteSuffix)
  );

  const alreadyComplete =
    round.status === "finished" && hasRotdForThisRound && hasBorForThisRound;

  // Flip round status (no-op if already finished)
  if (round.status !== "finished") {
    await db
      .update(rounds)
      .set({ status: "finished" })
      .where(eq(rounds.id, round.id));
  }

  // Advance the next round to "live" if it exists and is still upcoming.
  // (Doesn't apply to round 4 — tournament finish handles that.)
  if (roundNumber < 4) {
    const [nextRound] = await db
      .select()
      .from(rounds)
      .where(
        and(
          eq(rounds.tournamentId, tournamentId),
          eq(rounds.roundNumber, roundNumber + 1)
        )
      );
    if (nextRound && nextRound.status === "upcoming") {
      await db
        .update(rounds)
        .set({ status: "live" })
        .where(eq(rounds.id, nextRound.id));
    }
  }

  const tournamentPicks = await db
    .select()
    .from(picks)
    .where(eq(picks.tournamentId, tournamentId));

  // --- Guard: don't award bonuses if no scores exist for this round.
  // The self-heal calls completeRound for R1-R4 on every request, but
  // R2-R4 won't have data until those rounds are actually played.
  let totalScoresForRound = 0;
  for (const pick of tournamentPicks) {
    const [score] = await db
      .select()
      .from(roundScores)
      .where(
        and(
          eq(roundScores.golferId, pick.golferId),
          eq(roundScores.roundId, round.id)
        )
      );
    if (score?.scoreToPar != null) totalScoresForRound++;
  }
  if (totalScoresForRound === 0) {
    return {
      tournamentId,
      roundNumber,
      alreadyComplete,
      rotd: [],
      bor: [],
      eagleBonuses: [],
    };
  }

  // --- Round of the Day (+5, on lowest round score among our picks)
  const rotdResults: RoundCompleteSummary["rotd"] = [];
  if (!hasRotdForThisRound) {
    const roundScoreRows: Array<{
      golferId: number;
      playerId: number;
      scoreToPar: number | null;
    }> = [];
    for (const pick of tournamentPicks) {
      const [score] = await db
        .select()
        .from(roundScores)
        .where(
          and(
            eq(roundScores.golferId, pick.golferId),
            eq(roundScores.roundId, round.id)
          )
        );
      roundScoreRows.push({
        golferId: pick.golferId,
        playerId: pick.playerId,
        scoreToPar: score?.scoreToPar ?? null,
      });
    }
    const rotdMap = calcRoundOfDay(roundScoreRows);
    for (const [golferId, bonus] of rotdMap) {
      const pick = tournamentPicks.find((p) => p.golferId === golferId);
      if (!pick) continue;
      await db.insert(pointsLog).values({
        playerId: pick.playerId,
        tournamentId,
        source: "rotd",
        points: bonus,
        note: `Round ${roundNumber} of the day`,
      });
      rotdResults.push({ playerId: pick.playerId, golferId, points: bonus });
    }
  }

  // --- Best of Round (+2, on lowest cumulative to par among our picks)
  //
  // IMPORTANT: cumulative-at-this-round-end must be computed by SUMMING
  // per-round scores from round_scores, NOT read from
  // tournamentResults.finalScoreToPar — that field is always the latest
  // cumulative (end of R4 after a poll), so using it would backfill R1
  // BOR using R4 totals and pick the wrong leader.
  const borResults: RoundCompleteSummary["bor"] = [];
  if (!hasBorForThisRound) {
    const allRoundRows = await db
      .select()
      .from(rounds)
      .where(eq(rounds.tournamentId, tournamentId));

    const cumScores: Array<{ golferId: number; totalToPar: number | null }> = [];
    for (const pick of tournamentPicks) {
      let cumulative = 0;
      let hasAny = false;
      for (let r = 1; r <= roundNumber; r++) {
        const rr = allRoundRows.find((x) => x.roundNumber === r);
        if (!rr) continue;
        const [score] = await db
          .select()
          .from(roundScores)
          .where(
            and(
              eq(roundScores.golferId, pick.golferId),
              eq(roundScores.roundId, rr.id)
            )
          );
        if (score?.scoreToPar != null) {
          cumulative += score.scoreToPar;
          hasAny = true;
        }
      }
      cumScores.push({
        golferId: pick.golferId,
        totalToPar: hasAny ? cumulative : null,
      });
    }

    const borMap = calcBestOfRound(cumScores);
    for (const [golferId, bonus] of borMap) {
      const pick = tournamentPicks.find((p) => p.golferId === golferId);
      if (!pick) continue;
      await db.insert(pointsLog).values({
        playerId: pick.playerId,
        tournamentId,
        source: "bor",
        points: bonus,
        note: `Best of round ${roundNumber}`,
      });
      borResults.push({ playerId: pick.playerId, golferId, points: bonus });
    }
  }

  // --- Eagle Bonus (+2 per eagle, +5 per albatross)
  // Check for existing eagle_bonus entries for this round to stay idempotent.
  const existingEagleLogs = await db
    .select()
    .from(pointsLog)
    .where(
      and(
        eq(pointsLog.tournamentId, tournamentId),
        eq(pointsLog.source, "eagle_bonus")
      )
    );
  const hasEagleBonusForThisRound = existingEagleLogs.some((l) =>
    (l.note ?? "").toLowerCase().includes(noteSuffix)
  );

  const eagleBonusResults: RoundCompleteSummary["eagleBonuses"] = [];
  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId));

  if (!hasEagleBonusForThisRound && tournament?.slashTournId) {
    const year = getGolfSeasonYear();
    const allGolfers = await db.select().from(golfers);

    for (const pick of tournamentPicks) {
      const golfer = allGolfers.find((g) => g.id === pick.golferId);
      if (!golfer?.slashPlayerId) continue;

      try {
        const scorecardRounds = await getScorecard(
          tournament.slashTournId,
          year,
          golfer.slashPlayerId,
          roundNumber
        );

        // Only process the specific round we're completing
        const thisRound = scorecardRounds.find(
          (r) => r.roundId === roundNumber
        );
        if (!thisRound || thisRound.holes.length === 0) continue;

        const analysis = analyzeScorecardRound(thisRound);
        const bonus = calcEagleBonuses([
          {
            eagles: analysis.eagles.length,
            albatross: analysis.albatross.length,
          },
        ]);

        if (bonus > 0) {
          const parts: string[] = [];
          if (analysis.eagles.length > 0)
            parts.push(
              `${analysis.eagles.length} eagle${analysis.eagles.length > 1 ? "s" : ""}`
            );
          if (analysis.albatross.length > 0)
            parts.push(
              `${analysis.albatross.length} albatross`
            );

          await db.insert(pointsLog).values({
            playerId: pick.playerId,
            tournamentId,
            source: "eagle_bonus",
            points: bonus,
            note: `${parts.join(", ")} in round ${roundNumber}`,
          });
          eagleBonusResults.push({
            playerId: pick.playerId,
            golferId: pick.golferId,
            points: bonus,
          });
        }
      } catch (err) {
        console.error(
          `[EagleBonus] Failed to fetch scorecard for golfer ${golfer.name}:`,
          err
        );
        // Non-fatal — continue to next pick
      }
    }
  }

  return {
    tournamentId,
    roundNumber,
    alreadyComplete,
    rotd: rotdResults,
    bor: borResults,
    eagleBonuses: eagleBonusResults,
  };
}

/**
 * Heuristic: is a given round officially "over" according to Slash Golf?
 *
 * The top-level roundStatus is the signal, but it only describes the
 * CURRENT round (topRoundId). So we use it two ways:
 *   - For rounds BEFORE topRoundId: those are definitively over, the
 *     tournament has moved past them.
 *   - For the CURRENT round: only over if roundStatus is "Complete"
 *     or "Official".
 */
export function roundsThatShouldBeComplete(
  topRoundId: number | null,
  topRoundStatus: string | null
): number[] {
  if (!topRoundId) return [];
  const complete: number[] = [];
  // All prior rounds are unambiguously done
  for (let r = 1; r < topRoundId; r++) {
    complete.push(r);
  }
  // The current round is done only if the status says so
  const s = (topRoundStatus ?? "").toLowerCase();
  if (s === "complete" || s === "official") {
    complete.push(topRoundId);
  }
  return complete;
}
