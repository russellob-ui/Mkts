import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import {
  players,
  tournaments,
  golfers,
  picks,
  rounds,
  roundScores,
  tournamentResults,
  pointsLog,
  liveOdds,
  scoreSnapshots,
} from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import {
  getLeaderboard,
  parseLeaderboardPlayers,
  normalizeGolferName,
  parseScoreStr,
  unwrapBson,
  getGolfSeasonYear,
} from "@/lib/slashgolf";
import { getOutrightOdds, normalizeOddsName } from "@/lib/oddsapi";
import { writeScoreSnapshots, generateBanterFromSnapshot } from "@/lib/banter-engine";
import { finishTournament, isTournamentOfficiallyOver } from "@/lib/finish-tournament";
import { completeRound, roundsThatShouldBeComplete } from "@/lib/complete-round";

export const dynamic = "force-dynamic";

const POLL_INTERVAL_MS = 60_000; // Scores: don't hit API more than once per 60s
const ODDS_POLL_INTERVAL_MS = 15 * 60_000; // Odds: every 15 minutes

/**
 * Inline poll: if the tournament is live and hasn't been polled
 * in the last 60 seconds, fetch fresh scores from Slash Golf
 * before returning the leaderboard to the client.
 */
async function maybePollScores(
  tournament: { id: number; slashTournId: string | null; lastPolledAt: Date | null; status: string }
) {
  if (tournament.status !== "live") return;
  if (!tournament.slashTournId) return;
  if (!process.env.RAPIDAPI_KEY) return;

  const now = Date.now();
  const lastPoll = tournament.lastPolledAt ? tournament.lastPolledAt.getTime() : 0;

  // Check if round_scores is empty — if so, force a poll to bootstrap
  const existingScores = await db.select().from(roundScores).limit(1);
  const needsBootstrap = existingScores.length === 0;

  if (!needsBootstrap && now - lastPoll < POLL_INTERVAL_MS) return; // too soon

  let pollSucceeded = false;
  try {
    const lbRaw = await getLeaderboard(tournament.slashTournId, getGolfSeasonYear());
    const lbPlayers = parseLeaderboardPlayers(lbRaw);

    // Auto-detect tournament end: Slash Golf says roundId=4 + roundStatus="Official".
    // Fire-and-forget — finishTournament is idempotent and non-fatal on error.
    //
    // IMPORTANT: roundId comes through as MongoDB Extended JSON, so we must
    // unwrap before Number() — `Number({"$numberInt": "4"})` is NaN.
    const lbRoot = lbRaw as Record<string, unknown>;
    const topRoundId = Number(unwrapBson(lbRoot.roundId)) || null;
    const topRoundStatus =
      typeof lbRoot.roundStatus === "string" ? lbRoot.roundStatus : null;
    console.log(
      `[Leaderboard] Auto-settle check: roundId=${topRoundId} roundStatus=${JSON.stringify(topRoundStatus)}`
    );

    // Auto-complete any finished round — fires ROTD (+5) and BOR (+2) bonuses.
    // Runs BEFORE finishTournament so round-4 bonuses land before the final
    // finish points. completeRound is idempotent.
    const roundsToComplete = roundsThatShouldBeComplete(topRoundId, topRoundStatus);
    for (const r of roundsToComplete) {
      try {
        const s = await completeRound(tournament.id, r);
        if (!s.alreadyComplete && (s.rotd.length > 0 || s.bor.length > 0)) {
          console.log(
            `[Leaderboard] Auto-completed round ${r}. ` +
              `ROTD awards: ${s.rotd.length}, BOR awards: ${s.bor.length}.`
          );
        }
      } catch (err) {
        console.error(`[Leaderboard] Auto-complete round ${r} error (non-fatal):`, err);
      }
    }

    if (isTournamentOfficiallyOver(topRoundId, topRoundStatus)) {
      try {
        const summary = await finishTournament(tournament.id);
        if (!summary.alreadyFinished) {
          console.log(
            `[Leaderboard] Tournament ${tournament.id} auto-finished. ` +
              `Winner: ${summary.winner?.playerName ?? "?"} / ` +
              `${summary.winner?.golferName ?? "?"}. ` +
              `Points awarded to ${summary.awarded.filter((a) => a.points > 0).length} players.`
          );
        }
      } catch (err) {
        console.error("[Leaderboard] Auto-finish error (non-fatal):", err);
      }
    }

    if (lbPlayers.length === 0) {
      console.warn("[Leaderboard] API returned 0 players");
      // Still mark as polled to avoid hammering the API
      await db
        .update(tournaments)
        .set({ lastPolledAt: new Date() })
        .where(eq(tournaments.id, tournament.id));
      return;
    }

    const tournamentPicks = await db
      .select()
      .from(picks)
      .where(eq(picks.tournamentId, tournament.id));
    const pickedGolferIds = tournamentPicks.map((p) => p.golferId);
    const allGolfers = await db.select().from(golfers);
    const ourGolfers = allGolfers.filter((g) => pickedGolferIds.includes(g.id));

    const tournamentRounds = await db
      .select()
      .from(rounds)
      .where(eq(rounds.tournamentId, tournament.id));

    for (const golfer of ourGolfers) {
      // Match by ID or name
      let lbPlayer = golfer.slashPlayerId
        ? lbPlayers.find((p) => p.playerId === golfer.slashPlayerId)
        : null;

      if (!lbPlayer) {
        const normalized = normalizeGolferName(golfer.name);
        lbPlayer = lbPlayers.find((p) => {
          const pNorm = normalizeGolferName(p.name);
          const pLastNorm = normalizeGolferName(p.lastName);
          return (
            pNorm === normalized ||
            pNorm.includes(normalized) ||
            normalized.includes(pNorm) ||
            normalized.includes(pLastNorm) ||
            (pLastNorm.length > 3 && pLastNorm.includes(normalized.split(" ").pop() ?? "____"))
          );
        }) ?? null;

        if (lbPlayer) {
          await db
            .update(golfers)
            .set({ slashPlayerId: lbPlayer.playerId })
            .where(eq(golfers.id, golfer.id));
        }
      }

      if (!lbPlayer) continue;

      // Update round scores
      for (let r = 1; r <= 4; r++) {
        const roundRow = tournamentRounds.find((rr) => rr.roundNumber === r);
        if (!roundRow) continue;

        let score = lbPlayer.roundScores[r];

        // Fallback: if no per-round score but this round is complete or current,
        // infer from total (works for R1 = total, or when only one round played)
        if (score == null && r <= lbPlayer.currentRound) {
          if (r === 1 && lbPlayer.currentRound === 1) {
            score = lbPlayer.scoreToPar; // R1 total = overall total
          } else if (r === lbPlayer.currentRound && Object.values(lbPlayer.roundScores).every(v => v == null)) {
            // No round data at all, use total for current round as approximation
            score = lbPlayer.scoreToPar;
          }
        }
        if (score == null) continue;

        const thru =
          r < lbPlayer.currentRound ? "F"
            : r === lbPlayer.currentRound ? lbPlayer.thru
              : null;

        const existing = await db
          .select()
          .from(roundScores)
          .where(and(eq(roundScores.golferId, golfer.id), eq(roundScores.roundId, roundRow.id)));

        if (existing.length > 0) {
          await db
            .update(roundScores)
            .set({ scoreToPar: score, thru, position: lbPlayer.position, updatedAt: new Date() })
            .where(eq(roundScores.id, existing[0].id));
        } else {
          await db.insert(roundScores).values({
            golferId: golfer.id, roundId: roundRow.id, scoreToPar: score, thru, position: lbPlayer.position,
          });
        }

        if (roundRow.status === "upcoming") {
          await db.update(rounds).set({ status: "live" }).where(eq(rounds.id, roundRow.id));
        }
      }

      // Update tournament result
      const existingResult = await db
        .select()
        .from(tournamentResults)
        .where(and(eq(tournamentResults.golferId, golfer.id), eq(tournamentResults.tournamentId, tournament.id)));

      if (existingResult.length > 0) {
        await db
          .update(tournamentResults)
          .set({ finalPosition: lbPlayer.position, finalScoreToPar: lbPlayer.scoreToPar, madeCut: lbPlayer.madeCut })
          .where(eq(tournamentResults.id, existingResult[0].id));
      } else {
        await db.insert(tournamentResults).values({
          golferId: golfer.id, tournamentId: tournament.id,
          finalPosition: lbPlayer.position, finalScoreToPar: lbPlayer.scoreToPar, madeCut: lbPlayer.madeCut,
        });
      }
    }

    // Write score snapshots (v2) for trajectory charts.
    //
    // Timing + logic notes:
    //   - totalScoreToPar  = CUMULATIVE tournament score (all rounds so far)
    //   - roundScoreToPar  = THIS round's score ONLY (nullable if unknown)
    //     It must NOT fall back to the total — conflating round-only with
    //     cumulative produced garbage in the trajectory chart.
    //   - roundNumber      = the tournament's current round (1-4), clamped.
    const snapshotData = ourGolfers
      .map((golfer) => {
        let lbPlayer = golfer.slashPlayerId
          ? lbPlayers.find((p) => p.playerId === golfer.slashPlayerId)
          : null;
        if (!lbPlayer) {
          const normalized = normalizeGolferName(golfer.name);
          lbPlayer = lbPlayers.find((p) => {
            const pNorm = normalizeGolferName(p.name);
            const pLastNorm = normalizeGolferName(p.lastName);
            return pNorm === normalized || pNorm.includes(normalized) || normalized.includes(pNorm) || normalized.includes(pLastNorm);
          }) ?? null;
        }
        if (!lbPlayer) return null;
        const currentRound =
          lbPlayer.currentRound && lbPlayer.currentRound >= 1 && lbPlayer.currentRound <= 4
            ? lbPlayer.currentRound
            : 1;
        // Per-round score ONLY — no fallback to total
        const roundScore = lbPlayer.roundScores[currentRound] ?? null;
        return {
          golferId: golfer.id,
          totalScoreToPar: lbPlayer.scoreToPar,
          roundScoreToPar: roundScore,
          position: lbPlayer.position,
          thru: lbPlayer.thru,
          roundNumber: currentRound,
        };
      })
      .filter(Boolean) as Array<{
        golferId: number; totalScoreToPar: number | null; roundScoreToPar: number | null;
        position: string | null; thru: string | null; roundNumber: number;
      }>;

    // Mark scores as polled — core work is done, v3 extras are best-effort
    pollSucceeded = true;
    await db
      .update(tournaments)
      .set({ lastPolledAt: new Date() })
      .where(eq(tournaments.id, tournament.id));

    // Best-effort: write score snapshots (v2) for trajectory charts
    try {
      await writeScoreSnapshots(tournament.id, snapshotData);
    } catch (err) {
      console.error("[Leaderboard] Snapshot write error (non-fatal):", err);
    }

    // Best-effort: generate banter events
    try {
      generateBanterFromSnapshot(tournament.id).catch((err) =>
        console.error("[Leaderboard] Banter generation error:", err)
      );
    } catch (err) {
      console.error("[Leaderboard] Banter trigger error (non-fatal):", err);
    }

    console.log("[Leaderboard] Inline poll complete");
  } catch (err) {
    console.error("[Leaderboard] Inline poll error:", err);
    // If poll didn't succeed, still bump lastPolledAt to avoid hammering
    // failed API. 60s cooldown will kick in.
    if (!pollSucceeded) {
      try {
        await db
          .update(tournaments)
          .set({ lastPolledAt: new Date() })
          .where(eq(tournaments.id, tournament.id));
      } catch {}
    }
  }
}

