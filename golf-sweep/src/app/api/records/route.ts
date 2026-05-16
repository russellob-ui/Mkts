import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import { records, players, golfers, picks, tournaments } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  getScorecard,
  analyzeScorecardRound,
  getGolfSeasonYear,
  getLeaderboard,
  parseLeaderboardPlayers,
  normalizeGolferName,
} from "@/lib/slashgolf";

export const dynamic = "force-dynamic";

interface ComputedRecord {
  recordType: string;
  title: string;
  playerName: string | null;
  golferName: string;
  tournamentName: string;
  roundNumber: number | null;
  value: number;
  displayValue: string;
  description: string;
}

/**
 * Compute hole-level records from scorecards of our picked golfers.
 * - Most Birdies in a Round
 * - Most Eagles in Tournament
 * - Worst Single Hole (highest over-par on any hole)
 */
async function computeHoleLevelRecords(): Promise<ComputedRecord[]> {
  const computed: ComputedRecord[] = [];

  try {
    // Find live or most recent tournament
    const allTournaments = await db.select().from(tournaments);
    const liveTournament = allTournaments.find((t) => t.status === "live");
    const target =
      liveTournament ??
      allTournaments.find((t) => t.status === "finished") ??
      null;

    if (!target || !target.slashTournId || !process.env.RAPIDAPI_KEY) {
      return [];
    }

    const allPlayers = await db.select().from(players);
    const allGolfers = await db.select().from(golfers);
    const tournamentPicks = await db
      .select()
      .from(picks)
      .where(eq(picks.tournamentId, target.id));

    const year = getGolfSeasonYear();
    const lbRaw = await getLeaderboard(target.slashTournId, year);
    const lbPlayers = parseLeaderboardPlayers(lbRaw);

    let mostBirdiesInRound: {
      count: number;
      playerName: string | null;
      golferName: string;
      roundId: number;
    } | null = null;

    let mostEaglesInTournament: {
      count: number;
      playerName: string | null;
      golferName: string;
    } | null = null;

    let worstSingleHole: {
      overPar: number;
      playerName: string | null;
      golferName: string;
      holeId: number;
      roundId: number;
      holeScore: number;
      holePar: number;
    } | null = null;

    for (const pick of tournamentPicks) {
      const player = allPlayers.find((p) => p.id === pick.playerId);
      const golfer = allGolfers.find((g) => g.id === pick.golferId);
      if (!golfer) continue;

      const normalized = normalizeGolferName(golfer.name);
      const lbPlayer = lbPlayers.find((p) => {
        const pNorm = normalizeGolferName(p.name);
        return (
          pNorm === normalized ||
          pNorm.includes(normalized) ||
          normalized.includes(pNorm)
        );
      });

      if (!lbPlayer || !lbPlayer.playerId) continue;

      const rounds = await getScorecard(
        target.slashTournId,
        year,
        lbPlayer.playerId
      );

      let totalEagles = 0;

      for (const round of rounds) {
        const analysis = analyzeScorecardRound(round);

        // Count birdies in this round
        const birdieCount = analysis.birdies.length;
        if (
          birdieCount > 0 &&
          (!mostBirdiesInRound || birdieCount > mostBirdiesInRound.count)
        ) {
          mostBirdiesInRound = {
            count: birdieCount,
            playerName: player?.name ?? null,
            golferName: golfer.name,
            roundId: round.roundId,
          };
        }

        // Count eagles
        totalEagles += analysis.eagles.length + analysis.albatross.length;

        // Check worst single hole
        for (const hole of round.holes) {
          if (hole.holeScore === 0 || hole.par === 0) continue;
          const overPar = hole.holeScore - hole.par;
          if (
            overPar > 0 &&
            (!worstSingleHole || overPar > worstSingleHole.overPar)
          ) {
            worstSingleHole = {
              overPar,
              playerName: player?.name ?? null,
              golferName: golfer.name,
              holeId: hole.holeId,
              roundId: round.roundId,
              holeScore: hole.holeScore,
              holePar: hole.par,
            };
          }
        }
      }

      if (
        totalEagles > 0 &&
        (!mostEaglesInTournament ||
          totalEagles > mostEaglesInTournament.count)
      ) {
        mostEaglesInTournament = {
          count: totalEagles,
          playerName: player?.name ?? null,
          golferName: golfer.name,
        };
      }
    }

    if (mostBirdiesInRound) {
      computed.push({
        recordType: "most_birdies_round",
        title: "Most Birdies in a Round",
        playerName: mostBirdiesInRound.playerName,
        golferName: mostBirdiesInRound.golferName,
        tournamentName: target.name,
        roundNumber: mostBirdiesInRound.roundId,
        value: mostBirdiesInRound.count,
        displayValue: `${mostBirdiesInRound.count} birdies`,
        description: `${mostBirdiesInRound.golferName} made ${mostBirdiesInRound.count} birdies in Round ${mostBirdiesInRound.roundId}`,
      });
    }

    if (mostEaglesInTournament) {
      computed.push({
        recordType: "most_eagles_tournament",
        title: "Most Eagles in Tournament",
        playerName: mostEaglesInTournament.playerName,
        golferName: mostEaglesInTournament.golferName,
        tournamentName: target.name,
        roundNumber: null,
        value: mostEaglesInTournament.count,
        displayValue: `${mostEaglesInTournament.count} eagle${mostEaglesInTournament.count !== 1 ? "s" : ""}`,
        description: `${mostEaglesInTournament.golferName} made ${mostEaglesInTournament.count} eagle${mostEaglesInTournament.count !== 1 ? "s" : ""} across the tournament`,
      });
    }

    if (worstSingleHole) {
      const scoreLabel = `+${worstSingleHole.overPar}`;
      computed.push({
        recordType: "worst_single_hole",
        title: "Worst Single Hole",
        playerName: worstSingleHole.playerName,
        golferName: worstSingleHole.golferName,
        tournamentName: target.name,
        roundNumber: worstSingleHole.roundId,
        value: worstSingleHole.overPar,
        displayValue: `${scoreLabel} (${worstSingleHole.holeScore} on par ${worstSingleHole.holePar})`,
        description: `${worstSingleHole.golferName} scored ${worstSingleHole.holeScore} on a par-${worstSingleHole.holePar} hole ${worstSingleHole.holeId} in R${worstSingleHole.roundId}`,
      });
    }
  } catch (err) {
    console.error("[Records] Error computing hole-level records:", err);
  }

  return computed;
}

