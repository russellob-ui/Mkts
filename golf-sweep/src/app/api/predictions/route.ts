import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import {
  players,
  picks,
  golfers,
  tournaments,
  roundPredictions,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  getLeaderboard,
  normalizeGolferName,
  parseScoreStr,
  unwrapBson,
  getGolfSeasonYear,
} from "@/lib/slashgolf";

export const dynamic = "force-dynamic";

/**
 * GET /api/predictions?tournamentId=1&round=1
 *
 * Returns prediction window state + results for the round:
 *   { windowOpen, roundComplete, results: { predictions[], totalPoints } | null }
 *
 * Window open/closed is determined LIVE from the Slash Golf API:
 *   - tournament current round < selected round → closed (future round)
 *   - tournament current round > selected round → closed (past round)
 *   - tournament current round = selected round AND any picked golfer
 *     has teed off → closed (round started)
 *   - otherwise → open
 */
export async function GET(request: NextRequest) {
  try {
    await ensureTables();
    const tournamentId = Number(
      request.nextUrl.searchParams.get("tournamentId") ?? "1"
    );
    const roundNumber = Number(
      request.nextUrl.searchParams.get("round") ?? "1"
    );

    const [tournament] = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.id, tournamentId));
    if (!tournament) {
      return NextResponse.json({
        windowOpen: false,
        roundComplete: false,
        results: null,
      });
    }

    // Load the live leaderboard snapshot if we have a live tournament
    // and an API key. From it we can see:
    //   - top-level roundId → current tournament round
    //   - each player's status / currentHole → has the round started?
    let currentTournamentRound: number | null = null;
    let roundComplete = false;
    let roundStarted = false;
    const liveByName = new Map<
      string,
      { currentRoundScore: number | null; total: number | null; roundComplete: boolean }
    >();

    if (
      tournament.status === "live" &&
      tournament.slashTournId &&
      process.env.RAPIDAPI_KEY
    ) {
      try {
        const lbRaw = await getLeaderboard(tournament.slashTournId, getGolfSeasonYear());
        const lbRoot = lbRaw as Record<string, unknown>;
        currentTournamentRound =
          Number(unwrapBson(lbRoot.roundId) ?? 0) || null;
        const rows: unknown[] = Array.isArray(lbRoot.leaderboardRows)
          ? (lbRoot.leaderboardRows as unknown[])
          : [];

        // Which golfers are "our picks" for this tournament?
        const tournamentPicks = await db
          .select()
          .from(picks)
          .where(eq(picks.tournamentId, tournamentId));
        const pickedGolferIds = new Set(tournamentPicks.map((p) => p.golferId));
        const allGolfers = await db.select().from(golfers);
        const pickedGolferNames = allGolfers
          .filter((g) => pickedGolferIds.has(g.id))
          .map((g) => normalizeGolferName(g.name));

        let anyPickTeedOff = false;
        let allPicksComplete = true;
        let pickMatches = 0;
        for (const row of rows) {
          const obj = row as Record<string, unknown>;
          const firstName = String(obj.firstName ?? "");
          const lastName = String(obj.lastName ?? "");
          const fullName = `${firstName} ${lastName}`.trim();
          const norm = normalizeGolferName(fullName);

          const isOurPick = pickedGolferNames.some(
            (g) => g === norm || g.includes(norm) || norm.includes(g)
          );

          const currentHole = Number(unwrapBson(obj.currentHole) ?? 0);
          const startingHole = Number(unwrapBson(obj.startingHole) ?? 0);
          const rComplete = obj.roundComplete === true;
          const status = String(obj.status ?? "").toLowerCase();

          if (isOurPick) {
            pickMatches += 1;
            const hasTeedOff =
              rComplete ||
              status === "complete" ||
              (currentHole > 0 &&
                startingHole > 0 &&
                ((currentHole - startingHole + 18) % 18) > 0);
            if (hasTeedOff) anyPickTeedOff = true;
            if (!rComplete && status !== "complete") allPicksComplete = false;

            liveByName.set(norm, {
              currentRoundScore: parseScoreStr(obj.currentRoundScore),
              total: parseScoreStr(obj.total),
              roundComplete: rComplete || status === "complete",
            });
          }
        }

        if (pickMatches > 0) {
          roundStarted =
            anyPickTeedOff && currentTournamentRound === roundNumber;
          roundComplete =
            allPicksComplete &&
            currentTournamentRound !== null &&
            currentTournamentRound > roundNumber;
        }
      } catch (err) {
        console.error("[Predictions] Leaderboard fetch failed:", err);
      }
    }

    // Window-open logic:
    //   open when we're ON the selected round AND no picked golfer has teed off yet
    //   OR the selected round is strictly in the future (currentRound < selectedRound)
    const isRoundOpen = (r: number): boolean => {
      if (currentTournamentRound === null) {
        return tournament.status !== "finished";
      }
      if (currentTournamentRound < r) return true; // future round
      if (currentTournamentRound === r) return !roundStarted;
      return false; // past round
    };

    const windowOpen = isRoundOpen(roundNumber);

    // Compute the first round whose window is still open so clients
    // can auto-jump to the "active" prediction round.
    let nextOpenRound: number | null = null;
    for (const r of [1, 2, 3, 4]) {
      if (isRoundOpen(r)) {
        nextOpenRound = r;
        break;
      }
    }

    // Load results if the round is complete
    let results: {
      predictions: Array<{
        subjectPlayer: { id: number; name: string; avatarEmoji: string | null };
        golferName: string;
        predictedScoreToPar: number | null;
        predictedOutcome: string | null;
        actualScoreToPar: number | null;
        actualOutcome: string | null;
        outcomeCorrect: boolean | null;
        exactCorrect: boolean | null;
        pointsAwarded: number | null;
      }>;
      totalPoints: number;
    } | null = null;

    if (roundComplete) {
      const allPlayers = await db.select().from(players);
      const allGolfers = await db.select().from(golfers);
      const tournamentPicks = await db
        .select()
        .from(picks)
        .where(eq(picks.tournamentId, tournamentId));

      const predictionRows = await db
        .select()
        .from(roundPredictions)
        .where(
          and(
            eq(roundPredictions.tournamentId, tournamentId),
            eq(roundPredictions.roundNumber, roundNumber)
          )
        );

      const predsForView = predictionRows.map((pr) => {
        const subject = allPlayers.find((p) => p.id === pr.subjectPlayerId);
        const subjectPick = tournamentPicks.find(
          (pk) => pk.playerId === pr.subjectPlayerId
        );
        const golfer = subjectPick
          ? allGolfers.find((g) => g.id === subjectPick.golferId)
          : undefined;
        return {
          subjectPlayer: {
            id: subject?.id ?? 0,
            name: subject?.name ?? "Unknown",
            avatarEmoji: subject?.avatarEmoji ?? null,
          },
          golferName: golfer?.name ?? "—",
          predictedScoreToPar: pr.predictedScoreToPar,
          predictedOutcome: pr.predictedOutcome,
          actualScoreToPar: pr.actualScoreToPar,
          actualOutcome: pr.actualOutcome,
          outcomeCorrect: pr.outcomeCorrect,
          exactCorrect: pr.exactCorrect,
          pointsAwarded: pr.pointsAwarded,
        };
      });

      results = {
        predictions: predsForView,
        totalPoints: predsForView.reduce(
          (s, p) => s + (p.pointsAwarded ?? 0),
          0
        ),
      };
    }

    return NextResponse.json({
      windowOpen,
      roundComplete,
      currentTournamentRound,
      nextOpenRound,
      results,
    });
  } catch (error) {
    console.error("[Predictions GET] Error:", error);
    return NextResponse.json(
      { windowOpen: false, roundComplete: false, results: null, error: String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/predictions
 * Body: {
 *   predictorPlayerId: number,
 *   passcode: string,
 *   tournamentId: number,
 *   roundNumber: number,
 *   predictions: [{ subjectPlayerId, predictedScoreToPar, predictedOutcome }]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    await ensureTables();
    const body = await request.json();
    const {
      predictorPlayerId,
      passcode,
      tournamentId,
      roundNumber,
      predictions: items,
    } = body;

    if (
      !predictorPlayerId ||
      !passcode ||
      !tournamentId ||
      !roundNumber ||
      !Array.isArray(items)
    ) {
      return NextResponse.json(
        {
          error:
            "predictorPlayerId, passcode, tournamentId, roundNumber and predictions[] are required",
        },
        { status: 400 }
      );
    }

    // Validate identity: playerId + passcode together
    const [player] = await db
      .select()
      .from(players)
      .where(eq(players.id, Number(predictorPlayerId)));
    if (!player || player.passcode !== passcode) {
      return NextResponse.json(
        { error: "Invalid player or passcode" },
        { status: 401 }
      );
    }

    // Upsert each prediction
    for (const item of items) {
      if (
        !item.subjectPlayerId ||
        typeof item.predictedScoreToPar !== "number" ||
        !item.predictedOutcome
      ) {
        continue;
      }
      // Delete then insert to emulate upsert
      await db
        .delete(roundPredictions)
        .where(
          and(
            eq(roundPredictions.predictorPlayerId, player.id),
            eq(roundPredictions.subjectPlayerId, Number(item.subjectPlayerId)),
            eq(roundPredictions.tournamentId, Number(tournamentId)),
            eq(roundPredictions.roundNumber, Number(roundNumber))
          )
        );
      await db.insert(roundPredictions).values({
        predictorPlayerId: player.id,
        subjectPlayerId: Number(item.subjectPlayerId),
        tournamentId: Number(tournamentId),
        roundNumber: Number(roundNumber),
        predictedScoreToPar: Number(item.predictedScoreToPar),
        predictedOutcome: String(item.predictedOutcome),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Predictions POST] Error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
