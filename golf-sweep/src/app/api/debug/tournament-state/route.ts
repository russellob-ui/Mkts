import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import {
  tournaments,
  picks,
  players,
  golfers,
  tournamentResults,
  pointsLog,
} from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getLeaderboard, unwrapBson } from "@/lib/slashgolf";
import { isTournamentOfficiallyOver } from "@/lib/finish-tournament";
import { getFinishPoints } from "@/lib/points";

export const dynamic = "force-dynamic";

/**
 * GET /api/debug/tournament-state
 *
 * Everything you need to know to answer "why isn't the tournament marked
 * finished / why are points missing?":
 *   - the DB's view of the tournament (status, lastPolledAt, id)
 *   - the Slash Golf API's view (roundId, roundStatus — the exact values
 *     our auto-detector is reading, before + after BSON unwrap)
 *   - whether isTournamentOfficiallyOver would fire right now
 *   - each pick's current finalPosition, finish points (would-award),
 *     and whether a points_log row already exists for them
 */
export async function GET() {
  try {
    await ensureTables();

    const allTournaments = await db.select().from(tournaments);
    const live = allTournaments.find((t) => t.status === "live");
    const recentFinished = allTournaments
      .filter((t) => t.status === "finished")
      .sort((a, b) => b.id - a.id)[0];
    const tournament = live ?? recentFinished ?? allTournaments[0];

    if (!tournament) {
      return NextResponse.json({ error: "No tournaments in DB" });
    }

    // --- Slash Golf view ---------------------------------------------------
    let apiDebug: Record<string, unknown> = { attempted: false };
    if (tournament.slashTournId && process.env.RAPIDAPI_KEY) {
      try {
        const lbRaw = await getLeaderboard(tournament.slashTournId, 2026);
        const lbRoot = lbRaw as Record<string, unknown>;
        const rawRoundId = lbRoot.roundId;
        const unwrappedRoundId = unwrapBson(rawRoundId);
        const numericRoundId = Number(unwrappedRoundId) || null;
        const roundStatus =
          typeof lbRoot.roundStatus === "string" ? lbRoot.roundStatus : null;
        apiDebug = {
          attempted: true,
          rawRoundId, // e.g. { $numberInt: "4" }
          unwrappedRoundId, // e.g. 4
          numericRoundId, // e.g. 4
          roundStatus, // e.g. "Official"
          isOfficiallyOver: isTournamentOfficiallyOver(
            numericRoundId,
            roundStatus
          ),
        };
      } catch (err) {
        apiDebug = { attempted: true, error: String(err) };
      }
    } else {
      apiDebug = {
        attempted: false,
        reason: !tournament.slashTournId ? "no slashTournId" : "no RAPIDAPI_KEY",
      };
    }

    // --- Picks + results + points view ------------------------------------
    const tournamentPicks = await db
      .select()
      .from(picks)
      .where(eq(picks.tournamentId, tournament.id));
    const allPlayers = await db.select().from(players);
    const allGolfers = await db.select().from(golfers);

    const existingFinishLogs = await db
      .select()
      .from(pointsLog)
      .where(
        and(
          eq(pointsLog.tournamentId, tournament.id),
          eq(pointsLog.source, "finish")
        )
      );

    const pickStates = [];
    for (const pick of tournamentPicks) {
      const player = allPlayers.find((p) => p.id === pick.playerId);
      const golfer = allGolfers.find((g) => g.id === pick.golferId);
      const [result] = await db
        .select()
        .from(tournamentResults)
        .where(
          and(
            eq(tournamentResults.golferId, pick.golferId),
            eq(tournamentResults.tournamentId, tournament.id)
          )
        );
      const existingLog = existingFinishLogs.find(
        (l) => l.playerId === pick.playerId
      );
      pickStates.push({
        player: player?.name ?? "?",
        golfer: golfer?.name ?? "?",
        finalPosition: result?.finalPosition ?? null,
        finalScoreToPar: result?.finalScoreToPar ?? null,
        madeCut: result?.madeCut ?? null,
        wouldAwardPoints: getFinishPoints(result?.finalPosition ?? null),
        alreadyAwarded: existingLog
          ? { points: existingLog.points, at: existingLog.createdAt }
          : null,
      });
    }

    pickStates.sort((a, b) => {
      const pa = a.finalPosition ? parseInt(a.finalPosition.replace(/^T/, ""), 10) : 999;
      const pb = b.finalPosition ? parseInt(b.finalPosition.replace(/^T/, ""), 10) : 999;
      return (isNaN(pa) ? 999 : pa) - (isNaN(pb) ? 999 : pb);
    });

    // Most recent scoreSnapshot per golfer (for sanity)
    const scoreSnapshotsTable = (await import("@/db/schema")).scoreSnapshots;
    const recentSnapshots = [];
    for (const pick of tournamentPicks) {
      const [snap] = await db
        .select()
        .from(scoreSnapshotsTable)
        .where(
          and(
            eq(scoreSnapshotsTable.golferId, pick.golferId),
            eq(scoreSnapshotsTable.tournamentId, tournament.id)
          )
        )
        .orderBy(desc(scoreSnapshotsTable.capturedAt))
        .limit(1);
      const golfer = allGolfers.find((g) => g.id === pick.golferId);
      if (snap) {
        recentSnapshots.push({
          golfer: golfer?.name ?? "?",
          capturedAt: snap.capturedAt,
          position: snap.position,
          totalScoreToPar: snap.totalScoreToPar,
          roundNumber: snap.roundNumber,
          thru: snap.thru,
        });
      }
    }

    return NextResponse.json({
      db: {
        tournamentId: tournament.id,
        tournamentName: tournament.name,
        status: tournament.status,
        slashTournId: tournament.slashTournId,
        lastPolledAt: tournament.lastPolledAt,
        totalFinishLogsWritten: existingFinishLogs.length,
      },
      slashGolfApi: apiDebug,
      picks: pickStates,
      mostRecentSnapshots: recentSnapshots,
    });
  } catch (error) {
    console.error("[DebugTournamentState] Error:", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