export async function GET() {
  try {
    await ensureTables();

    const allRecords = await db.select().from(records);
    const allPlayers = await db.select().from(players);
    const allGolfers = await db.select().from(golfers);

    const enrich = (record: (typeof allRecords)[0]) => ({
      id: record.id,
      recordType: record.recordType,
      playerId: record.playerId,
      playerName: record.playerId
        ? allPlayers.find((p) => p.id === record.playerId)?.name ?? null
        : null,
      golferId: record.golferId,
      golferName: record.golferId
        ? allGolfers.find((g) => g.id === record.golferId)?.name ?? null
        : null,
      tournamentId: record.tournamentId,
      seasonId: record.seasonId,
      scope: record.scope,
      numericValue: record.numericValue,
      displayValue: record.displayValue,
      description: record.description,
      setAt: record.setAt.toISOString(),
      supersededAt: record.supersededAt?.toISOString() ?? null,
    });

    const current = allRecords
      .filter((r) => r.supersededAt === null)
      .map(enrich);

    const history = allRecords
      .filter((r) => r.supersededAt !== null)
      .map(enrich);

    // Compute hole-level records from scorecards (best-effort)
    let computedRecords: ComputedRecord[] = [];
    try {
      computedRecords = await computeHoleLevelRecords();
    } catch (err) {
      console.error("[Records] computeHoleLevelRecords error (non-fatal):", err);
    }

    return NextResponse.json({ current, history, computedRecords });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