/**
 * Inline odds poll: auto-fetch odds from The Odds API if stale (>15 min).
 */
async function maybePollOdds(
  tournament: { id: number; oddsApiSportKey: string | null; lastOddsPolledAt: Date | null; status: string }
) {
  if (tournament.status !== "live") return;
  if (!tournament.oddsApiSportKey) return;
  if (!process.env.ODDS_API_KEY) return;

  const now = Date.now();
  const lastPoll = tournament.lastOddsPolledAt ? tournament.lastOddsPolledAt.getTime() : 0;
  if (now - lastPoll < ODDS_POLL_INTERVAL_MS) return;

  try {
    const { golferOdds } = await getOutrightOdds(tournament.oddsApiSportKey);
    if (golferOdds.size === 0) return;

    const tournamentPicks = await db
      .select()
      .from(picks)
      .where(eq(picks.tournamentId, tournament.id));
    const pickedGolferIds = tournamentPicks.map((p) => p.golferId);
    const allGolfers = await db.select().from(golfers);
    const ourGolfers = allGolfers.filter((g) => pickedGolferIds.includes(g.id));

    for (const golfer of ourGolfers) {
      const normalized = normalizeGolferName(golfer.name);
      let matchedOdds: { fractional: string; decimal: number; bookmaker: string } | null = null;

      for (const [oddsName, odds] of golferOdds) {
        const oddsNorm = normalizeOddsName(oddsName);
        if (oddsNorm === normalized || oddsNorm.includes(normalized) || normalized.includes(oddsNorm)) {
          matchedOdds = odds;
          break;
        }
      }
      if (!matchedOdds) continue;

      const existing = await db
        .select()
        .from(liveOdds)
        .where(and(eq(liveOdds.golferId, golfer.id), eq(liveOdds.tournamentId, tournament.id)));

      if (existing.length > 0) {
        await db
          .update(liveOdds)
          .set({ fractional: matchedOdds.fractional, decimal: matchedOdds.decimal, bookmaker: matchedOdds.bookmaker, updatedAt: new Date() })
          .where(eq(liveOdds.id, existing[0].id));
      } else {
        await db.insert(liveOdds).values({
          golferId: golfer.id, tournamentId: tournament.id,
          fractional: matchedOdds.fractional, decimal: matchedOdds.decimal, bookmaker: matchedOdds.bookmaker,
        });
      }
    }

    await db
      .update(tournaments)
      .set({ lastOddsPolledAt: new Date() })
      .where(eq(tournaments.id, tournament.id));

    console.log("[Leaderboard] Inline odds poll complete");
  } catch (err) {
    console.error("[Leaderboard] Inline odds poll error:", err);
  }
}

