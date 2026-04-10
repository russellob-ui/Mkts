import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import {
  picks,
  players,
  golfers,
  tournaments,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  getLeaderboard,
  normalizeGolferName,
  parseScoreStr,
  unwrapBson,
} from "@/lib/slashgolf";

export const dynamic = "force-dynamic";

/**
 * GET /api/heatmap?tournamentId=1
 *
 * Per-round scores for our 8 picks, pulled LIVE from Slash Golf.
 * Matches the field parsing in /api/leaderboard and /api/full-leaderboard
 * so R1/R2/R3/R4 actually populate from the rounds[] array.
 */
export async function GET(request: NextRequest) {
  try {
    await ensureTables();
    const tournamentId = Number(
      request.nextUrl.searchParams.get("tournamentId") ?? "1"
    );

    const [tournament] = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.id, tournamentId));

    const tournamentPicks = await db
      .select()
      .from(picks)
      .where(eq(picks.tournamentId, tournamentId));
    const allPlayers = await db.select().from(players);
    const allGolfers = await db.select().from(golfers);

    // Fetch live leaderboard once and index by normalized name
    type LiveData = {
      rounds: Record<number, number | null>;
      total: number | null;
      position: string | null;
    };
    const liveByName = new Map<string, LiveData>();
    let currentTournamentRound: number | null = null;

    if (
      tournament?.slashTournId &&
      tournament.status !== "finished" &&
      process.env.RAPIDAPI_KEY
    ) {
      try {
        const lbRaw = await getLeaderboard(tournament.slashTournId, 2026);
        const lbRoot = lbRaw as Record<string, unknown>;
        currentTournamentRound =
          Number(unwrapBson(lbRoot.roundId) ?? 0) || null;
        const rows: unknown[] = Array.isArray(lbRoot.leaderboardRows)
          ? (lbRoot.leaderboardRows as unknown[])
          : [];

        for (const row of rows) {
          const obj = row as Record<string, unknown>;
          const firstName = String(obj.firstName ?? "");
          const lastName = String(obj.lastName ?? "");
          const fullName = `${firstName} ${lastName}`.trim();
          const norm = normalizeGolferName(fullName);

          const roundScores: Record<number, number | null> = {
            1: null,
            2: null,
            3: null,
            4: null,
          };
          // Completed rounds from rounds[] array.
          // Defensive: if roundId missing/invalid, fall back to array index.
          const roundsArr = obj.rounds;
          if (Array.isArray(roundsArr)) {
            roundsArr.forEach((rd, i) => {
              const rdObj = rd as Record<string, unknown>;
              let rNum = Number(
                unwrapBson(
                  rdObj.roundId ?? rdObj.roundNumber ?? rdObj.round
                ) ?? 0
              );
              if (rNum < 1 || rNum > 4) rNum = i + 1;
              if (rNum >= 1 && rNum <= 4) {
                roundScores[rNum] = parseScoreStr(
                  rdObj.scoreToPar ?? rdObj.score ?? rdObj.toPar
                );
              }
            });
          }
          // In-progress round from currentRoundScore
          const roundComplete = obj.roundComplete === true;
          if (
            currentTournamentRound &&
            currentTournamentRound >= 1 &&
            currentTournamentRound <= 4 &&
            !roundComplete
          ) {
            const live = parseScoreStr(
              obj.currentRoundScore ??
                obj.currentRoundScoreToPar ??
                obj.todayScore
            );
            if (live !== null) {
              roundScores[currentTournamentRound] = live;
            }
          }

          liveByName.set(norm, {
            rounds: roundScores,
            total: parseScoreStr(obj.total ?? obj.totalToPar ?? obj.scoreToPar),
            position: String(obj.position ?? "") || null,
          });
        }
      } catch (err) {
        console.error("[Heatmap] Slash Golf fetch failed:", err);
      }
    }

    const data = [];
    for (const pick of tournamentPicks) {
      const player = allPlayers.find((p) => p.id === pick.playerId);
      const golfer = allGolfers.find((g) => g.id === pick.golferId);
      if (!player || !golfer) continue;

      const golferNorm = normalizeGolferName(golfer.name);
      let live = liveByName.get(golferNorm);
      // Fuzzy fallback
      if (!live) {
        for (const [k, v] of liveByName.entries()) {
          if (k.includes(golferNorm) || golferNorm.includes(k)) {
            live = v;
            break;
          }
        }
      }

      data.push({
        player: { name: player.name, slug: player.slug, color: player.color },
        golfer: { name: golfer.name, flagEmoji: golfer.flagEmoji },
        rounds: live?.rounds ?? { 1: null, 2: null, 3: null, 4: null },
        totalToPar: live?.total ?? null,
        position: live?.position ?? null,
      });
    }

    // Sort by position
    data.sort((a, b) => {
      const posA = a.position ? parseInt(a.position.replace(/^T/, "")) : 999;
      const posB = b.position ? parseInt(b.position.replace(/^T/, "")) : 999;
      return posA - posB;
    });

    return NextResponse.json({ heatmap: data, currentTournamentRound });
  } catch (error) {
    console.error("[Heatmap] Error:", error);
    return NextResponse.json({ error: String(error), heatmap: [] }, { status: 500 });
  }
}
