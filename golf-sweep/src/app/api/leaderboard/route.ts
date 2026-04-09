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
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  getLeaderboard,
  parseLeaderboardPlayers,
  normalizeGolferName,
} from "@/lib/slashgolf";
import { getOutrightOdds, normalizeOddsName } from "@/lib/oddsapi";
import { writeScoreSnapshots, generateBanterFromSnapshot } from "@/lib/banter-engine";

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

  try {
    const lbRaw = await getLeaderboard(tournament.slashTournId, 2026);
    const lbPlayers = parseLeaderboardPlayers(lbRaw);
    if (lbPlayers.length === 0) return;

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

    // Write score snapshots (v2) for trajectory charts
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
        // Use per-round score if available, otherwise fall back to total
        const roundScore = lbPlayer.roundScores[lbPlayer.currentRound] ?? lbPlayer.scoreToPar;
        return {
          golferId: golfer.id,
          totalScoreToPar: lbPlayer.scoreToPar,
          roundScoreToPar: roundScore,
          position: lbPlayer.position,
          thru: lbPlayer.thru,
          roundNumber: lbPlayer.currentRound,
        };
      })
      .filter(Boolean) as Array<{
        golferId: number; totalScoreToPar: number | null; roundScoreToPar: number | null;
        position: string | null; thru: string | null; roundNumber: number;
      }>;

    await writeScoreSnapshots(tournament.id, snapshotData);

    // Generate banter events (non-blocking)
    generateBanterFromSnapshot(tournament.id).catch((err) =>
      console.error("[Leaderboard] Banter generation error:", err)
    );

    // Mark as polled
    await db
      .update(tournaments)
      .set({ lastPolledAt: new Date() })
      .where(eq(tournaments.id, tournament.id));

    console.log("[Leaderboard] Inline poll + snapshots complete");
  } catch (err) {
    console.error("[Leaderboard] Inline poll error:", err);
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
      await db.select().from(tournaments).limit(1)
    )[0];

    if (!tournament) {
      return NextResponse.json({ entries: [], tournament: null, lastPolled: null });
    }

    // Auto-poll scores (every 60s) and odds (every 15 min) if stale
    await maybePollScores(tournament);
    await maybePollOdds(tournament);

    // Re-read tournament for updated timestamps
    const [freshTournament] = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.id, tournament.id));

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
        position: result?.finalPosition ?? null,
        scoreToPar: result?.finalScoreToPar ?? null,
        madeCut: result?.madeCut,
        thru: scores[Math.max(...Object.keys(scores).map(Number), 0)]?.thru ?? null,
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