export async function GET() {
  try {
    await ensureTables();

    const allPlayers = await db.select().from(players);
    if (allPlayers.length === 0) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000";
      try { await fetch(`${baseUrl}/api/seed`, { method: "POST" }); } catch {}
      return NextResponse.json({ entries: [], tournament: null, lastPolled: null });
    }

    const liveTournaments = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.status, "live"));

    const tournament = liveTournaments[0] ?? (
      await db.select().from(tournaments)
        .where(eq(tournaments.status, "upcoming"))
        .limit(1)
    )[0] ?? (
      await db.select().from(tournaments)
        .orderBy(desc(tournaments.id))
        .limit(1)
    )[0];

    if (!tournament) {
      return NextResponse.json({ entries: [], tournament: null, lastPolled: null });
    }

    // Auto-poll scores (every 60s) and odds (every 15 min) if stale.
    // Both bail out cheaply if the tournament isn't live.
    await maybePollScores(tournament);
    await maybePollOdds(tournament);

    // Self-heal settlement: runs regardless of tournament status.
    //
    // maybePollScores() bails for finished tournaments, which means the
    // per-round ROTD/BOR auto-detection inside it never fires for
    // already-finished majors. This block catches that: for each of the
    // four rounds, if we have scores, try to settle it. completeRound is
    // idempotent, so this is a no-op on subsequent GETs once bonuses land.
    for (let r = 1; r <= 4; r++) {
      try {
        await completeRound(tournament.id, r);
      } catch (err) {
        // Per-round failures are non-fatal (e.g. round doesn't exist yet)
        if (!String(err).includes("not found")) {
          console.error(
            `[Leaderboard] self-heal completeRound(${r}) failed:`,
            err
          );
        }
      }
    }
    // And for tournaments that are already finished in the DB, ensure
    // finish points are in. finishTournament() is also idempotent.
    if (tournament.status === "finished") {
      try {
        await finishTournament(tournament.id);
      } catch (err) {
        console.error(
          "[Leaderboard] self-heal finishTournament failed:",
          err
        );
      }
    }

    // Re-read tournament for updated timestamps
    const [freshTournament] = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.id, tournament.id));

    // ALSO fetch raw Slash Golf leaderboard for this request so we can
    // extract per-round strokes/scoreToPar directly from the API response.
    // This is the authoritative source for "today's round score".
    //
    // Slash Golf API schema (from openapi.yaml):
    //   Leaderboard: { roundId, roundStatus, leaderboardRows[] }
    //   LeaderboardRow: {
    //     firstName, lastName, playerId, status (active|complete|cut|wd|dq),
    //     total (string), currentRoundScore (string), position, teeTime,
    //     currentHole (int), startingHole (int), roundComplete (bool),
    //     rounds: [{ roundId (int), scoreToPar (string), strokes (int), ... }]
    //   }
    const liveApiData = new Map<string, {
      name: string;
      currentRoundNumber: number | null;
      currentRoundScoreToPar: number | null;
      thru: string | null;
      teeTime: string | null;
      status: "not_started" | "playing" | "finished" | "cut" | "wd" | "dq" | "unknown";
      position: string | null;
      totalScoreToPar: number | null;
    }>();
    if (tournament.slashTournId && process.env.RAPIDAPI_KEY) {
      try {
        const lbRaw = await getLeaderboard(tournament.slashTournId, getGolfSeasonYear());
        const lbRoot = lbRaw as Record<string, unknown>;
        // Top-level roundId tells us which round the tournament is currently on.
        // Slash Golf may wrap numbers in MongoDB Extended JSON, so unwrap first.
        const currentTournamentRound =
          Number(unwrapBson(lbRoot.roundId) ?? 0) || null;
        const rows: unknown[] = Array.isArray(lbRoot.leaderboardRows)
          ? (lbRoot.leaderboardRows as unknown[])
          : [];

        for (const row of rows) {
          const obj = row as Record<string, unknown>;
          const firstName = String(obj.firstName ?? "");
          const lastName = String(obj.lastName ?? "");
          const fullName = `${firstName} ${lastName}`.trim();

          // Tournament-level current round (same for every player)
          const currentRound = currentTournamentRound;

          // Parse total score to par (string field, e.g. "E", "-3", "+2")
          const totalScoreToPar = parseScoreStr(
            obj.total ?? obj.totalToPar ?? obj.scoreToPar
          );

          // For the in-progress round, use currentRoundScore (string).
          // For completed rounds, we look them up in the rounds array below.
          let currentRoundScoreToPar: number | null = null;
          const status = String(obj.status ?? "").toLowerCase();
          const roundComplete = obj.roundComplete === true;

          if (currentRound && currentRound >= 1 && currentRound <= 4) {
            // Try the rounds array first (for completed rounds this holds the score).
            // Defensive: if roundId missing, fall back to array index.
            const roundsArr = obj.rounds;
            let roundScoreFromArray: number | null = null;
            if (Array.isArray(roundsArr)) {
              roundsArr.forEach((rd, i) => {
                const rdObj = rd as Record<string, unknown>;
                let rNum = Number(
                  unwrapBson(
                    rdObj.roundId ?? rdObj.roundNumber ?? rdObj.round
                  ) ?? 0
                );
                if (rNum < 1 || rNum > 4) rNum = i + 1;
                if (rNum === currentRound) {
                  roundScoreFromArray = parseScoreStr(
                    rdObj.scoreToPar ?? rdObj.score ?? rdObj.toPar
                  );
                }
              });
            }
            // If the round is in progress, currentRoundScore is authoritative
            const liveRoundScore = parseScoreStr(
              obj.currentRoundScore ??
                obj.currentRoundScoreToPar ??
                obj.todayScore
            );
            currentRoundScoreToPar =
              liveRoundScore !== null ? liveRoundScore : roundScoreFromArray;
          }

          // Calculate thru + status + teeTime.
          //
          // thru:     ONLY hole count | "F" | "CUT" | "WD" | "DQ" | null
          //           (never a tee time — tee time goes in its own field)
          // teeTime:  the Slash Golf `teeTime` string, e.g. "1:44pm"
          // status:   derived state machine the UI can switch on
          const currentHole = Number(unwrapBson(obj.currentHole) ?? 0);
          const startingHole = Number(unwrapBson(obj.startingHole) ?? 0);
          const teeTime = obj.teeTime ? String(obj.teeTime) : null;

          let thru: string | null = null;
          let playerStatus:
            | "not_started"
            | "playing"
            | "finished"
            | "cut"
            | "wd"
            | "dq"
            | "unknown" = "unknown";

          if (status === "cut") {
            thru = "CUT";
            playerStatus = "cut";
          } else if (status === "wd") {
            thru = "WD";
            playerStatus = "wd";
          } else if (status === "dq") {
            thru = "DQ";
            playerStatus = "dq";
          } else if (roundComplete || status === "complete") {
            thru = "F";
            playerStatus = "finished";
          } else if (currentHole > 0 && startingHole > 0) {
            const holesPlayed = (currentHole - startingHole + 18) % 18;
            if (holesPlayed === 0) {
              // currentHole === startingHole: either teeing off right now
              // (still "not started" for scoring purposes) or wrapped round
              thru = null;
              playerStatus = "not_started";
            } else {
              thru = String(holesPlayed);
              playerStatus = "playing";
            }
          } else if (teeTime) {
            // Haven't teed off yet — have a scheduled time
            thru = null;
            playerStatus = "not_started";
          }

          const playerId = String(obj.playerId ?? "");
          const data = {
            name: fullName,
            currentRoundNumber: currentRound,
            currentRoundScoreToPar,
            thru,
            teeTime,
            status: playerStatus,
            position: String(obj.position ?? ""),
            totalScoreToPar,
          };
          if (playerId) liveApiData.set(playerId, data);
          // Also index by normalized name for fallback matching
          liveApiData.set(`name:${normalizeGolferName(fullName)}`, data);
        }
      } catch (err) {
        console.error("[Leaderboard] Direct API fetch error:", err);
      }
    }

    const tournamentPicks = await db
      .select()
      .from(picks)
      .where(eq(picks.tournamentId, tournament.id));

    const tournamentRounds = await db
      .select()
      .from(rounds)
      .where(eq(rounds.tournamentId, tournament.id));

    const entries = [];
    for (const pick of tournamentPicks) {
      const player = allPlayers.find((p) => p.id === pick.playerId);
      const golfer = (await db.select().from(golfers).where(eq(golfers.id, pick.golferId)))[0];
      if (!player || !golfer) continue;

      const [result] = await db
        .select()
        .from(tournamentResults)
        .where(
          and(
            eq(tournamentResults.golferId, golfer.id),
            eq(tournamentResults.tournamentId, tournament.id)
          )
        );

      const scores: Record<number, { scoreToPar: number | null; thru: string | null }> = {};
      for (const round of tournamentRounds) {
        const [score] = await db
          .select()
          .from(roundScores)
          .where(
            and(
              eq(roundScores.golferId, golfer.id),
              eq(roundScores.roundId, round.id)
            )
          );
        if (score) {
          scores[round.roundNumber] = {
            scoreToPar: score.scoreToPar,
            thru: score.thru,
          };
        }
      }

      const playerPoints = await db
        .select()
        .from(pointsLog)
        .where(
          and(
            eq(pointsLog.playerId, player.id),
            eq(pointsLog.tournamentId, tournament.id)
          )
        );
      const totalPoints = playerPoints.reduce((sum, p) => sum + p.points, 0);

      // Get live odds
      const [currentOdds] = await db
        .select()
        .from(liveOdds)
        .where(
          and(
            eq(liveOdds.golferId, golfer.id),
            eq(liveOdds.tournamentId, tournament.id)
          )
        );

      // Get latest snapshot for live thru/position (snapshots are populated
      // by inline poll, round_scores often isn't)
      const [latestSnapshot] = await db
        .select()
        .from(scoreSnapshots)
        .where(
          and(
            eq(scoreSnapshots.golferId, golfer.id),
            eq(scoreSnapshots.tournamentId, tournament.id)
          )
        )
        .orderBy(desc(scoreSnapshots.capturedAt))
        .limit(1);

      // Look up this golfer's live data from the direct API fetch
      const liveData =
        (golfer.slashPlayerId ? liveApiData.get(golfer.slashPlayerId) : null) ??
        liveApiData.get(`name:${normalizeGolferName(golfer.name)}`) ??
        null;

      // Today's score comes directly from the API's current-round data
      const todayScore = liveData?.currentRoundScoreToPar ?? null;
      const liveTotal = liveData?.totalScoreToPar ?? null;
      const livePosition = liveData?.position ?? null;
      const liveThru = liveData?.thru ?? null;
      const liveTeeTime = liveData?.teeTime ?? null;
      const liveStatus = liveData?.status ?? "unknown";
      const liveCurrentRound = liveData?.currentRoundNumber ?? null;

      entries.push({
        player: {
          id: player.id,
          name: player.name,
          slug: player.slug,
          color: player.color,
          rowColor: player.rowColor,
          avatarEmoji: player.avatarEmoji,
        },
        golfer: {
          id: golfer.id,
          name: golfer.name,
          country: golfer.country,
          flagEmoji: golfer.flagEmoji,
        },
        position: livePosition ?? latestSnapshot?.position ?? result?.finalPosition ?? null,
        scoreToPar: liveTotal ?? latestSnapshot?.totalScoreToPar ?? result?.finalScoreToPar ?? null,
        todayScore,
        currentRound: liveCurrentRound ?? latestSnapshot?.roundNumber ?? null,
        madeCut: result?.madeCut,
        // thru is now ONLY hole count / F / CUT / WD / DQ / null
        // (tee time has moved to its own field below)
        thru:
          liveThru && liveThru !== ""
            ? liveThru
            : latestSnapshot?.thru && latestSnapshot.thru !== ""
              ? latestSnapshot.thru
              : scores[Math.max(...Object.keys(scores).map(Number), 0)]?.thru ?? null,
        teeTime: liveTeeTime,
        status: liveStatus,
        openingOdds: pick.openingOdds,
        openingOddsDecimal: pick.openingOddsDecimal,
        currentOdds: currentOdds?.fractional ?? null,
        currentOddsDecimal: currentOdds?.decimal ?? null,
        roundScores: scores,
        points: totalPoints,
      });
    }

    entries.sort((a, b) => {
      const posA = a.position ? parseInt(a.position.replace(/^T/, "")) : 999;
      const posB = b.position ? parseInt(b.position.replace(/^T/, "")) : 999;
      return posA - posB;
    });

    return NextResponse.json({
      entries,
      tournament: {
        id: freshTournament.id,
        name: freshTournament.name,
        status: freshTournament.status,
        lastPolledAt: freshTournament.lastPolledAt,
        lastOddsPolledAt: freshTournament.lastOddsPolledAt,
      },
      lastPolled: freshTournament.lastPolledAt?.toISOString() ?? null,
      lastOddsPolled: freshTournament.lastOddsPolledAt?.toISOString() ?? null,
    });
  } catch (error) {
    console.error("[Leaderboard API] Error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
