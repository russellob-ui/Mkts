import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tournaments, golfers, picks, liveOdds } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getOutrightOdds, normalizeOddsName } from "@/lib/oddsapi";
import { normalizeGolferName } from "@/lib/slashgolf";

export async function POST(request: NextRequest) {
  // Auth — accept CRON_SECRET or ADMIN_PASSCODE
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
    const liveTournaments = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.status, "live"));

    if (liveTournaments.length === 0) {
      return NextResponse.json({ message: "No live tournaments", updated: 0 });
    }

    let totalUpdated = 0;

    for (const tournament of liveTournaments) {
      const sportKey = tournament.oddsApiSportKey;
      if (!sportKey) continue;

      const { golferOdds } = await getOutrightOdds(sportKey);
      if (golferOdds.size === 0) continue;

      // Get our picked golfers for this tournament
      const tournamentPicks = await db
        .select()
        .from(picks)
        .where(eq(picks.tournamentId, tournament.id));

      const pickedGolferIds = tournamentPicks.map((p) => p.golferId);
      const allGolfers = await db.select().from(golfers);
      const ourGolfers = allGolfers.filter((g) => pickedGolferIds.includes(g.id));

      for (const golfer of ourGolfers) {
        // Match by name
        const normalized = normalizeGolferName(golfer.name);
        let matchedOdds: { fractional: string; decimal: number; bookmaker: string } | null = null;

        for (const [oddsName, odds] of golferOdds) {
          const oddsNorm = normalizeOddsName(oddsName);
          if (
            oddsNorm === normalized ||
            oddsNorm.includes(normalized) ||
            normalized.includes(oddsNorm)
          ) {
            matchedOdds = odds;
            break;
          }
        }

        if (!matchedOdds) continue;

        // Upsert live odds
        const existing = await db
          .select()
          .from(liveOdds)
          .where(
            and(
              eq(liveOdds.golferId, golfer.id),
              eq(liveOdds.tournamentId, tournament.id)
            )
          );

        if (existing.length > 0) {
          await db
            .update(liveOdds)
            .set({
              fractional: matchedOdds.fractional,
              decimal: matchedOdds.decimal,
              bookmaker: matchedOdds.bookmaker,
              updatedAt: new Date(),
            })
            .where(eq(liveOdds.id, existing[0].id));
        } else {
          await db.insert(liveOdds).values({
            golferId: golfer.id,
            tournamentId: tournament.id,
            fractional: matchedOdds.fractional,
            decimal: matchedOdds.decimal,
            bookmaker: matchedOdds.bookmaker,
          });
        }

        totalUpdated++;
      }

      // Update last odds polled
      await db
        .update(tournaments)
        .set({ lastOddsPolledAt: new Date() })
        .where(eq(tournaments.id, tournament.id));
    }

    return NextResponse.json({
      message: "Odds poll complete",
      updated: totalUpdated,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[PollOdds] Error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
