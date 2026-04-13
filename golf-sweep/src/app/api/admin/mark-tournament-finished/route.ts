import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tournaments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { finishTournament } from "@/lib/finish-tournament";

export async function POST(request: NextRequest) {
  const passcode = request.headers.get("x-admin-passcode");
  if (passcode !== process.env.ADMIN_PASSCODE) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Find the live (or recently-live) tournament to finish. If none is
    // "live", fall back to the most recent one that isn't already finished.
    const live = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.status, "live"));
    let tournament = live[0];

    if (!tournament) {
      const body = await request.json().catch(() => ({}));
      if (body?.tournamentId) {
        const [match] = await db
          .select()
          .from(tournaments)
          .where(eq(tournaments.id, Number(body.tournamentId)));
        tournament = match;
      }
    }

    if (!tournament) {
      return NextResponse.json(
        { error: "No live tournament — pass tournamentId in body to finish a specific one" },
        { status: 400 }
      );
    }

    const summary = await finishTournament(tournament.id);
    return NextResponse.json({
      message: summary.alreadyFinished
        ? "Tournament was already finished — points ensured idempotently"
        : "Tournament marked as finished",
      ...summary,
    });
  } catch (error) {
    console.error("[MarkFinished] Error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
