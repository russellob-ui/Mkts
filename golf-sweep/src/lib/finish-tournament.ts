import { db } from "@/db";
import {
  tournaments,
  picks,
  tournamentResults,
  pointsLog,
  players,
  golfers,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getFinishPoints } from "@/lib/points";

export interface FinishSummary {
  tournamentId: number;
  tournamentName: string;
  alreadyFinished: boolean;
  awarded: Array<{
    playerId: number;
    playerName: string;
    golferId: number;
    golferName: string;
    position: string | null;
    points: number;
  }>;
  winner: {
    playerId: number;
    playerName: string;
    golferId: number;
    golferName: string;
    scoreToPar: number | null;
  } | null;
}

/**
 * Idempotent end-of-tournament settlement.
 *
 * - Flips tournament.status to "finished"
 * - Reads tournament_results (populated by the regular poll)
 * - Awards finishing-position points via points_log (source="finish")
 * - Skips any player who already has a "finish" points_log row for this
 *   tournament, so calling this twice is safe.
 *
 * Returns a summary suitable for logging / posting to chat.
 */
export async function finishTournament(
  tournamentId: number
): Promise<FinishSummary> {
  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId));

  if (!tournament) {
    throw new Error(`Tournament ${tournamentId} not found`);
  }

  const alreadyFinished = tournament.status === "finished";

  // Flip the switch (idempotent — no-op if already finished)
  if (!alreadyFinished) {
    await db
      .update(tournaments)
      .set({ status: "finished" })
      .where(eq(tournaments.id, tournamentId));
  }

  const allPlayers = await db.select().from(players);
  const allGolfers = await db.select().from(golfers);

  const tournamentPicks = await db
    .select()
    .from(picks)
    .where(eq(picks.tournamentId, tournamentId));

  // Which players already have finish points for this tournament?
  // Filters double-awarding on repeat invocation.
  const existingFinishLogs = await db
    .select()
    .from(pointsLog)
    .where(
      and(
        eq(pointsLog.tournamentId, tournamentId),
        eq(pointsLog.source, "finish")
      )
    );
  const alreadyAwarded = new Set(existingFinishLogs.map((l) => l.playerId));

  const awarded: FinishSummary["awarded"] = [];
  let winner: FinishSummary["winner"] = null;

  for (const pick of tournamentPicks) {
    const player = allPlayers.find((p) => p.id === pick.playerId);
    const golfer = allGolfers.find((g) => g.id === pick.golferId);
    if (!player || !golfer) continue;

    const [result] = await db
      .select()
      .from(tournamentResults)
      .where(
        and(
          eq(tournamentResults.golferId, pick.golferId),
          eq(tournamentResults.tournamentId, tournamentId)
        )
      );

    const points = getFinishPoints(result?.finalPosition ?? null);

    // Track winner (whichever pick has finalPosition "1")
    const posStr = (result?.finalPosition ?? "").toUpperCase().replace(/^T/, "");
    if (posStr === "1") {
      winner = {
        playerId: player.id,
        playerName: player.name,
        golferId: golfer.id,
        golferName: golfer.name,
        scoreToPar: result?.finalScoreToPar ?? null,
      };
    }

    if (points > 0 && !alreadyAwarded.has(pick.playerId)) {
      await db.insert(pointsLog).values({
        playerId: pick.playerId,
        tournamentId,
        source: "finish",
        points,
        note: `Finished ${result?.finalPosition ?? "-"}`,
      });
    }

    awarded.push({
      playerId: player.id,
      playerName: player.name,
      golferId: golfer.id,
      golferName: golfer.name,
      position: result?.finalPosition ?? null,
      points,
    });
  }

  // Sort the summary by points DESC so the winner is at the top
  awarded.sort((a, b) => b.points - a.points);

  return {
    tournamentId,
    tournamentName: tournament.name,
    alreadyFinished,
    awarded,
    winner,
  };
}

/**
 * Heuristic: is this Slash Golf response an "official" end-of-tournament state?
 *
 * The API returns top-level fields:
 *   - roundId       (int) current round (1..4)
 *   - roundStatus   (string) "Not Started" | "Groupings Official" | "In Progress"
 *                            | "Suspended" | "Complete" | "Official"
 *
 * We only treat the tournament as over when BOTH hold:
 *   - roundId === 4  (playing the final round)
 *   - roundStatus === "Official"  (the round is signed off)
 *
 * That avoids false positives mid-R4.
 */
export function isTournamentOfficiallyOver(
  topLevelRoundId: number | null,
  topLevelRoundStatus: string | null | undefined
): boolean {
  if (topLevelRoundId !== 4) return false;
  const s = (topLevelRoundStatus ?? "").toLowerCase();
  return s === "official";
}
