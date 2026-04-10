import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import { hotTakes, players, tournaments } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET /api/hot-takes?tournamentId=1
 *
 * Returns:
 *   - submissionsOpen: true while the tournament is "live" or "upcoming"
 *     (closes only when the tournament is "finished" — allows mid-tournament
 *     bold predictions)
 *   - takes: all submitted takes for the tournament
 */
export async function GET(request: NextRequest) {
  try {
    await ensureTables();

    const tournamentId = Number(
      request.nextUrl.searchParams.get("tournamentId") ?? "0"
    );

    if (!tournamentId) {
      return NextResponse.json(
        { error: "tournamentId query param is required" },
        { status: 400 }
      );
    }

    const [tournament] = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.id, tournamentId));

    const submissionsOpen =
      !!tournament && tournament.status !== "finished";

    const takes = await db
      .select()
      .from(hotTakes)
      .where(eq(hotTakes.tournamentId, tournamentId));

    const allPlayers = await db.select().from(players);

    // Newest first
    takes.sort(
      (a, b) =>
        new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    );

    const result = takes.map((take) => {
      const player = allPlayers.find((p) => p.id === take.playerId);
      return {
        id: take.id,
        player: {
          id: take.playerId,
          name: player?.name ?? "Unknown",
          slug: player?.slug ?? null,
          color: player?.color ?? null,
          avatarEmoji: player?.avatarEmoji ?? null,
        },
        // legacy flat fields — keep for any old consumer
        playerName: player?.name ?? "Unknown",
        playerId: take.playerId,
        playerSlug: player?.slug ?? null,
        playerColor: player?.color ?? null,
        playerAvatarEmoji: player?.avatarEmoji ?? null,
        takeText: take.takeText,
        category: take.category,
        submittedAt: take.submittedAt.toISOString(),
        outcome: take.outcome,
        pointsAwarded: take.pointsAwarded,
        gradingNotes: take.gradingNotes,
      };
    });

    return NextResponse.json({
      submissionsOpen,
      takes: result,
    });
  } catch (error) {
    console.error("[HotTakes GET]", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

/**
 * POST /api/hot-takes
 * Body: { playerId, passcode, tournamentId, takeText, category? }
 *
 * Allows multiple takes per player per tournament — no limit. Window is
 * open for the whole tournament until it's marked finished.
 */
export async function POST(request: NextRequest) {
  try {
    await ensureTables();
    const { playerId, passcode, tournamentId, takeText, category } =
      await request.json();

    if (!playerId || !passcode || !tournamentId || !takeText) {
      return NextResponse.json(
        { error: "playerId, passcode, tournamentId and takeText are required" },
        { status: 400 }
      );
    }

    // Validate identity: playerId + passcode together
    const [player] = await db
      .select()
      .from(players)
      .where(eq(players.id, Number(playerId)));
    if (!player || player.passcode !== passcode) {
      return NextResponse.json(
        { error: "Invalid player or passcode" },
        { status: 401 }
      );
    }

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
    if (tournament.status === "finished") {
      return NextResponse.json(
        { error: "Tournament is over — hot takes closed" },
        { status: 400 }
      );
    }

    const [take] = await db
      .insert(hotTakes)
      .values({
        playerId: player.id,
        tournamentId: Number(tournamentId),
        takeText: String(takeText).trim(),
        category: category ?? null,
      })
      .returning();

    // Return the enriched take for instant UI insertion
    return NextResponse.json({
      success: true,
      take: {
        id: take.id,
        player: {
          id: player.id,
          name: player.name,
          slug: player.slug,
          color: player.color,
          avatarEmoji: player.avatarEmoji,
        },
        takeText: take.takeText,
        category: take.category,
        submittedAt: take.submittedAt.toISOString(),
        outcome: take.outcome,
        pointsAwarded: take.pointsAwarded,
        gradingNotes: take.gradingNotes,
      },
    });
  } catch (error) {
    console.error("[HotTakes POST]", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

