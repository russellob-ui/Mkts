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
import { normalizeGolferName } from "@/lib/slashgolf";

export async function POST(request: NextRequest) {
  const passcode = request.headers.get("x-admin-passcode");
  if (passcode !== process.env.ADMIN_PASSCODE) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { text } = await request.json();
    if (!text) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    // Parse format: "1 BURNS -5 F -5" or "T3 ÅBERG -3 6 -3"
    const lines = text.split("\n").filter((l: string) => l.trim());
    const updates: Array<Record<string, unknown>> = [];

    const allGolfers = await db.select().from(golfers);
    const liveTournaments = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.status, "live"));
    const tournament = liveTournaments[0];

    if (!tournament) {
      return NextResponse.json({ error: "No live tournament" }, { status: 400 });
    }

    // Build the surname list dynamically from golfers picked for this tournament
    const tournamentPicks = await db
      .select()
      .from(picks)
      .where(eq(picks.tournamentId, tournament.id));
    const pickedGolferIds = new Set(tournamentPicks.map((p) => p.golferId));
    const pickedGolfers = allGolfers.filter((g) => pickedGolferIds.has(g.id));
    const golferSurnames = pickedGolfers.map((g) => {
      const parts = normalizeGolferName(g.name).split(" ");
      return parts[parts.length - 1];
    });

    const tournamentRounds = await db
      .select()
      .from(rounds)
      .where(eq(rounds.tournamentId, tournament.id));

    for (const line of lines) {
      // Regex: position, name, overall score, thru/F, round score
      const match = line
        .trim()
        .match(/^(T?\d+|MC|WD|DQ|CUT)\s+([A-Z\u00C0-\u024F\s'.-]+)\s+([+-]?\d+|E)\s+(\d+|F)\s+([+-]?\d+|E)$/i);

      if (!match) continue;

      const [, pos, surname, overall, thru, roundScore] = match;
      const normalizedSurname = normalizeGolferName(surname);

      // Check if this is one of our picked golfers
      const isOurs = golferSurnames.some(
        (gs) =>
          normalizedSurname.includes(gs) || gs.includes(normalizedSurname)
      );
      if (!isOurs) continue;

      // Find golfer
      const golfer = allGolfers.find((g) => {
        const gNorm = normalizeGolferName(g.name);
        return (
          gNorm.includes(normalizedSurname) ||
          normalizedSurname.includes(gNorm.split(" ").pop() ?? "")
        );
      });

      if (!golfer) continue;

      const overallScore =
        overall === "E" || overall === "e" ? 0 : parseInt(overall);

      // Find current round (the highest live/upcoming round)
      const liveRound = tournamentRounds
        .filter((r) => r.status === "live")
        .sort((a, b) => b.roundNumber - a.roundNumber)[0] ??
        tournamentRounds[0];

      if (liveRound) {
        const rScore =
          roundScore === "E" || roundScore === "e"
            ? 0
            : parseInt(roundScore);

        const existing = await db
          .select()
          .from(roundScores)
          .where(
            and(
              eq(roundScores.golferId, golfer.id),
              eq(roundScores.roundId, liveRound.id)
            )
          );

        if (existing.length > 0) {
          await db
            .update(roundScores)
            .set({
              scoreToPar: rScore,
              thru: thru.toUpperCase(),
              position: pos,
              updatedAt: new Date(),
            })
            .where(eq(roundScores.id, existing[0].id));
        } else {
          await db.insert(roundScores).values({
            golferId: golfer.id,
            roundId: liveRound.id,
            scoreToPar: rScore,
            thru: thru.toUpperCase(),
            position: pos,
          });
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
            finalPosition: pos,
            finalScoreToPar: overallScore,
            madeCut: !["MC", "WD", "DQ", "CUT"].includes(pos.toUpperCase()),
          })
          .where(eq(tournamentResults.id, existingResult[0].id));
      }

      updates.push({
        golfer: golfer.name,
        position: pos,
        score: overallScore,
        roundScore,
        thru,
      });
    }

    // Update last polled
    await db
      .update(tournaments)
      .set({ lastPolledAt: new Date() })
      .where(eq(tournaments.id, tournament.id));

    return NextResponse.json({
      message: `Updated ${updates.length} golfers`,
      updates,
    });
  } catch (error) {
    console.error("[Paste Scores] Error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
