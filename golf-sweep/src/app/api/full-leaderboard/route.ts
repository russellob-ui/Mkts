import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import { tournaments, golfers, picks, players } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getLeaderboard, parseLeaderboardPlayers, normalizeGolferName } from "@/lib/slashgolf";

export const dynamic = "force-dynamic";

// In-memory cache — Slash Golf responses for 60 seconds
let cachedAt = 0;
let cachedPlayers: Array<{
  playerId: string;
  name: string;
  position: string | null;
  scoreToPar: number;
  thru: string | null;
  isOurPick: boolean;
  ourPlayerName?: string;
  ourPlayerColor?: string | null;
  country?: string | null;
  flagEmoji?: string | null;
}> = [];
let cachedTournamentName = "";

export async function GET() {
  try {
    await ensureTables();

    // Find live tournament
    const liveTournaments = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.status, "live"));
    const tournament = liveTournaments[0];

    if (!tournament || !tournament.slashTournId) {
      return NextResponse.json({
        players: [],
        tournament: tournament?.name ?? null,
        error: "No live tournament",
      });
    }

    // Serve from cache if fresh (< 60s old)
    const now = Date.now();
    if (now - cachedAt < 60_000 && cachedPlayers.length > 0) {
      return NextResponse.json({
        players: cachedPlayers,
        tournament: cachedTournamentName,
        cachedAgo: Math.round((now - cachedAt) / 1000),
      });
    }

    // Fetch fresh from Slash Golf
    if (!process.env.RAPIDAPI_KEY) {
      return NextResponse.json({ players: [], tournament: tournament.name, error: "No API key" });
    }

    const lbRaw = await getLeaderboard(tournament.slashTournId, 2026);
    const lbPlayers = parseLeaderboardPlayers(lbRaw);

    // Figure out which players are "our picks" (any of our 8 golfers)
    const allGolfers = await db.select().from(golfers);
    const allPlayers = await db.select().from(players);
    const tournamentPicks = await db
      .select()
      .from(picks)
      .where(eq(picks.tournamentId, tournament.id));

    const golferIdToPlayer = new Map<number, { name: string; color: string | null }>();
    for (const pick of tournamentPicks) {
      const player = allPlayers.find((p) => p.id === pick.playerId);
      if (player) {
        golferIdToPlayer.set(pick.golferId, { name: player.name, color: player.color });
      }
    }

    const mapped = lbPlayers.map((lbp) => {
      const normalized = normalizeGolferName(lbp.name);
      const matched = allGolfers.find((g) => {
        const gNorm = normalizeGolferName(g.name);
        return (
          gNorm === normalized ||
          gNorm.includes(normalized) ||
          normalized.includes(gNorm)
        );
      });
      const ourPlayer = matched ? golferIdToPlayer.get(matched.id) : null;
      return {
        playerId: lbp.playerId,
        name: lbp.name,
        position: lbp.position,
        scoreToPar: lbp.scoreToPar,
        thru: lbp.thru,
        country: matched?.country ?? null,
        flagEmoji: matched?.flagEmoji ?? null,
        isOurPick: !!ourPlayer,
        ourPlayerName: ourPlayer?.name,
        ourPlayerColor: ourPlayer?.color,
      };
    });

    // Sort by position (numeric, nulls last)
    mapped.sort((a, b) => {
      const posA = a.position ? parseInt(a.position.replace(/^T/, "")) : 999;
      const posB = b.position ? parseInt(b.position.replace(/^T/, "")) : 999;
      return posA - posB;
    });

    cachedPlayers = mapped;
    cachedAt = now;
    cachedTournamentName = tournament.name;

    return NextResponse.json({
      players: mapped,
      tournament: tournament.name,
      cachedAgo: 0,
    });
  } catch (error) {
    console.error("[Full Leaderboard] Error:", error);
    return NextResponse.json({ error: String(error), players: [] }, { status: 500 });
  }
}
