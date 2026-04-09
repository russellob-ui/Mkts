import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  tournaments,
  golfers,
  picks,
  rounds,
  roundScores,
  tournamentResults,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getLeaderboard, parseLeaderboardPlayers, normalizeGolferName } from "@/lib/slashgolf";

export async function GET(request: NextRequest) {
  // Auth check — accept either CRON_SECRET or ADMIN_PASSCODE
  const cronSecret = process.env.CRON_SECRET;
  const adminPasscode = process.env.ADMIN_PASSCODE;
  const providedSecret = request.headers.get("x-cron-secret");
  const providedPasscode = request.headers.get("x-admin-passcode");
  const isAuthed =
    (cronSecret && providedSecret === cronSecret) ||
    (adminPasscode && providedPasscode === adminPasscode) ||
    (adminPasscode && providedSecret === adminPasscode);
  if (cronSecret && !isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Find live tournaments
    const liveTournaments = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.status, "live"));

    if (liveTournaments.length === 0) {
      return NextResponse.json({ message: "No live tournaments", updated: [] });
    }

    const changes: Array<Record<string, unknown>> = [];

    for (const tournament of liveTournaments) {
      let tournId = tournament.slashTournId;

      // If no tournId, try to find it from the schedule
      if (!tournId) {
        try {
          const { getSchedule, findMastersTournament } = await import("@/lib/slashgolf");
          const schedule = await getSchedule(2026);
          const masters = findMastersTournament(schedule);
          if (masters) {
            tournId = masters.tournId;
            await db
              .update(tournaments)
              .set({ slashTournId: tournId })
              .where(eq(tournaments.id, tournament.id));
            console.log(`[Poll] Found tournament ID: ${tournId}`);
          }
        } catch (err) {
          console.warn("[Poll] Could not fetch schedule:", err);
        }
      }

      if (!tournId) {
        changes.push({
          tournament: tournament.name,
          error: "No slash_tourn_id set and could not find from schedule",
        });
        continue;
      }

      // Fetch leaderboard
      const lbRaw = await getLeaderboard(tournId, 2026);
      const lbPlayers = parseLeaderboardPlayers(lbRaw);

      // Get our 8 picked golfers for this tournament
      const tournamentPicks = await db
        .select()
        .from(picks)
        .where(eq(picks.tournamentId, tournament.id));

      const pickedGolferIds = tournamentPicks.map((p) => p.golferId);
      const pickedGolfers = await db.select().from(golfers);
      const ourGolfers = pickedGolfers.filter((g) =>
        pickedGolferIds.includes(g.id)
      );

      // Get rounds for this tournament
      const tournamentRounds = await db
        .select()
        .from(rounds)
        .where(eq(rounds.tournamentId, tournament.id));

      for (const golfer of ourGolfers) {
        // Match by slash_player_id first, then by name
        let lbPlayer = golfer.slashPlayerId
          ? lbPlayers.find((p) => p.playerId === golfer.slashPlayerId)
          : null;

        if (!lbPlayer) {
          // Fuzzy match by name
          const normalized = normalizeGolferName(golfer.name);
          lbPlayer = lbPlayers.find((p) => {
            const pNorm = normalizeGolferName(p.name);
            const pLastNorm = normalizeGolferName(p.lastName);
            return (
              pNorm === normalized ||
              pNorm.includes(normalized) ||
              normalized.includes(pNorm) ||
              normalized.includes(pLastNorm) ||
              pLastNorm.includes(normalized.split(" ").pop() ?? "")
            );
          }) ?? null;

          // Save the matched player ID for future polls
          if (lbPlayer) {
            await db
              .update(golfers)
              .set({ slashPlayerId: lbPlayer.playerId })
              .where(eq(golfers.id, golfer.id));
            console.log(`[Poll] Matched ${golfer.name} → ${lbPlayer.name} (${lbPlayer.playerId})`);
          }
        }

        if (!lbPlayer) continue;

        // Update round scores
        for (let r = 1; r <= 4; r++) {
          const roundRow = tournamentRounds.find(
            (rr) => rr.roundNumber === r
          );
          if (!roundRow) continue;

          const score = lbPlayer.roundScores[r];
          if (score == null) continue;

          // Upsert round score
          const existing = await db
            .select()
            .from(roundScores)
            .where(
              and(
                eq(roundScores.golferId, golfer.id),
                eq(roundScores.roundId, roundRow.id)
              )
            );

          const thru =
            r < lbPlayer.currentRound
              ? "F"
              : r === lbPlayer.currentRound
                ? lbPlayer.thru
                : null;

          if (existing.length > 0) {
            await db
              .update(roundScores)
              .set({
                scoreToPar: score,
                thru,
                position: lbPlayer.position,
                updatedAt: new Date(),
              })
              .where(eq(roundScores.id, existing[0].id));
          } else {
            await db.insert(roundScores).values({
              golferId: golfer.id,
              roundId: roundRow.id,
              scoreToPar: score,
              thru,
              position: lbPlayer.position,
            });
          }

          // Update round status if needed
          if (thru === "F" && roundRow.status !== "finished") {
            // Check if all our golfers are through
            // For now, mark as live if any data
            if (roundRow.status === "upcoming") {
              await db
                .update(rounds)
                .set({ status: "live" })
                .where(eq(rounds.id, roundRow.id));
            }
          }
        }

        // Update tournament result
        const existingResult = await db
          .select()
          .from(tournamentResults)
          .where(
            and(
              eq(tournamentResults.golferId, golfer.id),
              eq(tournamentResults.tournamentId, tournament.id)
            )
          );

        if (existingResult.length > 0) {
          await db
            .update(tournamentResults)
            .set({
              finalPosition: lbPlayer.position,
              finalScoreToPar: lbPlayer.scoreToPar,
              madeCut: lbPlayer.madeCut,
            })
            .where(eq(tournamentResults.id, existingResult[0].id));
        } else {
          await db.insert(tournamentResults).values({
            golferId: golfer.id,
            tournamentId: tournament.id,
            finalPosition: lbPlayer.position,
            finalScoreToPar: lbPlayer.scoreToPar,
            madeCut: lbPlayer.madeCut,
          });
        }

        changes.push({
          golfer: golfer.name,
          position: lbPlayer.position,
          scoreToPar: lbPlayer.scoreToPar,
          thru: lbPlayer.thru,
        });
      }

      // Update last polled
      await db
        .update(tournaments)
        .set({
          lastPolledAt: new Date(),
          lastPollResult: JSON.stringify(changes),
        })
        .where(eq(tournaments.id, tournament.id));
    }

    return NextResponse.json({
      message: "Poll complete",
      updated: changes,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Poll] Error:", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
