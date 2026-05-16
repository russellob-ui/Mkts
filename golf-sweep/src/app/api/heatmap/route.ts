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
  getScorecard,
  analyzeScorecardRound,
  normalizeGolferName,
  parseScoreStr,
  unwrapBson,
  getGolfSeasonYear,
  ScorecardRound,
} from "@/lib/slashgolf";

export const dynamic = "force-dynamic";

// Scorecard cache — 60s per player
const scorecardCache = new Map<string, { data: ScorecardRound[]; cachedAt: number }>();
async function getCachedScorecard(
  tournId: string,
  year: number,
  playerId: string
): Promise<ScorecardRound[]> {
  const key = `${tournId}-${year}-${playerId}`;
  const cached = scorecardCache.get(key);
  if (cached && Date.now() - cached.cachedAt < 30_000) return cached.data;
  const data = await getScorecard(tournId, year, playerId);
  scorecardCache.set(key, { data, cachedAt: Date.now() });
  return data;
}

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
    let tournamentId = Number(
      request.nextUrl.searchParams.get("tournamentId") || "0"
    );
    if (!tournamentId) {
      const [live] = await db.select().from(tournaments).where(eq(tournaments.status, "live"));
      tournamentId = live?.id ?? 1;
    }

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
        const lbRaw = await getLeaderboard(tournament.slashTournId, getGolfSeasonYear());
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
    const year = getGolfSeasonYear();
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

      // Fetch scorecard for par-type breakdown
      let parTypePerformance: {
        par3: number | null;
        par4: number | null;
        par5: number | null;
      } = { par3: null, par4: null, par5: null };

      if (
        tournament?.slashTournId &&
        golfer.slashPlayerId &&
        process.env.RAPIDAPI_KEY
      ) {
        try {
          const scorecardRounds = await getCachedScorecard(
            tournament.slashTournId,
            year,
            golfer.slashPlayerId
          );
          // Only count completed rounds
          const completedRounds = scorecardRounds.filter(
            (r) => r.roundComplete && r.holes.length > 0
          );
          if (completedRounds.length > 0) {
            let par3Total = 0, par3Count = 0;
            let par4Total = 0, par4Count = 0;
            let par5Total = 0, par5Count = 0;
            for (const r of completedRounds) {
              for (const h of r.holes) {
                if (h.par === 0 || h.holeScore === 0) continue;
                const diff = h.holeScore - h.par;
                if (h.par === 3) { par3Total += diff; par3Count++; }
                else if (h.par === 4) { par4Total += diff; par4Count++; }
                else if (h.par >= 5) { par5Total += diff; par5Count++; }
              }
            }
            parTypePerformance = {
              par3: par3Count > 0 ? Math.round((par3Total / par3Count) * 100) / 100 : null,
              par4: par4Count > 0 ? Math.round((par4Total / par4Count) * 100) / 100 : null,
              par5: par5Count > 0 ? Math.round((par5Total / par5Count) * 100) / 100 : null,
            };
          }
        } catch (err) {
          console.error(`[Heatmap] Scorecard failed for ${golfer.name}:`, err);
        }
      }

      data.push({
        player: { name: player.name, slug: player.slug, color: player.color },
        golfer: { name: golfer.name, flagEmoji: golfer.flagEmoji },
        rounds: live?.rounds ?? { 1: null, 2: null, 3: null, 4: null },
        totalToPar: live?.total ?? null,
        position: live?.position ?? null,
        parTypePerformance,
      });
    }

    // Sort by position
    data.sort((a, b) => {
      const posA = a.position ? parseInt(a.position.replace(/^T/, "")) || 999 : 999;
      const posB = b.position ? parseInt(b.position.replace(/^T/, "")) || 999 : 999;
      return posA - posB;
    });

    return NextResponse.json({ heatmap: data, currentTournamentRound });
  } catch (error) {
    console.error("[Heatmap] Error:", error);
    return NextResponse.json({ error: String(error), heatmap: [] }, { status: 500 });
  }
}
