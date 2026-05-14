import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { players, golfers, picks, tournaments } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  getLeaderboard,
  parseLeaderboardPlayers,
  normalizeGolferName,
} from "@/lib/slashgolf";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { playerId, passcode, golferName, tournamentId } = body as {
      playerId: number;
      passcode: string;
      golferName: string;
      tournamentId: number;
    };

    if (!playerId || !passcode || !golferName || !tournamentId) {
      return NextResponse.json(
        { error: "playerId, passcode, golferName, and tournamentId are required" },
        { status: 400 }
      );
    }

    // Validate player + passcode
    const [player] = await db
      .select()
      .from(players)
      .where(and(eq(players.id, playerId), eq(players.passcode, passcode)));

    if (!player) {
      return NextResponse.json(
        { error: "Invalid player or passcode" },
        { status: 401 }
      );
    }

    // Validate tournament exists and is live
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

    if (tournament.status !== "live") {
      return NextResponse.json(
        { error: "Tournament is not active" },
        { status: 400 }
      );
    }

    // Check if player already has a pick for this tournament
    const existingPick = await db
      .select()
      .from(picks)
      .where(
        and(
          eq(picks.playerId, playerId),
          eq(picks.tournamentId, tournamentId)
        )
      );

    if (existingPick.length > 0) {
      return NextResponse.json(
        { error: "You have already picked a golfer for this tournament" },
        { status: 409 }
      );
    }

    // Fetch leaderboard to verify golfer exists in the field
    if (!tournament.slashTournId) {
      return NextResponse.json(
        { error: "Tournament has no Slash Golf ID configured" },
        { status: 500 }
      );
    }

    const year = new Date().getFullYear();
    const lb = await getLeaderboard(tournament.slashTournId, year);
    const lbPlayers = parseLeaderboardPlayers(lb);

    // Find the golfer in the leaderboard by fuzzy name match
    const normalizedInput = normalizeGolferName(golferName);
    const lbMatch = lbPlayers.find((p) => {
      const pNorm = normalizeGolferName(p.name);
      return pNorm === normalizedInput;
    });

    if (!lbMatch) {
      return NextResponse.json(
        { error: `Golfer "${golferName}" not found in the tournament field` },
        { status: 404 }
      );
    }

    // Check if golfer already exists in our DB, or create them
    const allGolfers = await db.select().from(golfers);
    let golfer = allGolfers.find((g) => {
      const gNorm = normalizeGolferName(g.name);
      return gNorm === normalizeGolferName(lbMatch.name);
    });

    if (!golfer) {
      // Derive country/flag from leaderboard data if available
      // The leaderboard API may not provide country, so we store what we have
      const [inserted] = await db
        .insert(golfers)
        .values({
          name: lbMatch.name,
          country: null,
          flagEmoji: null,
          slashPlayerId: lbMatch.playerId,
        })
        .returning();
      golfer = inserted;
    } else if (!golfer.slashPlayerId && lbMatch.playerId) {
      // Update slashPlayerId if we didn't have it
      await db
        .update(golfers)
        .set({ slashPlayerId: lbMatch.playerId })
        .where(eq(golfers.id, golfer.id));
    }

    // Check if this golfer is already picked by another player for this tournament
    const golferTaken = await db
      .select()
      .from(picks)
      .where(
        and(
          eq(picks.golferId, golfer.id),
          eq(picks.tournamentId, tournamentId)
        )
      );

    if (golferTaken.length > 0) {
      // Find who picked them
      const [takenByPlayer] = await db
        .select()
        .from(players)
        .where(eq(players.id, golferTaken[0].playerId));

      return NextResponse.json(
        {
          error: `${golfer.name} has already been picked by ${takenByPlayer?.name ?? "another player"}`,
        },
        { status: 409 }
      );
    }

    // Create the pick
    const [pick] = await db
      .insert(picks)
      .values({
        playerId: player.id,
        tournamentId: tournament.id,
        golferId: golfer.id,
        openingOdds: null,
      })
      .returning();

    return NextResponse.json({
      success: true,
      pick: {
        id: pick.id,
        player: { id: player.id, name: player.name },
        golfer: { id: golfer.id, name: golfer.name, flagEmoji: golfer.flagEmoji },
        tournament: { id: tournament.id, name: tournament.name },
      },
    });
  } catch (error) {
    console.error("[Draft Pick] Error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
