import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  tournaments,
  players,
  picks,
  rounds,
  golfers,
  pointsLog,
} from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getLeaderboard, getGolfSeasonYear } from "@/lib/slashgolf";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, unknown> = {};
  let overallStatus: "ok" | "warning" | "error" = "ok";

  function fail(key: string) {
    if (overallStatus === "ok") overallStatus = "warning";
    checks[key] = { ...((checks[key] as Record<string, unknown>) ?? {}), ok: false };
  }

  // 1. A tournament with status="live" exists
  try {
    const liveTournaments = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.status, "live"));

    if (liveTournaments.length === 1) {
      const t = liveTournaments[0];
      checks.liveTournament = { ok: true, name: t.name, id: t.id };

      // 2. That tournament has a slashTournId
      if (t.slashTournId) {
        checks.slashTournId = { ok: true, value: t.slashTournId };
      } else {
        checks.slashTournId = { ok: false, value: null };
        fail("slashTournId");
      }

      // 3. All 8 players have picks for the live tournament
      const allPlayers = await db.select().from(players);
      const tournamentPicks = await db
        .select()
        .from(picks)
        .where(eq(picks.tournamentId, t.id));

      const playerIdsWithPicks = new Set(tournamentPicks.map((p) => p.playerId));
      const missing = allPlayers
        .filter((p) => !playerIdsWithPicks.has(p.id))
        .map((p) => p.name);

      if (missing.length === 0 && tournamentPicks.length >= allPlayers.length) {
        checks.picksComplete = { ok: true, count: tournamentPicks.length, missing: [] };
      } else {
        checks.picksComplete = { ok: false, count: tournamentPicks.length, missing };
        fail("picksComplete");
      }

      // 4. 4 rounds exist for the live tournament
      const tournamentRounds = await db
        .select()
        .from(rounds)
        .where(eq(rounds.tournamentId, t.id));
      const roundNumbers = tournamentRounds.map((r) => r.roundNumber).sort();

      if (roundNumbers.length === 4) {
        checks.roundsExist = { ok: true, rounds: roundNumbers };
      } else {
        checks.roundsExist = { ok: false, rounds: roundNumbers };
        fail("roundsExist");
      }

      // 5. Slash Golf API responds
      if (t.slashTournId && process.env.RAPIDAPI_KEY) {
        try {
          const lbRaw = await getLeaderboard(t.slashTournId, getGolfSeasonYear());
          const lbRoot = lbRaw as Record<string, unknown>;
          const rows = Array.isArray(lbRoot.leaderboardRows)
            ? lbRoot.leaderboardRows
            : [];
          checks.apiConnection = { ok: true, playerCount: rows.length };
        } catch (err) {
          checks.apiConnection = { ok: false, playerCount: 0, error: String(err) };
          fail("apiConnection");
        }
      } else {
        checks.apiConnection = {
          ok: false,
          playerCount: 0,
          error: !process.env.RAPIDAPI_KEY ? "No RAPIDAPI_KEY" : "No slashTournId",
        };
        fail("apiConnection");
      }

      // 6. No duplicate golfer names
      const allGolfers = await db.select().from(golfers);
      const nameCounts = new Map<string, number>();
      for (const g of allGolfers) {
        nameCounts.set(g.name, (nameCounts.get(g.name) ?? 0) + 1);
      }
      const duplicates = [...nameCounts.entries()]
        .filter(([, count]) => count > 1)
        .map(([name]) => name);

      if (duplicates.length === 0) {
        checks.duplicateGolfers = { ok: true, duplicates: [] };
      } else {
        checks.duplicateGolfers = { ok: false, duplicates };
        fail("duplicateGolfers");
      }

      // 7. Points log counts make sense
      const allPointsLogs = await db
        .select()
        .from(pointsLog)
        .where(eq(pointsLog.tournamentId, t.id));
      const finishLogs = allPointsLogs.filter((p) => p.source === "finish").length;
      const rotdLogs = allPointsLogs.filter((p) => p.source === "rotd").length;
      const borLogs = allPointsLogs.filter((p) => p.source === "bor").length;

      // Finish logs should not exceed number of picks
      const pointsOk = finishLogs <= tournamentPicks.length;
      checks.pointsIntegrity = {
        ok: pointsOk,
        finishLogs,
        rotdLogs,
        borLogs,
      };
      if (!pointsOk) fail("pointsIntegrity");

      // 8. No other tournaments also marked "live" (should be exactly 1)
      checks.noStaleData = { ok: true };
    } else if (liveTournaments.length === 0) {
      checks.liveTournament = { ok: false, name: null, id: null };
      overallStatus = "error";
      checks.slashTournId = { ok: false, value: null };
      checks.picksComplete = { ok: false, count: 0, missing: [] };
      checks.roundsExist = { ok: false, rounds: [] };
      checks.apiConnection = { ok: false, playerCount: 0 };
      checks.duplicateGolfers = { ok: true, duplicates: [] };
      checks.pointsIntegrity = { ok: true, finishLogs: 0, rotdLogs: 0, borLogs: 0 };
      checks.noStaleData = { ok: true };
    } else {
      // Multiple live tournaments
      checks.liveTournament = {
        ok: false,
        name: liveTournaments.map((t) => t.name).join(", "),
        id: liveTournaments.map((t) => t.id),
      };
      checks.noStaleData = {
        ok: false,
        error: `${liveTournaments.length} tournaments are marked live`,
      };
      overallStatus = "error";
      // Still run remaining checks against the first one
      checks.slashTournId = { ok: false, value: null };
      checks.picksComplete = { ok: false, count: 0, missing: [] };
      checks.roundsExist = { ok: false, rounds: [] };
      checks.apiConnection = { ok: false, playerCount: 0 };
      checks.duplicateGolfers = { ok: true, duplicates: [] };
      checks.pointsIntegrity = { ok: true, finishLogs: 0, rotdLogs: 0, borLogs: 0 };
    }
  } catch (err) {
    overallStatus = "error";
    checks.liveTournament = { ok: false, error: String(err) };
  }

  return NextResponse.json({ status: overallStatus, checks });
}
