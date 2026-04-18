import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tournaments, rounds } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  getSchedule,
  findTournamentByName,
  getGolfSeasonYear,
} from "@/lib/slashgolf";

export async function POST(request: NextRequest) {
  const passcode = request.headers.get("x-admin-passcode");
  if (passcode !== process.env.ADMIN_PASSCODE) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { tournamentId } = await request.json();
    if (!tournamentId) {
      return NextResponse.json(
        { error: "tournamentId is required" },
        { status: 400 }
      );
    }

    // Fetch the tournament
    const [tournament] = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.id, Number(tournamentId)));

    if (!tournament) {
      return NextResponse.json(
        { error: "Tournament not found" },
        { status: 404 }
      );
    }

    if (tournament.status !== "upcoming") {
      return NextResponse.json(
        { error: `Tournament is already "${tournament.status}", expected "upcoming"` },
        { status: 400 }
      );
    }

    // Flip status to live
    await db
      .update(tournaments)
      .set({ status: "live" })
      .where(eq(tournaments.id, tournament.id));

    // Create 4 rounds if they don't exist
    const existingRounds = await db
      .select()
      .from(rounds)
      .where(eq(rounds.tournamentId, tournament.id));

    const createdRounds: number[] = [];
    for (let r = 1; r <= 4; r++) {
      const exists = existingRounds.find((er) => er.roundNumber === r);
      if (!exists) {
        await db.insert(rounds).values({
          tournamentId: tournament.id,
          roundNumber: r,
          status: r === 1 ? "live" : "upcoming",
        });
        createdRounds.push(r);
      }
    }

    // Look up Slash Golf tournament ID
    let slashTournId: string | null = tournament.slashTournId;
    let slashGolfLookup: string = "skipped";

    if (!slashTournId && process.env.RAPIDAPI_KEY) {
      try {
        const year = getGolfSeasonYear();
        const schedule = await getSchedule(year);
        const found = findTournamentByName(schedule, tournament.name);
        if (found) {
          slashTournId = found.tournId;
          await db
            .update(tournaments)
            .set({ slashTournId: found.tournId })
            .where(eq(tournaments.id, tournament.id));
          slashGolfLookup = `Found: ${found.name} (${found.tournId})`;
        } else {
          slashGolfLookup = "Not found in schedule";
        }
      } catch (err) {
        slashGolfLookup = `Error: ${err}`;
      }
    } else if (slashTournId) {
      slashGolfLookup = `Already set: ${slashTournId}`;
    } else {
      slashGolfLookup = "No RAPIDAPI_KEY";
    }

    return NextResponse.json({
      message: `Tournament "${tournament.name}" activated`,
      tournament: {
        id: tournament.id,
        name: tournament.name,
        status: "live",
        slashTournId,
      },
      roundsCreated: createdRounds,
      slashGolfLookup,
    });
  } catch (error) {
    console.error("[ActivateTournament] Error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
