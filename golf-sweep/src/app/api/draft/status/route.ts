import { NextResponse } from "next/server";
import { db } from "@/db";
import { players, golfers, picks, tournaments } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  getLeaderboard,
  parseLeaderboardPlayers,
  normalizeGolferName,
} from "@/lib/slashgolf";

export const dynamic = "force-dynamic";

// Simple in-memory cache for the leaderboard (60s TTL)
let cachedField: ReturnType<typeof parseLeaderboardPlayers> | null = null;
let cachedAt = 0;
const CACHE_TTL = 30_000;

export async function GET() {
  try {
    // Get the live tournament
    const liveTournaments = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.status, "live"));

    const tournament = liveTournaments[0];
    if (!tournament) {
      return NextResponse.json(
        { error: "No live tournament" },
        { status: 404 }
      );
    }

    // Get all players
    const allPlayers = await db.select().from(players);

    // Get picks for this tournament
    const tournamentPicks = await db
      .select()
      .from(picks)
      .where(eq(picks.tournamentId, tournament.id));

    // Build the "who picked what" list
    const picksMade: Array<{
      player: { id: number; name: string; slug: string; color: string | null; avatarEmoji: string | null };
      golfer: { id: number; name: string; flagEmoji: string | null };
    }> = [];

    for (const pick of tournamentPicks) {
      const player = allPlayers.find((p) => p.id === pick.playerId);
      const [golfer] = await db
        .select()
        .from(golfers)
        .where(eq(golfers.id, pick.golferId));
      if (player && golfer) {
        picksMade.push({
          player: {
            id: player.id,
            name: player.name,
            slug: player.slug,
            color: player.color,
            avatarEmoji: player.avatarEmoji,
          },
          golfer: {
            id: golfer.id,
            name: golfer.name,
            flagEmoji: golfer.flagEmoji,
          },
        });
      }
    }

    // Players who haven't picked yet
    const pickedPlayerIds = new Set(tournamentPicks.map((p) => p.playerId));
    const waiting = allPlayers
      .filter((p) => !pickedPlayerIds.has(p.id))
      .map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        color: p.color,
        avatarEmoji: p.avatarEmoji,
      }));

    // Fetch the full field from Slash Golf (cached 60s)
    let field: Array<{
      name: string;
      position: string;
      scoreToPar: number;
      thru: string;
      taken: boolean;
      takenBy: string | null;
    }> = [];

    if (tournament.slashTournId) {
      const now = Date.now();
      if (!cachedField || now - cachedAt > CACHE_TTL) {
        try {
          const year = new Date().getFullYear();
          const lb = await getLeaderboard(tournament.slashTournId, year);
          cachedField = parseLeaderboardPlayers(lb);
          cachedAt = now;
        } catch (err) {
          console.error("[Draft Status] Leaderboard fetch failed:", err);
          // Use stale cache if available
        }
      }

      if (cachedField) {
        // Build a set of taken golfer names (normalized) for fast lookup
        const takenMap = new Map<string, string>(); // normalized name -> player who picked
        for (const pm of picksMade) {
          takenMap.set(normalizeGolferName(pm.golfer.name), pm.player.name);
        }

        field = cachedField.map((p) => {
          const normName = normalizeGolferName(p.name);
          const takenBy = takenMap.get(normName) ?? null;
          return {
            name: p.name,
            position: p.position,
            scoreToPar: p.scoreToPar,
            thru: p.thru,
            taken: takenBy !== null,
            takenBy,
          };
        });
      }
    }

    return NextResponse.json({
      tournament: {
        id: tournament.id,
        name: tournament.name,
        status: tournament.status,
      },
      picksMade,
      waiting,
      field,
    });
  } catch (error) {
    console.error("[Draft Status] Error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
