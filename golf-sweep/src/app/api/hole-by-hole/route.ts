import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import { picks, players, golfers, tournaments } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  getScorecard,
  getGolfSeasonYear,
  normalizeGolferName,
  getLeaderboard,
  parseLeaderboardPlayers,
} from "@/lib/slashgolf";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await ensureTables();

    let tournamentId = Number(
      request.nextUrl.searchParams.get("tournamentId") || "0"
    );
    if (!tournamentId) {
      const [live] = await db
        .select()
        .from(tournaments)
        .where(eq(tournaments.status, "live"));
      tournamentId = live?.id ?? 1;
    }

    const [tournament] = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.id, tournamentId));

    if (!tournament || !tournament.slashTournId || !process.env.RAPIDAPI_KEY) {
      return NextResponse.json({ players: [] });
    }

    const tournamentPicks = await db
      .select()
      .from(picks)
      .where(eq(picks.tournamentId, tournamentId));
    const allPlayers = await db.select().from(players);
    const allGolfers = await db.select().from(golfers);

    // Get the leaderboard to resolve golfer names -> playerIds
    const year = getGolfSeasonYear();
    const lbRaw = await getLeaderboard(tournament.slashTournId, year);
    const lbPlayers = parseLeaderboardPlayers(lbRaw);

    const result = [];

    for (const pick of tournamentPicks) {
      const player = allPlayers.find((p) => p.id === pick.playerId);
      const golfer = allGolfers.find((g) => g.id === pick.golferId);
      if (!player || !golfer) continue;

      // Match golfer to leaderboard to get slashPlayerId
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

      // Fetch all rounds scorecard
      const rounds = await getScorecard(
        tournament.slashTournId,
        year,
        lbPlayer.playerId
      );

      if (!rounds || rounds.length === 0) continue;

      // Sort rounds by roundId
      const sortedRounds = [...rounds].sort((a, b) => a.roundId - b.roundId);

      // Flatten all holes into sequential order with running cumulative score-to-par
      const holes: Array<{
        holeNumber: number;
        cumulativeToPar: number;
        holePar: number;
        holeScore: number;
        round: number;
      }> = [];

      let cumulativeToPar = 0;
      let sequentialHole = 0;

      for (const round of sortedRounds) {
        // Sort holes by holeId
        const sortedHoles = [...round.holes].sort(
          (a, b) => a.holeId - b.holeId
        );

        for (const hole of sortedHoles) {
          if (hole.holeScore === 0 || hole.par === 0) continue;
          sequentialHole++;
          cumulativeToPar += hole.holeScore - hole.par;

          holes.push({
            holeNumber: sequentialHole,
            cumulativeToPar,
            holePar: hole.par,
            holeScore: hole.holeScore,
            round: round.roundId,
          });
        }
      }

      if (holes.length > 0) {
        result.push({
          player: {
            name: player.name,
            color: player.color ?? "#006747",
          },
          golfer: {
            name: golfer.name,
            flagEmoji: golfer.flagEmoji,
          },
          holes,
        });
      }
    }

    return NextResponse.json({ players: result });
  } catch (error) {
    console.error("[HoleByHole API] Error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
