import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import { tournaments, picks, players, golfers } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  getLeaderboard,
  getScorecard,
  analyzeScorecardRound,
  parseLeaderboardPlayers,
  normalizeGolferName,
  getGolfSeasonYear,
  unwrapBson,
  type ScorecardRound,
} from "@/lib/slashgolf";

export const dynamic = "force-dynamic";

const cache = new Map<string, { data: ScorecardRound[]; at: number }>();

async function cached(tournId: string, year: number, playerId: string): Promise<ScorecardRound[]> {
  const k = `${tournId}-${year}-${playerId}`;
  const c = cache.get(k);
  if (c && Date.now() - c.at < 30_000) return c.data;
  const d = await getScorecard(tournId, year, playerId);
  cache.set(k, { data: d, at: Date.now() });
  return d;
}

export async function GET() {
  try {
    await ensureTables();

    const [tournament] = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.status, "live"));
    if (!tournament?.slashTournId || !process.env.RAPIDAPI_KEY) {
      return NextResponse.json({ players: [], currentRound: null });
    }

    const year = getGolfSeasonYear();
    const lbRaw = await getLeaderboard(tournament.slashTournId, year);
    const lbPlayers = parseLeaderboardPlayers(lbRaw);
    const lbRoot = lbRaw as Record<string, unknown>;
    const currentRound = Number(unwrapBson(lbRoot.roundId)) || null;

    const tournamentPicks = await db.select().from(picks).where(eq(picks.tournamentId, tournament.id));
    const allPlayers = await db.select().from(players);
    const allGolfers = await db.select().from(golfers);

    const result = [];

    for (const pick of tournamentPicks) {
      const player = allPlayers.find((p) => p.id === pick.playerId);
      const golfer = allGolfers.find((g) => g.id === pick.golferId);
      if (!player || !golfer) continue;

      const normalized = normalizeGolferName(golfer.name);
      const lbPlayer = lbPlayers.find((p) => {
        const n = normalizeGolferName(p.name);
        return n === normalized || n.includes(normalized) || normalized.includes(n);
      });

      let rounds: Array<{
        roundId: number;
        roundComplete: boolean;
        totalShots: number;
        holes: Array<{ holeId: number; holeScore: number; par: number }>;
        analysis: { eagles: number; birdies: number; bogeys: number; doubles: number };
      }> = [];

      if (lbPlayer?.playerId) {
        try {
          const sc = await cached(tournament.slashTournId, year, lbPlayer.playerId);
          rounds = sc
            .filter((r) => r.holes.length > 0)
            .map((r) => {
              const a = analyzeScorecardRound(r);
              return {
                roundId: r.roundId,
                roundComplete: r.roundComplete,
                totalShots: r.totalShots,
                holes: r.holes,
                analysis: {
                  eagles: a.eagles.length,
                  birdies: a.birdies.length,
                  bogeys: a.bogeys.length,
                  doubles: a.doubles.length,
                },
              };
            });
        } catch { /* non-fatal */ }
      }

      result.push({
        player: { name: player.name, color: player.color },
        golfer: { name: golfer.name, flagEmoji: golfer.flagEmoji },
        position: lbPlayer?.position ?? null,
        scoreToPar: lbPlayer?.scoreToPar ?? null,
        rounds,
      });
    }

    result.sort((a, b) => {
      const pa = a.position ? parseInt(a.position.replace(/^T/, "")) || 999 : 999;
      const pb = b.position ? parseInt(b.position.replace(/^T/, "")) || 999 : 999;
      return pa - pb;
    });

    return NextResponse.json({ players: result, currentRound });
  } catch (error) {
    console.error("[Scorecards]", error);
    return NextResponse.json({ error: String(error), players: [] }, { status: 500 });
  }
}
