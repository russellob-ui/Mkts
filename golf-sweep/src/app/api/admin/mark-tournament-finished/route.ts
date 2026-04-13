import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tournaments } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { finishTournament } from "@/lib/finish-tournament";

export async function POST(request: NextRequest) {
  const passcode = request.headers.get("x-admin-passcode");
  if (passcode !== process.env.ADMIN_PASSCODE) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Resolve which tournament to finish, in priority order:
    //   1. tournamentId in request body (explicit wins)
    //   2. any tournament with status = "live"
    //   3. the most recent tournament that isn't "upcoming"
    //      — lets this button re-run on an already-finished tournament
    //      (to re-award points after a bug fix) without specifying an ID.
    const body = await request.json().catch(() => ({}));
    let tournament;

    if (body?.tournamentId) {
      const [t] = await db
        .select()
        .from(tournaments)
        .where(eq(tournaments.id, Number(body.tournamentId)));
      tournament = t;
    } else {
      const live = await db
        .select()
        .from(tournaments)
        .where(eq(tournaments.status, "live"));
      tournament = live[0];

      if (!tournament) {
        // Fall back to most recently-finished tournament
        const [recentFinished] = await db
          .select()
          .from(tournaments)
          .where(eq(tournaments.status, "finished"))
          .orderBy(desc(tournaments.id))
          .limit(1);
        tournament = recentFinished;
      }
    }

    if (!tournament) {
      return NextResponse.json(
        { error: "No tournament to finish — no live or finished tournament found" },
        { status: 400 }
      );
    }

    const statusBefore = tournament.status;
    const summary = await finishTournament(tournament.id);
    return NextResponse.json({
      message: summary.alreadyFinished
        ? "Tournament was already finished — points re-checked idempotently"
        : "Tournament marked as finished",
      resolvedTournament: {
        id: tournament.id,
        name: tournament.name,
        statusBefore,
      },
      ...summary,
    });
  } catch (error) {
    console.error("[MarkFinished] Error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
