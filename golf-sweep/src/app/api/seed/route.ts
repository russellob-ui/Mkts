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
} from "@/db/schema";
import { PLAYERS, GOLFERS, PICKS } from "@/lib/seed-data";
import {
  getSchedule,
  getLeaderboard,
  findMastersTournament,
  parseLeaderboardPlayers,
  normalizeGolferName,
} from "@/lib/slashgolf";
import { eq } from "drizzle-orm";

export async function POST() {
  try {
    // Ensure tables exist
    await ensureTables();

    // Check if already seeded
    const existingPlayers = await db.select().from(players);
    if (existingPlayers.length > 0) {
      return NextResponse.json({ message: "Already seeded", seeded: false });
    }

    console.log("[Seed] Starting seed process...");

    // 1. Insert players
    const insertedPlayers = await db
      .insert(players)
      .values(
        PLAYERS.map((p) => ({
          name: p.name,
          slug: p.slug,
          avatarEmoji: p.avatarEmoji,
          color: p.color,
        }))
      )
      .returning();
    console.log(`[Seed] Inserted ${insertedPlayers.length} players`);

    // 2. Insert golfers
    const insertedGolfers = await db
      .insert(golfers)
      .values(
        GOLFERS.map((g) => ({
          name: g.name,
          country: g.country,
          flagEmoji: g.flagEmoji,
        }))
      )
      .returning();
    console.log(`[Seed] Inserted ${insertedGolfers.length} golfers`);

    // 3. Try to get Masters from Slash Golf
    let tournamentRow;
    let leaderboardData;
    try {
      const schedule = await getSchedule(2026);
      const masters = findMastersTournament(schedule);

      if (masters) {
        console.log(`[Seed] Found Masters: ${masters.name} (ID: ${masters.tournId})`);
        const [inserted] = await db
          .insert(tournaments)
          .values({
            name: masters.name,
            slashTournId: masters.tournId,
            startDate: masters.startDate,
            endDate: masters.endDate,
            status: "live",
          })
          .returning();
        tournamentRow = inserted;

        // Get leaderboard and match golfers
        try {
          const lb = await getLeaderboard(masters.tournId, 2026);
          leaderboardData = parseLeaderboardPlayers(lb);
          console.log(`[Seed] Leaderboard has ${leaderboardData.length} players`);

          // Match our golfers to API player IDs
          for (const golfer of insertedGolfers) {
            const normalized = normalizeGolferName(golfer.name);
            const match = leaderboardData.find((p) => {
              const pNorm = normalizeGolferName(p.name);
              const pLastNorm = normalizeGolferName(p.lastName);
              return (
                pNorm === normalized ||
                pNorm.includes(normalized) ||
                normalized.includes(pNorm) ||
                normalized.includes(pLastNorm) ||
                pLastNorm.includes(normalized.split(" ").pop() ?? "")
              );
            });
            if (match) {
              await db
                .update(golfers)
                .set({ slashPlayerId: match.playerId })
                .where(eq(golfers.id, golfer.id));
              console.log(`[Seed] Matched ${golfer.name} → ${match.name} (${match.playerId})`);
            } else {
              console.warn(`[Seed] No match for ${golfer.name}`);
            }
          }
        } catch (lbErr) {
          console.warn("[Seed] Leaderboard fetch failed:", lbErr);
        }
      } else {
        console.warn("[Seed] Masters not found in schedule, creating empty shell");
      }
    } catch (schedErr) {
      console.warn("[Seed] Slash Golf unreachable:", schedErr);
    }

    // Fallback: create empty tournament shell if API failed
    if (!tournamentRow) {
      const [inserted] = await db
        .insert(tournaments)
        .values({
          name: "The Masters",
          slashTournId: null,
          startDate: "2026-04-09",
          endDate: "2026-04-12",
          status: "live",
        })
        .returning();
      tournamentRow = inserted;
    }

    // 4. Create picks
    for (const pick of PICKS) {
      const player = insertedPlayers.find((p) => p.slug === pick.playerSlug);
      const golfer = insertedGolfers.find((g) => g.name === pick.golferName);
      if (player && golfer) {
        await db.insert(picks).values({
          playerId: player.id,
          tournamentId: tournamentRow.id,
          golferId: golfer.id,
          openingOdds: pick.odds,
        });
      }
    }
    console.log("[Seed] Created picks");

    // 5. Create rounds
    const roundRows = [];
    for (let r = 1; r <= 4; r++) {
      const [round] = await db
        .insert(rounds)
        .values({
          tournamentId: tournamentRow.id,
          roundNumber: r,
          status: r === 1 ? "live" : "upcoming",
        })
        .returning();
      roundRows.push(round);
    }
    console.log("[Seed] Created 4 rounds");

    // 6. Populate round scores from leaderboard if available
    if (leaderboardData && leaderboardData.length > 0) {
      const updatedGolfers = await db.select().from(golfers);
      for (const golfer of updatedGolfers) {
        if (!golfer.slashPlayerId) continue;
        const lbPlayer = leaderboardData.find(
          (p) => p.playerId === golfer.slashPlayerId
        );
        if (!lbPlayer) continue;

        // Insert round scores
        for (let r = 1; r <= 4; r++) {
          const roundRow = roundRows.find((rr) => rr.roundNumber === r);
          if (!roundRow) continue;
          const score = lbPlayer.roundScores[r];
          if (score != null) {
            await db.insert(roundScores).values({
              golferId: golfer.id,
              roundId: roundRow.id,
              scoreToPar: score,
              thru: r <= lbPlayer.currentRound ? (r < lbPlayer.currentRound ? "F" : lbPlayer.thru) : null,
              position: lbPlayer.position,
            });
          }
        }

        // Create tournament result
        await db.insert(tournamentResults).values({
          golferId: golfer.id,
          tournamentId: tournamentRow.id,
          finalPosition: lbPlayer.position,
          finalScoreToPar: lbPlayer.scoreToPar,
          madeCut: lbPlayer.madeCut,
        });
      }
      console.log("[Seed] Populated round scores from leaderboard");
    } else {
      // Create empty tournament results for all golfers
      for (const golfer of insertedGolfers) {
        await db.insert(tournamentResults).values({
          golferId: golfer.id,
          tournamentId: tournamentRow.id,
          finalPosition: null,
          finalScoreToPar: null,
          madeCut: null,
        });
      }
    }

    return NextResponse.json({
      message: "Seed complete",
      seeded: true,
      tournament: tournamentRow,
      players: insertedPlayers.length,
      golfers: insertedGolfers.length,
    });
  } catch (error) {
    console.error("[Seed] Error:", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
