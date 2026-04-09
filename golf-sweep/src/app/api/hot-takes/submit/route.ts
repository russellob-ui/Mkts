import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import { hotTakes, players, tournaments, rounds, roundScores, picks } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    await ensureTables();

    const { playerPasscode, tournamentId, takeText, category } =
      await request.json();

    if (!playerPasscode || !tournamentId || !takeText) {
      return NextResponse.json(
        { error: "playerPasscode, tournamentId, and takeText are required" },
        { status: 400 }
      );
    }

    // Validate passcode
    const allPlayers = await db.select().from(players);
    const player = allPlayers.find((p) => p.passcode === playerPasscode);
    if (!player) {
      return NextResponse.json({ error: "Invalid passcode" }, { status: 401 });
    }

    // Check tournament status is 'upcoming' or round 1 hasn't started
    const [tournament] = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.id, tournamentId));

    if (!tournament) {
      return NextResponse.json(
        { error: "Tournament not found" },
        { status: 404 }
      );
    }

    if (tournament.status !== "upcoming") {
      // Check if round 1 has started by looking at round scores
      const round1Rows = await db
        .select()
        .from(rounds)
        .where(
          and(
            eq(rounds.tournamentId, tournamentId),
            eq(rounds.roundNumber, 1)
          )
        );
      const round1 = round1Rows[0];

      if (round1) {
        const tournamentPicks = await db
          .select()
          .from(picks)
          .where(eq(picks.tournamentId, tournamentId));
        const pickedGolferIds = tournamentPicks.map((p) => p.golferId);

        const scores = await db
          .select()
          .from(roundScores)
          .where(eq(roundScores.roundId, round1.id));

        const round1Started = scores.some(
          (s) =>
            pickedGolferIds.includes(s.golferId) &&
            s.thru !== null &&
            s.thru !== "0" &&
            parseInt(s.thru) >= 1
        );

        if (round1Started) {
          return NextResponse.json(
            { error: "Hot takes deadline has passed: round 1 has started" },
            { status: 400 }
          );
        }
      }
    }

    // Check one take per player per tournament
    const existing = await db
      .select()
      .from(hotTakes)
      .where(
        and(
          eq(hotTakes.playerId, player.id),
          eq(hotTakes.tournamentId, tournamentId)
        )
      );

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "You have already submitted a hot take for this tournament" },
        { status: 400 }
      );
    }

    const [take] = await db
      .insert(hotTakes)
      .values({
        playerId: player.id,
        tournamentId,
        takeText,
        category: category ?? null,
      })
      .returning();

    return NextResponse.json({ success: true, take });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
