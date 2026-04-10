import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import { tournaments, golfers, picks, players } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getLeaderboard, normalizeGolferName } from "@/lib/slashgolf";

export const dynamic = "force-dynamic";

// In-memory cache — Slash Golf responses for 60 seconds
let cachedAt = 0;
let cachedPlayers: Array<{
  playerId: string;
  name: string;
  position: string | null;
  scoreToPar: number;
  thru: string | null;
  currentRoundNumber: number | null;
  roundScores: Record<number, number | null>;
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

    // Serve from cache if fresh (< 60s old) — bypass cache when debug requested
    const now = Date.now();
    // Temporarily disabled cache for debug
    // if (now - cachedAt < 60_000 && cachedPlayers.length > 0) {
    //   return NextResponse.json({
    //     players: cachedPlayers,
    //     tournament: cachedTournamentName,
    //     cachedAgo: Math.round((now - cachedAt) / 1000),
    //   });
    // }

    // Fetch fresh from Slash Golf
    if (!process.env.RAPIDAPI_KEY) {
      return NextResponse.json({ players: [], tournament: tournament.name, error: "No API key" });
    }

    const lbRaw = await getLeaderboard(tournament.slashTournId, 2026);

    // Parse the raw response and extract per-round scores directly from the API
    const lbRoot = lbRaw as Record<string, unknown>;
    let rows: unknown[] = [];
    for (const key of ["leaderboardRows", "leaderboard", "results", "rows", "players"]) {
      if (Array.isArray(lbRoot[key])) {
        rows = lbRoot[key] as unknown[];
        break;
      }
    }

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

    const parseNum = (v: unknown): number | null => {
      if (v === "E" || v === "even") return 0;
      if (v == null || v === "" || v === "-") return null;
      const n = Number(v);
      return isNaN(n) ? null : n;
    };

    const mapped = rows.map((row) => {
      const obj = row as Record<string, unknown>;
      const firstName = String(obj.firstName ?? obj.first_name ?? "");
      const lastName = String(obj.lastName ?? obj.last_name ?? "");
      const name = String(obj.name ?? obj.playerName ?? `${firstName} ${lastName}`).trim();

      const total = parseNum(obj.total ?? obj.scoreToPar ?? obj.toPar);
      const position = String(obj.position ?? obj.pos ?? "");
      const thruVal = obj.thru ?? obj.hole ?? obj.holes;
      const thru = thruVal != null && thruVal !== "" ? String(thruVal) : null;
      const currentRoundNumber = Number(obj.currentRound ?? obj.round ?? 0) || null;

      // Parse per-round scores from the rounds array
      const roundScores: Record<number, number | null> = { 1: null, 2: null, 3: null, 4: null };
      const roundsArr = obj.rounds;
      if (Array.isArray(roundsArr)) {
        for (const rd of roundsArr) {
          const rdObj = rd as Record<string, unknown>;
          const rNum = Number(rdObj.roundId ?? rdObj.roundNumber ?? rdObj.round_number ?? rdObj.round ?? 0);
          if (rNum >= 1 && rNum <= 4) {
            const val = parseNum(
              rdObj.scoreToPar ?? rdObj.score_to_par ?? rdObj.toPar ?? rdObj.strokes ?? rdObj.total
            );
            roundScores[rNum] = val;
          }
        }
      }

      const normalized = normalizeGolferName(name);
      const matched = allGolfers.find((g) => {
        const gNorm = normalizeGolferName(g.name);
        return gNorm === normalized || gNorm.includes(normalized) || normalized.includes(gNorm);
      });
      const ourPlayer = matched ? golferIdToPlayer.get(matched.id) : null;

      return {
        playerId: String(obj.playerId ?? obj.player_id ?? obj.id ?? ""),
        name,
        position,
        scoreToPar: total ?? 0,
        thru,
        currentRoundNumber,
        roundScores,
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

    // Debug: include the raw rounds array structure of the first player
    // so we can see what field names the API is actually using
    const debugFirstPlayer = rows[0] as Record<string, unknown> | undefined;
    const debugRoundsStructure = debugFirstPlayer?.rounds;

    return NextResponse.json({
      players: mapped,
      tournament: tournament.name,
      cachedAgo: 0,
      _debug: {
        firstPlayerKeys: debugFirstPlayer ? Object.keys(debugFirstPlayer) : [],
        firstPlayerName: debugFirstPlayer?.name ?? debugFirstPlayer?.lastName,
        roundsArray: debugRoundsStructure,
        roundsFirstItemKeys: Array.isArray(debugRoundsStructure) && debugRoundsStructure[0]
          ? Object.keys(debugRoundsStructure[0] as object)
          : null,
      },
    });
  } catch (error) {
    console.error("[Full Leaderboard] Error:", error);
    return NextResponse.json({ error: String(error), players: [] }, { status: 500 });
  }
}
