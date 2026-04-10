import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import { tournaments, golfers, picks, players } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  getLeaderboard,
  normalizeGolferName,
  parseScoreStr,
  unwrapBson,
} from "@/lib/slashgolf";

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

    // Slash Golf API schema (from openapi.yaml):
    //   Leaderboard: { roundId (int), roundStatus, leaderboardRows[] }
    //   LeaderboardRow: {
    //     firstName, lastName, playerId, status (active|complete|cut|wd|dq),
    //     total (string), currentRoundScore (string), position, teeTime,
    //     currentHole (int), startingHole (int), roundComplete (bool),
    //     rounds: [{ roundId (int), scoreToPar (string), strokes (int), ... }]
    //   }
    const lbRoot = lbRaw as Record<string, unknown>;
    const currentTournamentRound =
      Number(unwrapBson(lbRoot.roundId) ?? 0) || null;
    const rows: unknown[] = Array.isArray(lbRoot.leaderboardRows)
      ? (lbRoot.leaderboardRows as unknown[])
      : [];

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

    const mapped = rows.map((row) => {
      const obj = row as Record<string, unknown>;
      const firstName = String(obj.firstName ?? "");
      const lastName = String(obj.lastName ?? "");
      const name = `${firstName} ${lastName}`.trim();

      const total = parseScoreStr(obj.total ?? obj.totalToPar ?? obj.scoreToPar);
      const position = String(obj.position ?? "");
      const status = String(obj.status ?? "").toLowerCase();
      const roundComplete = obj.roundComplete === true;

      // Calculate thru from currentHole / startingHole
      const currentHole = Number(unwrapBson(obj.currentHole) ?? 0);
      const startingHole = Number(unwrapBson(obj.startingHole) ?? 0);
      let thru: string | null = null;
      if (status === "cut") thru = "CUT";
      else if (status === "wd") thru = "WD";
      else if (status === "dq") thru = "DQ";
      else if (roundComplete || status === "complete") thru = "F";
      else if (currentHole > 0 && startingHole > 0) {
        const holesPlayed = ((currentHole - startingHole + 18) % 18);
        thru = holesPlayed === 0 ? "—" : String(holesPlayed);
      } else if (obj.teeTime) {
        thru = String(obj.teeTime);
      }

      // Parse per-round scores from the rounds array (completed rounds only).
      // Defensive: if roundId missing/invalid, fall back to array index.
      const roundScores: Record<number, number | null> = { 1: null, 2: null, 3: null, 4: null };
      const roundsArr = obj.rounds;
      if (Array.isArray(roundsArr)) {
        roundsArr.forEach((rd, i) => {
          const rdObj = rd as Record<string, unknown>;
          let rNum = Number(
            unwrapBson(rdObj.roundId ?? rdObj.roundNumber ?? rdObj.round) ?? 0
          );
          if (rNum < 1 || rNum > 4) rNum = i + 1;
          if (rNum >= 1 && rNum <= 4) {
            roundScores[rNum] = parseScoreStr(
              rdObj.scoreToPar ?? rdObj.score ?? rdObj.toPar
            );
          }
        });
      }
      // For an in-progress round, currentRoundScore is authoritative
      if (
        currentTournamentRound &&
        currentTournamentRound >= 1 &&
        currentTournamentRound <= 4 &&
        !roundComplete
      ) {
        const liveRoundScore = parseScoreStr(
          obj.currentRoundScore ??
            obj.currentRoundScoreToPar ??
            obj.todayScore
        );
        if (liveRoundScore !== null) {
          roundScores[currentTournamentRound] = liveRoundScore;
        }
      }

      const normalized = normalizeGolferName(name);
      const matched = allGolfers.find((g) => {
        const gNorm = normalizeGolferName(g.name);
        return gNorm === normalized || gNorm.includes(normalized) || normalized.includes(gNorm);
      });
      const ourPlayer = matched ? golferIdToPlayer.get(matched.id) : null;

      return {
        playerId: String(obj.playerId ?? ""),
        name,
        position,
        scoreToPar: total ?? 0,
        thru,
        currentRoundNumber: currentTournamentRound,
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
